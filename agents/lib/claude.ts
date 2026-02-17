import { spawn } from 'child_process'
import { existsSync } from 'fs'

export function callClaude(
  prompt: string,
  options: {
    model?: string
    cwd?: string
    allowedTools?: string[]
  } = {}
): Promise<string> {
  let { model = 'haiku', cwd = '/tmp', allowedTools } = options

  // Validate cwd exists — local_path may be a Mac path when running on server
  if (cwd && !existsSync(cwd)) {
    console.log(`  [callClaude] cwd "${cwd}" not found, falling back to /tmp (no file tools)`)
    cwd = '/tmp'
    allowedTools = undefined
  }

  return new Promise((resolve, reject) => {
    const env = { ...process.env }
    delete env.CLAUDECODE

    const args = ['-p', '--model', model]
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
      } else {
        resolve(stdout.trim())
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`))
    })

    proc.stdin.write(prompt)
    proc.stdin.end()
  })
}
