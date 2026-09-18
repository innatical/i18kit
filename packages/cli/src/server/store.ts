import { existsSync } from 'fs'
import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

export type AppSettings = { defaultProvider: string | null }

function configDir(): string {
  if (process.env.I18KIT_CONFIG_DIR) return process.env.I18KIT_CONFIG_DIR
  if (process.platform === 'win32' && process.env.APPDATA) return join(process.env.APPDATA, 'i18kit')
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'i18kit')
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback
  return JSON.parse(await readFile(file, 'utf8')) as T
}

// Write via a temp file so a crash can't leave a half-written credentials file.
async function writePrivateJson(file: string, value: unknown): Promise<void> {
  await mkdir(configDir(), { recursive: true, mode: 0o700 })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600 })
  await rename(tmp, file)
}

const credentialsFile = () => join(configDir(), 'credentials.json')
const settingsFile = () => join(configDir(), 'settings.json')

export async function getApiKey(provider: string): Promise<string | null> {
  const keys = await readJson<Record<string, string>>(credentialsFile(), {})
  return keys[provider] ?? null
}

export async function listConfiguredProviders(): Promise<Set<string>> {
  const keys = await readJson<Record<string, string>>(credentialsFile(), {})
  return new Set(Object.keys(keys))
}

export async function setApiKey(provider: string, key: string): Promise<void> {
  const keys = await readJson<Record<string, string>>(credentialsFile(), {})
  keys[provider] = key
  await writePrivateJson(credentialsFile(), keys)
}

export async function deleteApiKey(provider: string): Promise<void> {
  const keys = await readJson<Record<string, string>>(credentialsFile(), {})
  delete keys[provider]
  await writePrivateJson(credentialsFile(), keys)
}

export async function getSettings(): Promise<AppSettings> {
  return { defaultProvider: null, ...(await readJson<Partial<AppSettings>>(settingsFile(), {})) }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await writePrivateJson(settingsFile(), settings)
}
