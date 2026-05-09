import { useEffect, useState } from 'react'
import { Box, Text, useApp } from 'ink'
import TextInput from 'ink-text-input'
import Spinner from 'ink-spinner'
import { StringExtractor } from '../extractor.js'
import { POGenerator } from '../generator.js'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
import { join, isAbsolute, relative } from 'path'

type Step =
  | { id: 'check' }
  | { id: 'output-dir' }
  | { id: 'name'; relativeLocalesDir: string; absLocalesDir: string; detectedLocales: string[] }
  | { id: 'source-lang'; relativeLocalesDir: string; absLocalesDir: string; name: string; detectedLocales: string[] }
  | { id: 'locales'; relativeLocalesDir: string; absLocalesDir: string; name: string; sourceLanguage: string; detectedLocales: string[] }
  | { id: 'creating'; relativeLocalesDir: string; absLocalesDir: string; name: string; sourceLanguage: string; locales: string[] }
  | { id: 'done'; name: string; potPath: string; locales: string[]; relativeLocalesDir: string }
  | { id: 'error'; message: string }

export function Init() {
  const { exit } = useApp()
  const [step, setStep] = useState<Step>({ id: 'check' })
  const [outputDirInput, setOutputDirInput] = useState('locales')
  const [nameInput, setNameInput] = useState('')
  const [sourceLangInput, setSourceLangInput] = useState('en')
  const [localesInput, setLocalesInput] = useState('')

  const cwd = process.cwd()
  const configPath = join(cwd, '.i18kit.json')

  useEffect(() => {
    if (existsSync(configPath)) {
      setStep({ id: 'error', message: '.i18kit.json already exists — project is already initialized' })
      exit(new Error('already initialized'))
      return
    }
    setStep({ id: 'output-dir' })
  }, [])

  useEffect(() => {
    if (step.id !== 'creating') return

    try {
      const { absLocalesDir, relativeLocalesDir } = step
      if (!existsSync(absLocalesDir)) {
        mkdirSync(absLocalesDir, { recursive: true })
      }

      const extractor = new StringExtractor()
      const messages = extractor.extract(cwd)
      const generator = new POGenerator()
      const potPath = join(absLocalesDir, 'i18kit.pot')
      generator.generate(messages, potPath, undefined, {
        projectName: step.name,
        sourceLocale: step.sourceLanguage
      })

      const config = {
        name: step.name,
        sourceLanguage: step.sourceLanguage,
        locales: step.locales,
        localesDir: relativeLocalesDir,
        createdAt: new Date().toISOString()
      }
      writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

      setStep({ id: 'done', name: step.name, potPath, locales: step.locales, relativeLocalesDir })
    } catch (err: any) {
      setStep({ id: 'error', message: err.message })
      exit(err)
      return
    }

    exit()
  }, [step.id])

  const advanceFromOutputDir = (value: string) => {
    const raw = value.trim() || 'locales'
    const absLocalesDir = isAbsolute(raw) ? raw : join(cwd, raw)
    const relativeLocalesDir = relative(cwd, absLocalesDir) || '.'
    const detectedLocales = existsSync(absLocalesDir)
      ? readdirSync(absLocalesDir)
          .filter((f) => f.endsWith('.po') && !f.endsWith('.pot'))
          .map((f) => f.replace('.po', ''))
      : []
    setStep({ id: 'name', relativeLocalesDir, absLocalesDir, detectedLocales })
  }

  if (step.id === 'check') {
    return (
      <Box gap={1}>
        <Text color="green"><Spinner type="dots" /></Text>
        <Text>Checking project…</Text>
      </Box>
    )
  }

  if (step.id === 'error') {
    return <Text color="red">Error: {step.message}</Text>
  }

  if (step.id === 'output-dir') {
    return (
      <Box gap={1}>
        <Text bold>Locales directory</Text>
        <Text dimColor>(default: locales):</Text>
        <TextInput
          value={outputDirInput}
          onChange={setOutputDirInput}
          onSubmit={advanceFromOutputDir}
        />
      </Box>
    )
  }

  if (step.id === 'name') {
    return (
      <Box flexDirection="column" gap={1}>
        <Box gap={1}>
          <Text color="green">✓</Text>
          <Text bold>Locales directory:</Text>
          <Text>{step.relativeLocalesDir}</Text>
        </Box>
        {step.detectedLocales.length > 0 && (
          <Text dimColor>Found existing locales: <Text color="cyan">{step.detectedLocales.join(', ')}</Text></Text>
        )}
        <Box gap={1}>
          <Text bold>Project name:</Text>
          <TextInput
            value={nameInput}
            onChange={setNameInput}
            onSubmit={(value) => {
              const name = value.trim()
              if (!name) return
              setStep({ id: 'source-lang', relativeLocalesDir: step.relativeLocalesDir, absLocalesDir: step.absLocalesDir, name, detectedLocales: step.detectedLocales })
            }}
          />
        </Box>
      </Box>
    )
  }

  if (step.id === 'source-lang') {
    return (
      <Box flexDirection="column" gap={1}>
        <Box gap={1}>
          <Text color="green">✓</Text>
          <Text bold>Locales directory:</Text>
          <Text>{step.relativeLocalesDir}</Text>
        </Box>
        <Box gap={1}>
          <Text color="green">✓</Text>
          <Text bold>Project name:</Text>
          <Text>{step.name}</Text>
        </Box>
        <Box gap={1}>
          <Text bold>Source language</Text>
          <Text dimColor>(default: en):</Text>
          <TextInput
            value={sourceLangInput}
            onChange={setSourceLangInput}
            onSubmit={(value) => {
              const lang = value.trim() || 'en'
              setStep({ id: 'locales', relativeLocalesDir: step.relativeLocalesDir, absLocalesDir: step.absLocalesDir, name: step.name, sourceLanguage: lang, detectedLocales: step.detectedLocales })
            }}
          />
        </Box>
      </Box>
    )
  }

  if (step.id === 'locales') {
    const placeholder = step.detectedLocales.length > 0
      ? step.detectedLocales.join(', ')
      : 'es, fr, pt-BR'
    return (
      <Box flexDirection="column" gap={1}>
        <Box gap={1}>
          <Text color="green">✓</Text>
          <Text bold>Locales directory:</Text>
          <Text>{step.relativeLocalesDir}</Text>
        </Box>
        <Box gap={1}>
          <Text color="green">✓</Text>
          <Text bold>Project name:</Text>
          <Text>{step.name}</Text>
        </Box>
        <Box gap={1}>
          <Text color="green">✓</Text>
          <Text bold>Source language:</Text>
          <Text>{step.sourceLanguage}</Text>
        </Box>
        <Box gap={1}>
          <Text bold>Locales</Text>
          <Text dimColor>(comma-separated):</Text>
          <TextInput
            value={localesInput}
            onChange={setLocalesInput}
            placeholder={placeholder}
            onSubmit={(value) => {
              const input = value.trim() || step.detectedLocales.join(', ')
              const locales = input.split(',').map((l) => l.trim()).filter(Boolean)
              setStep({ id: 'creating', relativeLocalesDir: step.relativeLocalesDir, absLocalesDir: step.absLocalesDir, name: step.name, sourceLanguage: step.sourceLanguage, locales })
            }}
          />
        </Box>
      </Box>
    )
  }

  if (step.id === 'creating') {
    return (
      <Box gap={1}>
        <Text color="green"><Spinner type="dots" /></Text>
        <Text>Initializing project…</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Text color="green">✓</Text>
        <Text bold>{step.name}</Text>
        <Text dimColor>initialized</Text>
      </Box>
      <Box gap={1}>
        <Text color="green">✓</Text>
        <Text dimColor>.i18kit.json created</Text>
      </Box>
      <Box gap={1}>
        <Text color="green">✓</Text>
        <Text dimColor>{step.potPath}</Text>
      </Box>
      {step.locales.length > 0 && (
        <Box gap={1}>
          <Text color="green">✓</Text>
          <Text dimColor>Locales: {step.locales.join(', ')}</Text>
        </Box>
      )}
    </Box>
  )
}
