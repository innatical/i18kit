import * as gettextParser from 'gettext-parser'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import type { ExtractedMessage } from './extractor.js'

export type GeneratorOptions = {
  projectName?: string
  version?: string
  bugReportEmail?: string
  sourceLocale?: string
}

export class POGenerator {
  generate(
    messages: Map<string, ExtractedMessage>,
    outputPath: string,
    existingPoPath?: string,
    options: GeneratorOptions = {}
  ): void {
    const existingTranslations =
      existingPoPath && existsSync(existingPoPath)
        ? this.loadExistingTranslations(existingPoPath)
        : new Map<string, string>()

    const poData: any = {
      charset: 'utf-8',
      headers: {
        'Project-Id-Version': `${options.projectName || 'i18kit'} ${options.version || '1.0'}`,
        'Report-Msgid-Bugs-To': options.bugReportEmail || '',
        'POT-Creation-Date': new Date().toISOString(),
        'PO-Revision-Date': new Date().toISOString(),
        'Last-Translator': '',
        'Language-Team': '',
        Language: options.sourceLocale || '',
        'MIME-Version': '1.0',
        'Content-Type': 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding': '8bit',
        'X-Generator': 'i18kit'
      },
      translations: { '': {} }
    }

    const translations = poData.translations['']
    translations[''] = {
      msgid: '',
      msgstr: Object.entries(poData.headers).map(([k, v]) => `${k}: ${v}\n`)
    }

    for (const [id, message] of messages.entries()) {
      const comments: any = {}

      if (message.locations.length > 0) {
        comments.reference = message.locations.map((loc) => `${loc.file}:${loc.line}`).join('\n')
      }

      const extractedComments: string[] = [`ID: ${id}`]
      if (message.context) extractedComments.push(`Context: ${message.context}`)
      comments.extracted = extractedComments.join('\n')

      const existingTranslation = existingTranslations.get(message.defaultMessage)
      translations[message.defaultMessage] = {
        msgid: message.defaultMessage,
        msgstr: existingTranslation ? [existingTranslation] : [''],
        comments
      }
    }

    const poBuffer = gettextParser.po.compile(poData)
    writeFileSync(outputPath, poBuffer)
  }

  private loadExistingTranslations(poPath: string): Map<string, string> {
    const poBuffer = readFileSync(poPath)
    const poData = gettextParser.po.parse(poBuffer)
    const translations = poData.translations[''] ?? {}
    const result = new Map<string, string>()

    for (const [msgid, entry] of Object.entries(translations)) {
      if (msgid === '') continue
      const msgstr = (entry as any).msgstr[0]
      if (msgstr && msgstr.trim()) result.set(msgid, msgstr)
    }

    return result
  }
}
