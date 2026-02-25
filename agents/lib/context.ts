import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const HOME = process.env.HOME || '/Users/nathan'

const GLOBAL_CLAUDE_MD = join(HOME, '.claude', 'CLAUDE.md')
const GLOBAL_MEMORY_MD = join(HOME, '.claude', 'projects', '-Users-nathan', 'memory', 'MEMORY.md')

function readIfExists(filePath: string): string | null {
  if (existsSync(filePath)) {
    try {
      return readFileSync(filePath, 'utf8')
    } catch {
      return null
    }
  }
  return null
}

/**
 * Load context files that give agents the same knowledge as interactive Claude Code.
 * Returns a string to prepend to agent prompts.
 */
export function loadAgentContext(projectPath?: string | null): string {
  const sections: string[] = []

  // Global CLAUDE.md — deployment rules, safety protocols, server details
  const globalClaude = readIfExists(GLOBAL_CLAUDE_MD)
  if (globalClaude) {
    sections.push(`## Global Instructions (from ~/.claude/CLAUDE.md)\n\n${globalClaude}`)
  }

  // Global memory — accumulated knowledge across all projects
  const memory = readIfExists(GLOBAL_MEMORY_MD)
  if (memory) {
    sections.push(`## Cross-Project Memory\n\n${memory}`)
  }

  // Project-specific CLAUDE.md
  if (projectPath) {
    const projectClaude = readIfExists(join(projectPath, 'CLAUDE.md'))
    if (projectClaude) {
      sections.push(`## Project Instructions (from ${projectPath}/CLAUDE.md)\n\n${projectClaude}`)
    }
  }

  if (sections.length === 0) return ''

  return `# Context (injected by Forge — same knowledge as interactive Claude Code)\n\n${sections.join('\n\n---\n\n')}\n\n---\n\n`
}
