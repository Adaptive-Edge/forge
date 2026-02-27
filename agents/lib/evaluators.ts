import { callClaude } from './claude'
import { logBuild, writeEvaluation } from './supabase'
import { gatekeeperPrompt, skepticPrompt, cynicPrompt, accountantPrompt, brandGuardianPrompt, type BriefHistoryItem } from './prompts'
import type { BriefWithProject, EvaluationResult, ClaudeResult } from './types'

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

  const { result, inputTokens, outputTokens, model } = await callClaude(gatekeeperPrompt(brief, history))
  const evaluation = parseEvaluation(result)

  await writeEvaluation(brief.id, 'gatekeeper', 'strategic_filter', {
    verdict: evaluation.verdict,
    reasoning: evaluation.reasoning,
    suggestions: {
      suggested_tier: evaluation.suggested_tier,
      suggested_impact: evaluation.suggested_impact,
    },
    confidence: evaluation.confidence,
  })

  const emoji = evaluation.verdict === 'approve' ? '\u2713' : evaluation.verdict === 'reject' ? '\u2717' : '\u26A0'
  await logBuild(
    brief.id,
    'Gatekeeper',
    `${emoji} Brief ${evaluation.verdict === 'approve' ? 'approved' : evaluation.verdict + 'ed'} \u2014 ${evaluation.reasoning}`,
    evaluation.verdict === 'reject' ? 'warn' : 'info',
    evaluation as unknown as Record<string, unknown>,
    { inputTokens, outputTokens, model }
  )

  console.log(`  [Gatekeeper] ${evaluation.verdict}: ${evaluation.reasoning}`)
  return evaluation
}

export async function runSkeptic(brief: BriefWithProject, _history?: BriefHistoryItem[]): Promise<EvaluationResult> {
  await logBuild(brief.id, 'Skeptic', 'Challenging brief assumptions...')
  console.log('  [Skeptic] Evaluating...')

  const { result, inputTokens, outputTokens, model } = await callClaude(skepticPrompt(brief))
  const evaluation = parseEvaluation(result)

  await writeEvaluation(brief.id, 'skeptic', 'devils_advocate', {
    verdict: evaluation.verdict,
    reasoning: evaluation.reasoning,
    confidence: evaluation.confidence,
  })

  const emoji = evaluation.verdict === 'approve' ? '\u2713' : evaluation.verdict === 'reject' ? '\u2717' : '\u26A0'
  await logBuild(
    brief.id,
    'Skeptic',
    `${emoji} Brief ${evaluation.verdict === 'approve' ? 'approved' : evaluation.verdict + 'ed'} \u2014 ${evaluation.reasoning}`,
    evaluation.verdict === 'reject' ? 'warn' : 'info',
    evaluation as unknown as Record<string, unknown>,
    { inputTokens, outputTokens, model }
  )

  console.log(`  [Skeptic] ${evaluation.verdict}: ${evaluation.reasoning}`)
  return evaluation
}

export async function runCynic(brief: BriefWithProject, history?: BriefHistoryItem[]): Promise<EvaluationResult> {
  await logBuild(brief.id, 'Cynic', 'Checking for patterns and displacement activity...')
  console.log('  [Cynic] Evaluating...')

  const { result, inputTokens, outputTokens, model } = await callClaude(cynicPrompt(brief, history))
  const evaluation = parseEvaluation(result)

  await writeEvaluation(brief.id, 'cynic', 'behavioural_check', {
    verdict: evaluation.verdict,
    reasoning: evaluation.reasoning,
    confidence: evaluation.confidence,
  })

  const emoji = evaluation.verdict === 'approve' ? '\u2713' : evaluation.verdict === 'reject' ? '\u2717' : '\u26A0'
  await logBuild(
    brief.id,
    'Cynic',
    `${emoji} Brief ${evaluation.verdict === 'approve' ? 'approved' : evaluation.verdict + 'ed'} \u2014 ${evaluation.reasoning}`,
    evaluation.verdict === 'reject' ? 'warn' : 'info',
    evaluation as unknown as Record<string, unknown>,
    { inputTokens, outputTokens, model }
  )

  console.log(`  [Cynic] ${evaluation.verdict}: ${evaluation.reasoning}`)
  return evaluation
}

