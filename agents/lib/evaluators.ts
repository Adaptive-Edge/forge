import { callClaude } from './claude'
import { logBuild, writeEvaluation } from './supabase'
import { gatekeeperPrompt, skepticPrompt } from './prompts'
import type { BriefWithProject, EvaluationResult } from './types'

function parseEvaluation(output: string): EvaluationResult {
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in Claude response')

  const parsed = JSON.parse(jsonMatch[0])
  if (!['approve', 'reject', 'concern'].includes(parsed.verdict)) {
    throw new Error(`Invalid verdict: ${parsed.verdict}`)
  }

  return {
    verdict: parsed.verdict,
    reasoning: parsed.reasoning,
    suggested_tier: parsed.suggested_tier,
    suggested_impact: parsed.suggested_impact,
    confidence: Math.min(10, Math.max(1, parsed.confidence || 5)),
  }
}

export async function runGatekeeper(brief: BriefWithProject): Promise<EvaluationResult> {
  await logBuild(brief.id, 'Gatekeeper', 'Evaluating brief against outcome hierarchy...')
  console.log('  [Gatekeeper] Evaluating...')

  const output = await callClaude(gatekeeperPrompt(brief))
  const result = parseEvaluation(output)

  await writeEvaluation(brief.id, 'gatekeeper', 'strategic_filter', {
    verdict: result.verdict,
    reasoning: result.reasoning,
    suggestions: {
      suggested_tier: result.suggested_tier,
      suggested_impact: result.suggested_impact,
    },
    confidence: result.confidence,
  })

  const emoji = result.verdict === 'approve' ? '\u2713' : result.verdict === 'reject' ? '\u2717' : '\u26A0'
  await logBuild(
    brief.id,
    'Gatekeeper',
    `${emoji} Brief ${result.verdict}ed \u2014 ${result.reasoning}`,
    result.verdict === 'reject' ? 'warn' : 'info',
    result as unknown as Record<string, unknown>
  )

  console.log(`  [Gatekeeper] ${result.verdict}: ${result.reasoning}`)
  return result
}

export async function runSkeptic(brief: BriefWithProject): Promise<EvaluationResult> {
  await logBuild(brief.id, 'Skeptic', 'Challenging brief assumptions...')
  console.log('  [Skeptic] Evaluating...')

  const output = await callClaude(skepticPrompt(brief))
  const result = parseEvaluation(output)

  await writeEvaluation(brief.id, 'skeptic', 'devils_advocate', {
    verdict: result.verdict,
    reasoning: result.reasoning,
    confidence: result.confidence,
  })

  const emoji = result.verdict === 'approve' ? '\u2713' : result.verdict === 'reject' ? '\u2717' : '\u26A0'
  await logBuild(
    brief.id,
    'Skeptic',
    `${emoji} Brief ${result.verdict}ed \u2014 ${result.reasoning}`,
    result.verdict === 'reject' ? 'warn' : 'info',
    result as unknown as Record<string, unknown>
  )

  console.log(`  [Skeptic] ${result.verdict}: ${result.reasoning}`)
  return result
}
