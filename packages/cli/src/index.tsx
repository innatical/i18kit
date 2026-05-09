#!/usr/bin/env node
import { render } from 'ink'
import { parseArgs } from 'util'

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: 'boolean', short: 'h' },
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
    const { waitUntilExit } = render(<Open />)
    await waitUntilExit()
    break
  }
  default: {
    const { Help } = await import('./commands/help.js')
    render(<Help error={`Unknown command: ${command}`} />)
    process.exit(1)
  }
}
