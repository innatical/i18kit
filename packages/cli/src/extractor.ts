import { parseSync } from '@swc/core'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { createHash } from 'crypto'

export type ExtractedMessage = {
  id: string
  defaultMessage: string
  context?: string
  locations: Array<{ file: string; line: number }>
}

export class StringExtractor {
  private messages = new Map<string, ExtractedMessage>()
  private rootDir = ''

  extract(
    sourceDir: string,
    pattern = /\.(ts|tsx)$/
  ): Map<string, ExtractedMessage> {
    this.messages.clear()
    this.rootDir = sourceDir
    this.walkDirectory(sourceDir, pattern)
    return this.messages
  }

  private walkDirectory(dir: string, pattern: RegExp) {
    const entries = readdirSync(dir)

    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stats = statSync(fullPath)

      if (stats.isDirectory()) {
        if (entry !== 'node_modules' && entry !== '.git' && entry !== 'dist') {
          this.walkDirectory(fullPath, pattern)
        }
      } else if (stats.isFile() && pattern.test(entry)) {
        this.extractFromFile(fullPath)
      }
    }
  }

  private extractFromFile(filePath: string) {
    const content = readFileSync(filePath, 'utf-8')

    try {
      const ast = parseSync(content, {
        syntax: 'typescript',
        tsx: filePath.endsWith('.tsx')
      })

      this.visitNode(ast, filePath, content)
    } catch {
      console.warn(`Warning: Failed to parse ${filePath}`)
    }
  }

  private visitNode(node: any, filePath: string, content: string) {
    if (!node || typeof node !== 'object') return

    if (node.type === 'CallExpression') {
      const calleeName = this.getCalleeName(node.callee)
      if (calleeName === 't' || calleeName === 'tc') {
        this.extractTranslationCall(node, calleeName, filePath, content)
      }
    } else if (node.type === 'TaggedTemplateExpression') {
      const tagName = this.getCalleeName(node.tag)
      if (tagName === 't' || tagName === 'tc') {
        this.extractTaggedTemplate(node, filePath, content)
      }
    }

    for (const key in node) {
      if (key !== 'span' && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.visitNode(child, filePath, content)
          }
        } else {
          this.visitNode(node[key], filePath, content)
        }
      }
    }
  }

  private extractTranslationCall(node: any, fnName: string, filePath: string, content: string) {
    const args = node.arguments || []
    if (args.length === 0) return

    let context: string | undefined
    let messageArg: any
    let startArgIndex = 0

    if (fnName === 'tc') {
      if (args.length < 2) return
      const contextArg = args[0]
      if (contextArg.type === 'StringLiteral') context = contextArg.value
      startArgIndex = 1
    }

    messageArg = args[startArgIndex]

    let message: string | null = null
    if (messageArg.type === 'StringLiteral') {
      message = messageArg.value
    } else if (messageArg.type === 'TemplateLiteral') {
      message = this.extractTemplateMessage(messageArg)
    }

    if (message) {
      const id = this.generateId(message, context)
      const line = this.getLineNumber(node, content)
      const relPath = relative(this.rootDir, filePath)
      this.addMessage(id, message, context, relPath, line)
    }
  }

  private extractTaggedTemplate(node: any, filePath: string, content: string) {
    const template = node.template
    if (!template) return

    const message = template.type === 'TemplateLiteral'
      ? this.extractTemplateMessage(template)
      : null

    if (message) {
      const id = this.generateId(message)
      const line = this.getLineNumber(node, content)
      const relPath = relative(this.rootDir, filePath)
      this.addMessage(id, message, undefined, relPath, line)
    }
  }

  private extractTemplateMessage(templateNode: any): string | null {
    const quasis = templateNode.quasis || []
    let message = ''
    let valueIndex = 0

    for (let i = 0; i < quasis.length; i++) {
      const quasi = quasis[i]
      message += quasi.cooked || quasi.raw || ''
      if (!quasi.tail && i < quasis.length - 1) {
        message += `{${valueIndex}}`
        valueIndex++
      }
    }

    return message || null
  }

  private getCalleeName(callee: any): string | null {
    if (callee?.type === 'Identifier') return callee.value
    if (callee?.type === 'MemberExpression') {
      return callee.property?.value || callee.property?.name || null
    }
    return null
  }

  private getLineNumber(node: any, content: string): number {
    if (node.span?.start !== undefined) {
      return content.substring(0, node.span.start).split('\n').length
    }
    return 1
  }

  private generateId(message: string, context?: string): string {
    const hash = createHash('sha256')
    hash.update(message)
    if (context) hash.update(`|${context}`)
    return hash.digest('hex').substring(0, 16)
  }

  private addMessage(id: string, defaultMessage: string, context: string | undefined, file: string, line: number) {
    const existing = this.messages.get(id)
    if (existing) {
      existing.locations.push({ file, line })
    } else {
      this.messages.set(id, { id, defaultMessage, context, locations: [{ file, line }] })
    }
  }
}
