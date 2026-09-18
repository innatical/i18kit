import { readFile } from 'fs/promises'
import { basename, join } from 'path'
import { HttpError } from './errors.js'
import { isProviderId, PROVIDERS, translateWith } from './providers.js'
import { createScopedFs } from './scoped-fs.js'
import * as store from './store.js'

type Args = Record<string, unknown>
export type Handler = (args: Args) => unknown | Promise<unknown>

const MAX_TRANSLATE_CHARS = 20_000

function str(args: Args, key: string): string {
  const value = args[key]
  if (typeof value !== 'string') throw new HttpError(400, `Expected "${key}" to be a string`)
  return value
}

function provider(args: Args) {
  const id = args.provider
  if (!isProviderId(id)) throw new HttpError(400, 'Unknown provider')
  return id
}

/** The commands the UI can call. Anything not listed here is not reachable. */
export function createApi(root: string): Record<string, Handler> {
  const fs = createScopedFs(root)

  return {
    async project_info() {
      let name = basename(root)
      try {
        const config = JSON.parse(await readFile(join(root, '.i18kit.json'), 'utf8'))
        if (typeof config.name === 'string' && config.name) name = config.name
      } catch {}
      return { name }
    },

    read_text_file: (a) => fs.readText(str(a, 'path')),
    write_text_file: (a) => fs.writeText(str(a, 'path'), str(a, 'content')),
    read_dir: (a) => fs.readDir(str(a, 'path')),
    file_exists: (a) => fs.exists(str(a, 'path')),
    create_dir: (a) => fs.createDir(str(a, 'path')),

    async list_providers() {
      const configured = await store.listConfiguredProviders()
      return PROVIDERS.map((p) => ({ ...p, hasKey: configured.has(p.id) }))
    },

    async save_api_key(a) {
      const key = str(a, 'key').trim()
      if (!key) throw new HttpError(400, 'API key is empty')
      await store.setApiKey(provider(a), key)
    },

    delete_api_key: (a) => store.deleteApiKey(provider(a)),

    get_settings: () => store.getSettings(),

    async save_settings(a) {
      const settings = a.settings as { defaultProvider?: unknown } | undefined
      const defaultProvider = settings?.defaultProvider ?? null
      if (defaultProvider !== null && !isProviderId(defaultProvider)) {
        throw new HttpError(400, 'Unknown provider')
      }
      await store.saveSettings({ defaultProvider })
    },

    async translate_text(a) {
      const id = provider(a)
      const text = str(a, 'text')
      if (text.length > MAX_TRANSLATE_CHARS) throw new HttpError(400, 'Text is too long')
      const key = await store.getApiKey(id)
      if (!key) throw new HttpError(400, `No API key configured for '${id}'. Add one in Settings.`)
      return translateWith(id, key, text, str(a, 'sourceLang'), str(a, 'targetLang'))
    },
  }
}
