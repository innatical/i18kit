import { createHash } from 'crypto'

export function generateId(message: string, context?: string): string {
  const hash = createHash('sha256')
  hash.update(message)
  if (context) hash.update(`|${context}`)
  return hash.digest('hex').substring(0, 16)
}

export function buildMessage(
  strings: TemplateStringsArray | string,
  values: any[]
): { message: string; args?: Record<string, any> } {
  if (typeof strings === 'string') {
    return { message: strings }
  }

  const message = strings.reduce((acc, str, i) => {
    return acc + str + (values[i] !== undefined ? `{${i}}` : '')
  }, '')

  const args: Record<string, any> = {}
  values.forEach((val, i) => { args[i] = val })

  return { message, args: values.length > 0 ? args : undefined }
}

export function applyArgs(translated: string, args?: Record<string, any>): string {
  if (!args) return translated
  return translated.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ''))
}
