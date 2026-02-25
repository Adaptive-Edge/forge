import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const HOME = process.env.HOME || '/Users/nathan'
const SKILLS_DIR = join(HOME, '.claude', 'skills')

export type SkillManifest = {
  name: string
  description: string
  skillFile: string
  files: string[]
}

/**
 * Discover all installed skills from ~/.claude/skills/
 * Returns a manifest with name, description, and file paths for each skill.
 */
export function discoverSkills(): SkillManifest[] {
  if (!existsSync(SKILLS_DIR)) return []

  const skills: SkillManifest[] = []

  for (const dir of readdirSync(SKILLS_DIR)) {
    const skillDir = join(SKILLS_DIR, dir)
    if (!statSync(skillDir).isDirectory()) continue

    const skillFile = join(skillDir, 'SKILL.md')
    if (!existsSync(skillFile)) continue

    const content = readFileSync(skillFile, 'utf8')

    // Extract name and description from frontmatter
    const nameMatch = content.match(/^name:\s*(.+)$/m)
    const descMatch = content.match(/^description:\s*(.+)$/m)

    // Recursively find all files in this skill directory
    const files = getAllFiles(skillDir)

    skills.push({
      name: nameMatch?.[1] || dir,
      description: descMatch?.[1] || '',
      skillFile,
      files,
    })
  }

  return skills
}

function getAllFiles(dir: string, base?: string): string[] {
  const result: string[] = []
  const root = base || dir

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      result.push(...getAllFiles(full, root))
    } else {
      result.push(full)
    }
  }

  return result
}

/**
 * Generate a concise skill manifest for injection into agent prompts.
 * Lists available skills with descriptions and file paths so agents can
 * Read specific files they need.
 */
export function formatSkillManifest(skills: SkillManifest[]): string {
  if (skills.length === 0) return ''

  const sections = skills.map(s => {
    const fileList = s.files.map(f => `  - ${f}`).join('\n')
    return `### ${s.name}
${s.description}

Files:
${fileList}`
  })

  return `## Available Skills (from ~/.claude/skills/)

These skills contain domain knowledge, templates, workflows, and helper code.
Use the Read tool to load any file you need for the task.

${sections.join('\n\n')}`
}

/**
 * Load the full content of a specific skill's SKILL.md and any critical files.
 * Used when we know which skill a task needs.
 */
export function loadSkillContent(skillName: string): string | null {
  const skillDir = join(SKILLS_DIR, skillName)
  const skillFile = join(skillDir, 'SKILL.md')

  if (!existsSync(skillFile)) return null

  return readFileSync(skillFile, 'utf8')
}

/**
 * Load cognitive design rules from the adaptive-edge-playbook.
 * These are flagged as "ALWAYS load first" for any workshop/facilitation task.
 */
export function loadCognitiveDesignRules(): string | null {
  const path = join(SKILLS_DIR, 'adaptive-edge-playbook', 'context', 'cognitive-design.md')
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf8')
}
