import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

function callClaude(prompt: string, model = 'haiku'): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env }
    delete env.CLAUDECODE

    const proc = spawn('claude', ['-p', '--model', model], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      cwd: '/tmp',
    })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`Claude exited with code ${code}: ${stderr}`))
      else resolve(stdout.trim())
    })

    proc.on('error', (err) => reject(new Error(`Failed to spawn claude: ${err.message}`)))

    proc.stdin.write(prompt)
    proc.stdin.end()
  })
}

export async function POST(request: NextRequest) {
  const { transcript } = await request.json()

  if (!transcript || typeof transcript !== 'string') {
    return NextResponse.json(
      { error: 'transcript is required' },
      { status: 400 }
    )
  }

  try {
    const prompt = `You extract structured briefs from voice transcripts for a software build queue called The Forge.

Given a raw transcript, extract:
- title: Short, clear title (under 60 chars)
- brief: A clear 1-3 sentence description of what to build
- outcome_tier: 1 (Foundation: Health/Family), 2 (Leverage: Productivity), 3 (Growth: Revenue/Client Value), 4 (Reach: Brand/Awareness)
- outcome_type: One of: "Health & Wellbeing", "Family", "Productivity & Time", "Efficiency", "Revenue Potential", "Client Value", "Project Goals", "Brand Awareness", "Customer Attraction"
- impact_score: 1-10 integer
- acceptance_criteria: Array of 2-4 specific "done when" statements

Respond with ONLY valid JSON, no markdown fences.

Extract a structured brief from this voice transcript:

"${transcript}"`

    const text = await callClaude(prompt)

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Failed to parse structured brief from response' },
        { status: 502 }
      )
    }

    const structured = JSON.parse(jsonMatch[0])
    return NextResponse.json(structured)
  } catch (err) {
    console.error('Sharpen brief error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
