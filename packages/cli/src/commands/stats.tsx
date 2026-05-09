import { useEffect, useState } from 'react'
import { Box, Text, useApp } from 'ink'
import Spinner from 'ink-spinner'
import * as gettextParser from 'gettext-parser'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

type LanguageStat = {
  lang: string
  translated: number
  untranslated: number
  total: number
  coverage: string
}

type State =
  | { status: 'running' }
  | { status: 'done'; stats: LanguageStat[] }
  | { status: 'error'; message: string }

export function Stats() {
  const { exit } = useApp()
  const [state, setState] = useState<State>({ status: 'running' })

  useEffect(() => {
    const localesDir = join(process.cwd(), 'locales')

    try {
      if (!existsSync(localesDir)) {
        throw new Error('No locales directory found — run "extract" first')
      }

      const poFiles = readdirSync(localesDir).filter(
        (f) => f.endsWith('.po') && !f.endsWith('.pot')
      )

      if (poFiles.length === 0) {
        throw new Error('No .po files found — run "init <lang>" to create a language')
      }

      const stats: LanguageStat[] = poFiles.map((file) => {
        const lang = file.replace('.po', '')
        const poData = gettextParser.po.parse(readFileSync(join(localesDir, file)))
        const translations = poData.translations[''] ?? {}

        let total = 0
        let translated = 0

        for (const [msgid, entry] of Object.entries(translations)) {
          if (msgid === '') continue
          total++
          const msgstr = (entry as any).msgstr[0]
          if (msgstr && msgstr.trim()) translated++
        }

        const untranslated = total - translated
        const coverage = total > 0 ? ((translated / total) * 100).toFixed(1) : '0.0'
        return { lang, translated, untranslated, total, coverage }
      })

      setState({ status: 'done', stats })
    } catch (err: any) {
      setState({ status: 'error', message: err.message })
      exit(err)
      return
    }

    exit()
  }, [])

  if (state.status === 'running') {
    return (
      <Box gap={1}>
        <Text color="green"><Spinner type="dots" /></Text>
        <Text>Reading translation files…</Text>
      </Box>
    )
  }

  if (state.status === 'error') {
    return <Text color="red">Error: {state.message}</Text>
  }

  const coverageColor = (pct: string) => {
    const n = parseFloat(pct)
    if (n >= 90) return 'green'
    if (n >= 50) return 'yellow'
    return 'red'
  }

  return (
    <Box flexDirection="column">
      <Box gap={2}>
        <Text bold dimColor>{'Language'.padEnd(12)}</Text>
        <Text bold dimColor>{'Done'.padEnd(6)}</Text>
        <Text bold dimColor>{'Missing'.padEnd(8)}</Text>
        <Text bold dimColor>{'Total'.padEnd(6)}</Text>
        <Text bold dimColor>Coverage</Text>
      </Box>
      {state.stats.map(({ lang, translated, untranslated, total, coverage }) => (
        <Box key={lang} gap={2}>
          <Text>{lang.padEnd(12)}</Text>
          <Text color="green">{String(translated).padEnd(6)}</Text>
          <Text color={untranslated > 0 ? 'red' : 'green'}>{String(untranslated).padEnd(8)}</Text>
          <Text>{String(total).padEnd(6)}</Text>
          <Text color={coverageColor(coverage)}>{coverage}%</Text>
        </Box>
      ))}
    </Box>
  )
}
