import { Box, Text } from 'ink'

type Props = { error?: string }

export function Help({ error }: Props) {
  return (
    <Box flexDirection="column" gap={1}>
      {error && <Text color="red">{error}</Text>}
      <Box flexDirection="column">
        <Text bold>i18kit</Text>
        <Text dimColor>i18n translation toolkit</Text>
      </Box>
      <Box flexDirection="column">
        <Text bold>Usage</Text>
        <Text>  i18kit {'<command>'} [options]</Text>
      </Box>
      <Box flexDirection="column">
        <Text bold>Commands</Text>
        <Text>  <Text color="green">extract</Text> [dir]            Extract t() and tc() calls, update i18kit.pot</Text>
        <Text>  <Text color="green">init</Text>                     Initialize project, create .i18n.json and i18kit.pot</Text>
        <Text>  <Text color="green">stats</Text>                    Show translation coverage</Text>
        <Text>  <Text color="green">open</Text>                     Open project in i18kit</Text>
      </Box>
    </Box>
  )
}