export async function runAccountant(brief: BriefWithProject, history?: BriefHistoryItem[]): Promise<EvaluationResult> {
  await logBuild(brief.id, 'Accountant', 'Calculating cost vs return...')
  console.log('  [Accountant] Evaluating...')

  const { result, inputTokens, outputTokens, model } = await callClaude(accountantPrompt(brief, history))
  const evaluation = parseEvaluation(result)

  await writeEvaluation(brief.id, 'accountant', 'cost_analysis', {
    verdict: evaluation.verdict,
    reasoning: evaluation.reasoning,
    confidence: evaluation.confidence,
  })

  const emoji = evaluation.verdict === 'approve' ? '\u2713' : evaluation.verdict === 'reject' ? '\u2717' : '\u26A0'
  await logBuild(
    brief.id,
    'Accountant',
    `${emoji} Brief ${evaluation.verdict === 'approve' ? 'approved' : evaluation.verdict + 'ed'} \u2014 ${evaluation.reasoning}`,
    evaluation.verdict === 'reject' ? 'warn' : 'info',
    evaluation as unknown as Record<string, unknown>,
    { inputTokens, outputTokens, model }
  )

  console.log(`  [Accountant] ${evaluation.verdict}: ${evaluation.reasoning}`)
  return evaluation
}

export async function runBrandGuardian(brief: BriefWithProject): Promise<BrandGuardianResult> {
  const prUrl = brief.pr_url
  if (!prUrl) throw new Error('No PR URL — cannot run brand review')

  const localPath = brief.project?.local_path

  await logBuild(brief.id, 'Brand Guardian', 'Reviewing PR for design system violations...')
  console.log('  [Brand Guardian] Reviewing PR diff...')

  const { result: output, inputTokens, outputTokens, model } = await callClaude(brandGuardianPrompt(brief, prUrl), {
    model: 'sonnet',
    ...(localPath && {
      cwd: localPath,
      allowedTools: ['Read', 'Glob', 'Grep', 'Bash'],
    }),
  })

  const jsonMatch = output.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in Brand Guardian response')

  const parsed = JSON.parse(jsonMatch[0])
  const evaluation: BrandGuardianResult = {
    verdict: parsed.verdict,
    reasoning: parsed.reasoning,
    confidence: Math.min(10, Math.max(1, parsed.confidence || 5)),
    concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
  }

  await writeEvaluation(brief.id, 'brand-guardian', 'brand_review', {
    verdict: evaluation.verdict,
    reasoning: evaluation.reasoning,
    confidence: evaluation.confidence,
    suggestions: evaluation.concerns.length > 0 ? { concerns: evaluation.concerns } : undefined,
  })

  const emoji = evaluation.verdict === 'approve' ? '\u2713' : evaluation.verdict === 'reject' ? '\u2717' : '\u26A0'
  const concernSummary = evaluation.concerns.length > 0
    ? ` (${evaluation.concerns.length} violation${evaluation.concerns.length === 1 ? '' : 's'} found)`
    : ''
  await logBuild(
    brief.id,
    'Brand Guardian',
    `${emoji} Brand review: ${evaluation.verdict}${concernSummary} \u2014 ${evaluation.reasoning}`,
    evaluation.verdict === 'approve' ? 'info' : 'warn',
    { concerns: evaluation.concerns } as unknown as Record<string, unknown>,
    { inputTokens, outputTokens, model }
  )

  console.log(`  [Brand Guardian] ${evaluation.verdict}: ${evaluation.reasoning}${concernSummary}`)
  return evaluation
}

export { parseEvaluation }
