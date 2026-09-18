#!/usr/bin/env node
import { render } from 'ink'
import { parseArgs } from 'util'

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: 'boolean', short: 'h' },
    port: { type: 'string' },
    'no-open': { type: 'boolean' },
  },
  allowPositionals: true
})

const command = positionals[0]
const arg1 = positionals[1]

if (values.help || !command || command === 'help') {
  const { Help } = await import('./commands/help.js')
  render(<Help />)
  process.exit(0)
}

switch (command) {
  case 'extract': {
    const { Extract } = await import('./commands/extract.js')
    const { waitUntilExit } = render(<Extract dir={arg1} />)
    await waitUntilExit()
    break
  }
  case 'init': {
    const { Init } = await import('./commands/init.js')
    const { waitUntilExit } = render(<Init />)
    await waitUntilExit()
    break
  }
  case 'open': {
    const { Open } = await import('./commands/open.js')
    const port = values.port === undefined ? undefined : Number(values.port)
    if (port !== undefined && !(Number.isInteger(port) && port >= 0 && port < 65536)) {
      const { Help } = await import('./commands/help.js')
      render(<Help error={`Invalid port: ${values.port}`} />)
      process.exit(1)
    }
    const { waitUntilExit } = render(<Open port={port} noOpen={values['no-open']} />)
    await waitUntilExit()
    break
  }
  default: {
    const { Help } = await import('./commands/help.js')
    render(<Help error={`Unknown command: ${command}`} />)
    process.exit(1)
  }
}
