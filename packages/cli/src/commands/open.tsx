import { useEffect, useState } from 'react'
import { Box, Text, useApp } from 'ink'
import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { startServer } from '../server/index.js'

type State =
  | { status: 'starting' }
  | { status: 'running'; url: string; opened: boolean }
  | { status: 'not-found' }
  | { status: 'error'; message: string }

function openBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let command: string
    let args: string[]

    if (process.platform === 'darwin') {
      command = 'open'
      args = [url]
    } else if (process.platform === 'win32') {
      command = 'cmd'
      args = ['/c', 'start', '', url]
    } else {
      command = 'xdg-open'
      args = [url]
    }

    const child = spawn(command, args, { detached: true, stdio: 'ignore' })
    child.unref()
    child.on('error', reject)
    child.on('spawn', resolve)
  })
}

type Props = { port?: number; noOpen?: boolean }

export function Open({ port, noOpen }: Props) {
  const { exit } = useApp()
  const [state, setState] = useState<State>({ status: 'starting' })

  useEffect(() => {
    const root = process.cwd()

    if (!existsSync(join(root, '.i18kit.json'))) {
      setState({ status: 'not-found' })
      exit(new Error('no config'))
      return
    }

    let closeServer: (() => Promise<void>) | undefined

    startServer({ root, port })
      .then(async (server) => {
        closeServer = server.close
        const opened = !noOpen && (await openBrowser(server.url).then(() => true, () => false))
        setState({ status: 'running', url: server.url, opened })
      })
      .catch((err: Error) => {
        setState({ status: 'error', message: err.message })
        exit(err)
      })

    return () => {
      closeServer?.()
    }
  }, [])

  if (state.status === 'starting') {
    return <Text dimColor>Starting i18kit…</Text>
  }

  if (state.status === 'not-found') {
    return (
      <Box flexDirection="column">
        <Text color="red">No .i18kit.json found</Text>
        <Text dimColor>Run <Text color="cyan">i18kit init</Text> to set up this project first</Text>
      </Box>
    )
  }

  if (state.status === 'error') {
    return (
      <Box flexDirection="column">
        <Text color="red">Failed to start i18kit: {state.message}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color="green">✓</Text>
        <Text>{state.opened ? 'Opened i18kit in your browser' : 'i18kit is running'}</Text>
      </Box>
      <Text dimColor>
        {state.opened ? 'If it did not open, use this one-time link: ' : 'Open this one-time link: '}
        <Text color="cyan">{state.url}</Text>
      </Text>
      <Text dimColor>Press Ctrl+C to stop</Text>
    </Box>
  )
}
