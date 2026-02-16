import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

export async function POST(request: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 }
    )
  }

  const { transcript } = await request.json()

  if (!transcript || typeof transcript !== 'string') {
    return NextResponse.json(
      { error: 'transcript is required' },
      { status: 400 }
    )
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `You extract structured briefs from voice transcripts for a software build queue called The Forge.

Given a raw transcript, extract:
- title: Short, clear title (under 60 chars)
- brief: A clear 1-3 sentence description of what to build
- outcome_tier: 1 (Foundation: Health/Family), 2 (Leverage: Productivity), 3 (Growth: Revenue/Client Value), 4 (Reach: Brand/Awareness)
- outcome_type: One of: "Health & Wellbeing", "Family", "Productivity & Time", "Efficiency", "Revenue Potential", "Client Value", "Project Goals", "Brand Awareness", "Customer Attraction"
- impact_score: 1-10 integer
- acceptance_criteria: Array of 2-4 specific "done when" statements

Respond with ONLY valid JSON, no markdown fences.`,
        messages: [
          {
            role: 'user',
            content: `Extract a structured brief from this voice transcript:\n\n"${transcript}"`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Anthropic API error:', error)
      return NextResponse.json(
        { error: 'Failed to process transcript' },
        { status: 502 }
      )
    }

    const data = await response.json()
    const text = data.content[0]?.text || ''

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
