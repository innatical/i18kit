import { generateId, buildMessage } from './utils.js'

export type TranslationReference = {
  id: string
  defaultMessage: string
  context?: string
  args?: Record<string, any>
}

export const t = (
  strings: TemplateStringsArray | string,
  ...values: any[]
): TranslationReference => {
  const { message, args } = buildMessage(strings, values)
  return { id: generateId(message), defaultMessage: message, args }
}

export const tc = (
  context: string,
  strings: TemplateStringsArray | string,
  ...values: any[]
): TranslationReference => {
  const { message, args } = buildMessage(strings, values)
  return { id: generateId(message, context), defaultMessage: message, context, args }
}

export { loadTranslations, createTranslator, getLoadedLocales } from './translator.js'
export type { Translator, LoadOptions } from './translator.js'
