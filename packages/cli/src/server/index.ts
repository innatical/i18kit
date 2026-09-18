import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { existsSync, readFileSync, realpathSync } from 'fs'
import { readFile, stat } from 'fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import type { AddressInfo } from 'net'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'path'
import { fileURLToPath } from 'url'
import { createApi } from './api.js'
import { HttpError } from './errors.js'

export type LocalServer = {
  /** Open this once: the code in the fragment is exchanged for a session token. */
  url: string
  close(): Promise<void>
}

const MAX_BODY_BYTES = 5 * 1024 * 1024

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

function resolveUiDir(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    process.env.I18KIT_UI_DIR,
    join(here, 'ui'), // published: dist/ui next to dist/index.js
    join(here, '../../../web/dist'), // monorepo dev: packages/web/dist from src/server
  ]
  for (const dir of candidates) {
    if (dir && existsSync(join(dir, 'index.html'))) return realpathSync(dir)
  }
  throw new Error('UI build not found. Run `bun run build` at the repo root.')
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

// index.html has an inline script; allow exactly those by hash rather than 'unsafe-inline'.
function buildCsp(indexHtml: string): string {
  const hashes = [...indexHtml.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`,
  )
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ')
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large')
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    return parsed
  } catch {
    throw new HttpError(400, 'Invalid JSON body')
  }
}

export async function startServer(opts: { root: string; port?: number }): Promise<LocalServer> {
  const uiDir = resolveUiDir()
  const csp = buildCsp(readFileSync(join(uiDir, 'index.html'), 'utf8'))
  const api = createApi(opts.root)

  // The URL handed to the browser carries a single-use code; the long-lived
  // session token is only ever sent over the exchange response.
  const sessionToken = randomBytes(32).toString('hex')
  const bootstrapCode = randomBytes(32).toString('hex')
  let bootstrapUsed = false

  let allowedHosts = new Set<string>()
  let allowedOrigins = new Set<string>()

  function baseHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cache-Control': 'no-store',
    }
  }

  function sendJson(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { ...baseHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body ?? null))
  }

  async function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed')

    let decoded: string
    try {
      decoded = decodeURIComponent(pathname)
    } catch {
      throw new HttpError(400, 'Bad request')
    }
    if (decoded.includes('\0')) throw new HttpError(400, 'Bad request')

    let file = resolve(uiDir, `.${decoded}`)
    const rel = relative(uiDir, file)
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new HttpError(403, 'Forbidden')

    let info = await stat(file).catch(() => null)
    if (info?.isDirectory()) {
      file = join(file, 'index.html')
      info = await stat(file).catch(() => null)
    }
    if (!info?.isFile()) {
      // Client-side routes fall back to the SPA shell; missing assets are a 404.
      if (extname(decoded)) throw new HttpError(404, 'Not found')
      file = join(uiDir, 'index.html')
    }

    const isHashedAsset = decoded.startsWith('/assets/')
    res.writeHead(200, {
      ...baseHeaders(),
      'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-store',
    })
    if (req.method === 'HEAD') return res.end()
    res.end(await readFile(file))
  }

  async function handleApi(req: IncomingMessage, res: ServerResponse, command: string) {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')

    // Browsers always send Origin on cross-origin POSTs; reject anything but our own page.
    const origin = req.headers.origin
    if (origin !== undefined && !allowedOrigins.has(origin)) throw new HttpError(403, 'Forbidden origin')

    // JSON-only forces a CORS preflight for cross-origin callers, and we never answer one.
    if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      throw new HttpError(415, 'Content-Type must be application/json')
    }

    const args = await readJsonBody(req)

    if (command === 'exchange') {
      const code = typeof args.code === 'string' ? args.code : ''
      if (bootstrapUsed || !safeEqual(code, bootstrapCode)) throw new HttpError(401, 'Invalid or used code')
      bootstrapUsed = true
      return sendJson(res, 200, { token: sessionToken })
    }

    const auth = req.headers.authorization ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!safeEqual(token, sessionToken)) throw new HttpError(401, 'Unauthorized')

    const handler = Object.hasOwn(api, command) ? api[command] : undefined
    if (!handler) throw new HttpError(404, 'Unknown command')
    sendJson(res, 200, await handler(args))
  }

  const server = createServer(async (req, res) => {
    try {
      // Stops DNS-rebinding: a page on evil.com resolving to 127.0.0.1 still sends its own Host.
      if (!req.headers.host || !allowedHosts.has(req.headers.host)) throw new HttpError(403, 'Forbidden host')

      const { pathname } = new URL(req.url ?? '/', 'http://localhost')
      if (pathname.startsWith('/api/')) {
        await handleApi(req, res, pathname.slice('/api/'.length))
      } else {
        await serveStatic(req, res, pathname)
      }
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      const message = err instanceof Error ? err.message : 'Internal error'
      if (res.headersSent) return res.destroy()
      if (status === 413) res.setHeader('Connection', 'close')
      sendJson(res, status, { error: message })
    }
  })

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(opts.port ?? 0, '127.0.0.1', resolveListen)
  })

  const { port } = server.address() as AddressInfo
  allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`])
  allowedOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`])

  return {
    url: `http://127.0.0.1:${port}/#code=${bootstrapCode}`,
    close: () =>
      new Promise<void>((resolveClose) => {
        server.close(() => resolveClose())
        server.closeAllConnections()
      }),
  }
}
