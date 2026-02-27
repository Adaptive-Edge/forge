import { createClient } from '@supabase/supabase-js'
import type { Verdict } from './types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export async function logBuild(
  briefId: string,
  agent: string,
  action: string,
  level: string = 'info',
  details?: Record<string, unknown>,
  usage?: { inputTokens?: number; outputTokens?: number; model?: string }
) {
  await supabase.from('build_logs').insert({
    brief_id: briefId,
    agent,
    action,
    log_level: level,
    ...(details && { details }),
    ...(usage?.inputTokens && { input_tokens: usage.inputTokens }),
    ...(usage?.outputTokens && { output_tokens: usage.outputTokens }),
    ...(usage?.model && { model: usage.model }),
  })
}

export async function writeEvaluation(
  briefId: string,
  agentSlug: string,
  evaluationType: string,
  result: {
    verdict: string
    reasoning: string
    suggestions?: Record<string, unknown>
    confidence: number
  }
) {
  await supabase.from('agent_evaluations').insert({
    brief_id: briefId,
    agent_slug: agentSlug,
    evaluation_type: evaluationType,
    verdict: result.verdict,
    reasoning: result.reasoning,
    suggestions: result.suggestions || null,
    confidence: Math.min(10, Math.max(1, result.confidence)),
  })
}

export async function updateBrief(
  briefId: string,
  updates: Record<string, unknown>
) {
  await supabase.from('briefs').update({
    ...updates,
    updated_at: new Date().toISOString(),
  }).eq('id', briefId)
}

export async function fetchBriefWithProject(briefId: string) {
  const { data: brief, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('id', briefId)
    .single()

  if (error || !brief) {
    throw new Error(`Failed to fetch brief: ${error?.message || 'not found'}`)
  }

  let project = null
  if (brief.project_id) {
    const { data } = await supabase
      .from('projects')
      .select('name, repo_url, default_branch, deployment_notes, local_path, context_notes')
      .eq('id', brief.project_id)
      .single()
    project = data
  }

  return { ...brief, project }
}

export async function writeDeliberationRound(
  briefId: string,
  agentSlug: string,
  round: number,
  result: { verdict: Verdict; reasoning: string; confidence: number },
  revisedFrom?: Verdict
) {
  await supabase.from('deliberation_rounds').insert({
    brief_id: briefId,
    agent_slug: agentSlug,
    round,
    verdict: result.verdict,
    reasoning: result.reasoning,
    confidence: Math.min(10, Math.max(1, result.confidence)),
    revised_from: revisedFrom || null,
  })
}

export async function fetchDeliberationRounds(briefId: string, round?: number) {
  let query = supabase
    .from('deliberation_rounds')
    .select('*')
    .eq('brief_id', briefId)
    .order('created_at', { ascending: true })

  if (round !== undefined) {
    query = query.eq('round', round)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch deliberation rounds: ${error.message}`)
  return data || []
}

export async function fetchBriefHistory(limit = 20) {
  const { data: briefs, error } = await supabase
    .from('briefs')
    .select('id, title, status, outcome_tier, impact_score, estimated_hours, actual_hours, created_at, pipeline_stage')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to fetch brief history: ${error.message}`)

  // Fetch decision reports for these briefs
  const briefIds = (briefs || []).map(b => b.id)
  const { data: reports } = await supabase
    .from('decision_reports')
    .select('brief_id, decision, weighted_score')
    .in('brief_id', briefIds)

  const reportMap = new Map(
    (reports || []).map(r => [r.brief_id, r])
  )

  return (briefs || []).map(b => ({
    title: b.title,
    status: b.status,
    tier: b.outcome_tier,
    impact: b.impact_score,
    weighted_score: reportMap.get(b.id)?.weighted_score || null,
    decision: reportMap.get(b.id)?.decision || null,
    estimated_hours: b.estimated_hours,
    actual_hours: b.actual_hours,
    created_at: b.created_at,
  }))
}

export async function writeDecisionReport(
  briefId: string,
  report: {
    decision: 'approved' | 'rejected'
    summary: string
    weighted_score: number
    dissenting_views: string | null
  }
) {
  await supabase.from('decision_reports').insert({
    brief_id: briefId,
    ...report,
  })
}
