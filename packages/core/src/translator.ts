import * as gettextParser from 'gettext-parser'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, isAbsolute } from 'path'
import { generateId, buildMessage, applyArgs } from './utils.js'

export type Translator = {
  t(strings: TemplateStringsArray | string, ...values: any[]): string
  tc(context: string, strings: TemplateStringsArray | string, ...values: any[]): string
}

export type LoadOptions = {
  localesDir?: string
  cwd?: string
}

// locale code → (id → translated string)
let store: Map<string, Map<string, string>> | null = null

function resolveLocalesDir(cwd: string, localesDir?: string): string {
  if (localesDir) {
    return isAbsolute(localesDir) ? localesDir : join(cwd, localesDir)
  }

  const configPath = join(cwd, '.i18kit.json')
  if (!existsSync(configPath)) {
    throw new Error('.i18kit.json not found — run i18kit init or pass localesDir option')
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'))
  const rel = config.localesDir as string | undefined
  return rel && rel !== '.' ? join(cwd, rel) : cwd
}

function parsePoFile(poPath: string): Map<string, string> {
  const poData = gettextParser.po.parse(readFileSync(poPath))
  const entries = poData.translations[''] ?? {}
  const lookup = new Map<string, string>()

  for (const [msgid, entry] of Object.entries(entries)) {
    if (msgid === '') continue
    const msgstr = (entry as any).msgstr[0]
    if (!msgstr?.trim()) continue
    const extracted = (entry as any).comments?.extracted ?? ''
    const idMatch = extracted.match(/ID: ([a-f0-9]+)/)
    if (idMatch) lookup.set(idMatch[1], msgstr)
  }

  return lookup
}

/**
 * Load all .po files from the locales directory into memory.
 * Call this once at app startup before using createTranslator.
 */
export async function loadTranslations(options: LoadOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd()
  const localesDir = resolveLocalesDir(cwd, options.localesDir)

  store = new Map()

  const files = readdirSync(localesDir).filter(
    (f) => f.endsWith('.po') && !f.endsWith('.pot')
  )

  for (const file of files) {
    const locale = file.replace(/\.po$/, '')
    store.set(locale, parsePoFile(join(localesDir, file)))
  }
}

/**
 * Returns t() and tc() bound to the given locale. Synchronous — no I/O.
 * Falls back to the base language if the full locale isn't loaded
 * (e.g. 'es-ES' → 'es'), then falls back to the source string.
 *
 * Must call loadTranslations() before this.
 */
export function createTranslator(locale: string): Translator {
  if (!store) {
    throw new Error('Call loadTranslations() before createTranslator()')
  }

  const baseLang = locale.split('-')[0]
  const lookup = store.get(locale) ?? store.get(baseLang) ?? new Map<string, string>()

  function translate(id: string, defaultMessage: string, args?: Record<string, any>): string {
    return applyArgs(lookup.get(id) ?? defaultMessage, args)
  }

  return {
    t(strings: TemplateStringsArray | string, ...values: any[]): string {
      const { message, args } = buildMessage(strings, values)
      return translate(generateId(message), message, args)
    },

    tc(context: string, strings: TemplateStringsArray | string, ...values: any[]): string {
      const { message, args } = buildMessage(strings, values)
      return translate(generateId(message, context), message, args)
    },
  }
}

/**
 * Returns all loaded locale codes.
 */
export function getLoadedLocales(): string[] {
  return store ? [...store.keys()] : []
}
