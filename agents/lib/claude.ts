import { spawn } from 'child_process'
import { existsSync } from 'fs'
import type { ClaudeResult } from './types'

// Mac → server path mappings for when orchestrator runs on server
const PATH_MAPPINGS: [string, string][] = [
  ['/Users/nathan/forge', '/var/www/forge'],
  ['/Users/nathan/adaptive-edge-apps', '/var/www/adaptive-edge-apps'],
  ['/Users/nathan/agents/', '/home/nathan/agents/'],
]

function resolveServerPath(macPath: string): string | null {
  for (const [macPrefix, serverPrefix] of PATH_MAPPINGS) {
    if (macPath.startsWith(macPrefix)) {
      const resolved = macPath.replace(macPrefix, serverPrefix)
      if (existsSync(resolved)) return resolved
    }
  }
  return null
}

export function callClaude(
  prompt: string,
  options: {
    model?: string
    cwd?: string
    allowedTools?: string[]
  } = {}
): Promise<ClaudeResult> {
  let { model = 'haiku', cwd = '/tmp', allowedTools } = options

  // Resolve cwd — local_path may be a Mac path when running on server
  if (cwd && !existsSync(cwd)) {
    // Try known Mac → server path mappings
    const serverPath = resolveServerPath(cwd)
    if (serverPath) {
      console.log(`  [callClaude] Resolved "${cwd}" → "${serverPath}"`)
      cwd = serverPath
    } else {
      console.log(`  [callClaude] cwd "${cwd}" not found, falling back to /tmp (no file tools)`)
      cwd = '/tmp'
      allowedTools = undefined
    }
  }

  return new Promise((resolve, reject) => {
    const env = { ...process.env }
    delete env.CLAUDECODE

    const args = ['-p', '--model', model, '--output-format', 'json']
    if (allowedTools) {
      args.push('--allowedTools', ...allowedTools)
    }

    const proc = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      cwd,
    })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude exited with code ${code}: ${stderr}`))
        return
      }

      // Try to parse JSON output format
      try {
        const parsed = JSON.parse(stdout.trim())
        resolve({
          result: parsed.result || parsed.content || stdout.trim(),
          inputTokens: parsed.input_tokens || parsed.usage?.input_tokens || 0,
          outputTokens: parsed.output_tokens || parsed.usage?.output_tokens || 0,
          model: parsed.model || model,
        })
      } catch {
        // Fallback: raw text output (e.g. older Claude CLI)
        resolve({
          result: stdout.trim(),
          inputTokens: 0,
          outputTokens: 0,
          model,
        })
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`))
    })

    proc.stdin.write(prompt)
    proc.stdin.end()
  })
}
