import { callClaude } from './claude'
import { logBuild, writeEvaluation } from './supabase'
import { gatekeeperPrompt, skepticPrompt, cynicPrompt, accountantPrompt, brandGuardianPrompt, type BriefHistoryItem } from './prompts'
import type { BriefWithProject, EvaluationResult } from './types'

export type BrandConcern = {
  file: string
  line: number
  rule: string
  description: string
}

export type BrandGuardianResult = EvaluationResult & {
  concerns: BrandConcern[]
}

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

export async function runGatekeeper(brief: BriefWithProject, history?: BriefHistoryItem[]): Promise<EvaluationResult> {
  await logBuild(brief.id, 'Gatekeeper', 'Evaluating brief against outcome hierarchy...')
  console.log('  [Gatekeeper] Evaluating...')

  const output = await callClaude(gatekeeperPrompt(brief, history))
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
    `${emoji} Brief ${result.verdict === 'approve' ? 'approved' : result.verdict + 'ed'} \u2014 ${result.reasoning}`,
    result.verdict === 'reject' ? 'warn' : 'info',
    result as unknown as Record<string, unknown>
  )

  console.log(`  [Gatekeeper] ${result.verdict}: ${result.reasoning}`)
  return result
}

export async function runSkeptic(brief: BriefWithProject, _history?: BriefHistoryItem[]): Promise<EvaluationResult> {
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
    `${emoji} Brief ${result.verdict === 'approve' ? 'approved' : result.verdict + 'ed'} \u2014 ${result.reasoning}`,
    result.verdict === 'reject' ? 'warn' : 'info',
    result as unknown as Record<string, unknown>
  )

  console.log(`  [Skeptic] ${result.verdict}: ${result.reasoning}`)
  return result
}

export async function runCynic(brief: BriefWithProject, history?: BriefHistoryItem[]): Promise<EvaluationResult> {
  await logBuild(brief.id, 'Cynic', 'Checking for patterns and displacement activity...')
  console.log('  [Cynic] Evaluating...')

  const output = await callClaude(cynicPrompt(brief, history))
  const result = parseEvaluation(output)

  await writeEvaluation(brief.id, 'cynic', 'behavioural_check', {
    verdict: result.verdict,
    reasoning: result.reasoning,
    confidence: result.confidence,
  })

  const emoji = result.verdict === 'approve' ? '\u2713' : result.verdict === 'reject' ? '\u2717' : '\u26A0'
  await logBuild(
    brief.id,
    'Cynic',
    `${emoji} Brief ${result.verdict === 'approve' ? 'approved' : result.verdict + 'ed'} \u2014 ${result.reasoning}`,
    result.verdict === 'reject' ? 'warn' : 'info',
    result as unknown as Record<string, unknown>
  )

  console.log(`  [Cynic] ${result.verdict}: ${result.reasoning}`)
  return result
}

export async function runAccountant(brief: BriefWithProject, history?: BriefHistoryItem[]): Promise<EvaluationResult> {
  await logBuild(brief.id, 'Accountant', 'Calculating cost vs return...')
  console.log('  [Accountant] Evaluating...')

  const output = await callClaude(accountantPrompt(brief, history))
  const result = parseEvaluation(output)

  await writeEvaluation(brief.id, 'accountant', 'cost_analysis', {
    verdict: result.verdict,
    reasoning: result.reasoning,
    confidence: result.confidence,
  })

  const emoji = result.verdict === 'approve' ? '\u2713' : result.verdict === 'reject' ? '\u2717' : '\u26A0'
  await logBuild(
    brief.id,
    'Accountant',
    `${emoji} Brief ${result.verdict === 'approve' ? 'approved' : result.verdict + 'ed'} \u2014 ${result.reasoning}`,
    result.verdict === 'reject' ? 'warn' : 'info',
    result as unknown as Record<string, unknown>
  )

  console.log(`  [Accountant] ${result.verdict}: ${result.reasoning}`)
  return result
}

export async function runBrandGuardian(brief: BriefWithProject): Promise<BrandGuardianResult> {
  const prUrl = brief.pr_url
  if (!prUrl) throw new Error('No PR URL — cannot run brand review')

  const localPath = brief.project?.local_path

  await logBuild(brief.id, 'Brand Guardian', 'Reviewing PR for design system violations...')
  console.log('  [Brand Guardian] Reviewing PR diff...')

  const output = await callClaude(brandGuardianPrompt(brief, prUrl), {
    model: 'sonnet',
    ...(localPath && {
      cwd: localPath,
      allowedTools: ['Read', 'Glob', 'Grep', 'Bash'],
    }),
  })

  const jsonMatch = output.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in Brand Guardian response')

  const parsed = JSON.parse(jsonMatch[0])
  const result: BrandGuardianResult = {
    verdict: parsed.verdict,
    reasoning: parsed.reasoning,
    confidence: Math.min(10, Math.max(1, parsed.confidence || 5)),
    concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
  }

  await writeEvaluation(brief.id, 'brand-guardian', 'brand_review', {
    verdict: result.verdict,
    reasoning: result.reasoning,
    confidence: result.confidence,
    suggestions: result.concerns.length > 0 ? { concerns: result.concerns } : undefined,
  })

  const emoji = result.verdict === 'approve' ? '\u2713' : result.verdict === 'reject' ? '\u2717' : '\u26A0'
  const concernSummary = result.concerns.length > 0
    ? ` (${result.concerns.length} violation${result.concerns.length === 1 ? '' : 's'} found)`
    : ''
  await logBuild(
    brief.id,
    'Brand Guardian',
    `${emoji} Brand review: ${result.verdict}${concernSummary} \u2014 ${result.reasoning}`,
    result.verdict === 'approve' ? 'info' : 'warn',
    { concerns: result.concerns } as unknown as Record<string, unknown>
  )

  console.log(`  [Brand Guardian] ${result.verdict}: ${result.reasoning}${concernSummary}`)
  return result
}

export { parseEvaluation }
