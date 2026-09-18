import { lstatSync, realpathSync } from 'fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'path'
import { HttpError } from './errors.js'

const CONFIG_FILENAME = '.i18kit.json'

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/**
 * Filesystem access confined to a single project directory. Every path is
 * resolved against the root, and symlinks are followed before the containment
 * check so they can't be used to escape it.
 */
export function createScopedFs(root: string) {
  const realRoot = realpathSync(root)

  function resolvePath(input: string): string {
    if (input.includes('\0')) throw new HttpError(400, 'Invalid path')

    const abs = resolve(realRoot, input)
    if (!isInside(realRoot, abs)) throw new HttpError(403, 'Path is outside the project')

    // Follow symlinks on the nearest existing ancestor (lstat, so a dangling
    // symlink counts as existing and fails realpath instead of being skipped).
    let probe = abs
    for (;;) {
      try {
        lstatSync(probe)
        break
      } catch {
        const parent = dirname(probe)
        if (parent === probe) break
        probe = parent
      }
    }

    let realProbe: string
    try {
      realProbe = realpathSync(probe)
    } catch {
      throw new HttpError(403, 'Path could not be resolved')
    }
    if (!isInside(realRoot, realProbe)) throw new HttpError(403, 'Path is outside the project')

    return abs
  }

  // Only translation files and the project config are readable/writable.
  function resolveFile(input: string): string {
    const abs = resolvePath(input)
    const name = basename(abs)
    const isConfig = abs === join(realRoot, CONFIG_FILENAME)
    if (!isConfig && !name.endsWith('.po') && !name.endsWith('.pot')) {
      throw new HttpError(403, 'Only .po, .pot and .i18kit.json files can be accessed')
    }
    return abs
  }

  return {
    readText: (path: string) => readFile(resolveFile(path), 'utf8'),

    writeText: (path: string, content: string) => writeFile(resolveFile(path), content, 'utf8'),

    async readDir(path: string) {
      const dir = resolvePath(path)
      const entries = await readdir(dir, { withFileTypes: true })
      return entries.map((e) => ({ name: e.name, isFile: e.isFile() }))
    },

    async exists(path: string) {
      try {
        await stat(resolvePath(path))
        return true
      } catch (err) {
        if (err instanceof HttpError) throw err
        return false
      }
    },

    async createDir(path: string) {
      await mkdir(resolvePath(path), { recursive: true })
    },
  }
}
