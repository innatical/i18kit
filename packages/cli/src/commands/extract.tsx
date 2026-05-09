import { useEffect, useState } from 'react'
import { Box, Text, useApp } from 'ink'
import Spinner from 'ink-spinner'
import { StringExtractor } from '../extractor.js'
import { POGenerator } from '../generator.js'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { join, isAbsolute } from 'path'

type Props = { dir?: string }
type State =
  | { status: 'running' }
  | { status: 'done'; count: number; potPath: string }
  | { status: 'empty' }
  | { status: 'no-config' }
  | { status: 'error'; message: string }

export function Extract({ dir }: Props) {
  const { exit } = useApp()
  const [state, setState] = useState<State>({ status: 'running' })

  useEffect(() => {
    const cwd = process.cwd()
    const configPath = join(cwd, '.i18kit.json')

    if (!existsSync(configPath)) {
      setState({ status: 'no-config' })
      exit(new Error('no config'))
      return
    }

    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      const rel = config.localesDir as string | undefined
      const localesDir = rel && rel !== '.'
        ? isAbsolute(rel) ? rel : join(cwd, rel)
        : cwd

      const targetDir = dir || cwd
      const extractor = new StringExtractor()
      const messages = extractor.extract(targetDir)

      if (messages.size === 0) {
        setState({ status: 'empty' })
        exit()
        return
      }

      if (!existsSync(localesDir)) {
        mkdirSync(localesDir, { recursive: true })
      }

      const potPath = join(localesDir, 'i18kit.pot')
      const generator = new POGenerator()
      generator.generate(messages, potPath, undefined, {
        projectName: config.name,
        sourceLocale: config.sourceLanguage,
      })

      setState({ status: 'done', count: messages.size, potPath })
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
        <Text>Extracting strings…</Text>
      </Box>
    )
  }

  if (state.status === 'no-config') {
    return (
      <Box flexDirection="column">
        <Text color="red">No .i18kit.json found</Text>
        <Text dimColor>Run <Text color="cyan">i18kit init</Text> to set up this project first</Text>
      </Box>
    )
  }

  if (state.status === 'empty') {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No t() or tc() calls found.</Text>
        <Text dimColor>Make sure you are using t("message") or tc("context", "message")</Text>
      </Box>
    )
  }

  if (state.status === 'error') {
    return <Text color="red">Error: {state.message}</Text>
  }

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color="green">✓</Text>
        <Text>Found <Text bold>{state.count}</Text> unique strings</Text>
      </Box>
      <Box gap={1}>
        <Text color="green">✓</Text>
        <Text dimColor>{state.potPath}</Text>
      </Box>
    </Box>
  )
}
