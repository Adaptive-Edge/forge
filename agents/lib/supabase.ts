import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.adaptiveedge.uk'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzM1Njg5NjAwLCJleHAiOjE4OTM0NTYwMDB9.oMbaS3CnjWNmpHUfucybDwfEcWIDRl4BTeHBj_urRmg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export async function logBuild(
  briefId: string,
  agent: string,
  action: string,
  level: string = 'info',
  details?: Record<string, unknown>
) {
  await supabase.from('build_logs').insert({
    brief_id: briefId,
    agent,
    action,
    log_level: level,
    ...(details && { details }),
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
      .select('name, repo_url, default_branch')
      .eq('id', brief.project_id)
      .single()
    project = data
  }

  return { ...brief, project }
}
