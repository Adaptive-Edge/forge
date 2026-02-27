export type PipelineStage =
  | 'gatekeeper'
  | 'skeptic'
  | 'deliberating'
  | 'voting'
  | 'planning'
  | 'critic_review'
  | 'plan_approval'
  | 'building'
  | 'brand_review'
  | 'build_complete'
  | 'running'
  | 'task_complete'
  | 'deploying'
  | 'deploy_complete'

export type ClaudeResult = {
  result: string
  inputTokens: number
  outputTokens: number
  model: string
}

export type Verdict = 'approve' | 'reject' | 'concern'

export type EvaluationResult = {
  verdict: Verdict
  reasoning: string
  suggested_tier?: number
  suggested_impact?: number
  confidence: number
}

export type DeliberationRound = {
  id: string
  brief_id: string
  agent_slug: string
  round: number
  verdict: Verdict
  reasoning: string
  confidence: number
  revised_from: Verdict | null
  created_at: string
}

export type DecisionReport = {
  id: string
  brief_id: string
  decision: 'approved' | 'rejected'
  summary: string
  weighted_score: number
  dissenting_views: string | null
  created_at: string
}

export type AgentConfig = {
  name: string
  slug: string
  model: string
  evaluationType: string
}

export type BriefWithProject = {
  id: string
  title: string
  brief: string
  brief_type: string
  status: string
  project_id: string | null
  outcome_tier: number | null
  outcome_type: string | null
  impact_score: number | null
  time_horizon: string | null
  repo_url: string | null
  branch_name: string | null
  pr_url: string | null
  pipeline_stage: string | null
  architect_plan: string | null
  fast_track: boolean
  auto_deploy: boolean
  require_plan_approval: boolean
  output_path: string | null
  project?: {
    name: string
    repo_url: string | null
    default_branch: string
    deployment_notes: string | null
    local_path: string | null
    context_notes: string | null
  } | null
}
