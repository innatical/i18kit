import { useEffect, useState } from 'react'
import { Box, Text, useApp } from 'ink'
import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'

type State =
  | { status: 'running' }
  | { status: 'done' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }

function launchApp(): Promise<void> {
  return new Promise((resolve, reject) => {
    let command: string
    let args: string[]

    if (process.platform === 'darwin') {
      command = 'open'
      args = ['-a', 'i18kit']
    } else if (process.platform === 'win32') {
      command = 'cmd'
      args = ['/c', 'start', '', 'i18kit']
    } else {
      command = 'i18kit-app'
      args = []
    }

    const child = spawn(command, args, { detached: true, stdio: 'ignore' })
    child.unref()
    child.on('error', reject)
    child.on('spawn', resolve)
  })
}

export function Open() {
  const { exit } = useApp()
  const [state, setState] = useState<State>({ status: 'running' })

  useEffect(() => {
    const configPath = join(process.cwd(), '.i18kit.json')

    if (!existsSync(configPath)) {
      setState({ status: 'not-found' })
      exit(new Error('no config'))
      return
    }

    launchApp()
      .then(() => {
        setState({ status: 'done' })
        exit()
      })
      .catch((err: Error) => {
        setState({ status: 'error', message: err.message })
        exit(err)
      })
  }, [])

  if (state.status === 'running') {
    return <Text dimColor>Opening i18kit…</Text>
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
        <Text color="red">Failed to open i18kit: {state.message}</Text>
        <Text dimColor>Make sure i18kit is installed on your system</Text>
      </Box>
    )
  }

  return (
    <Box gap={1}>
      <Text color="green">✓</Text>
      <Text>Opened i18kit</Text>
    </Box>
  )
}
