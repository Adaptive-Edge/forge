export type PipelineStage =
  | 'gatekeeper'
  | 'skeptic'
  | 'voting'
  | 'planning'
  | 'building'
  | 'build_complete'

export type Verdict = 'approve' | 'reject' | 'concern'

export type EvaluationResult = {
  verdict: Verdict
  reasoning: string
  suggested_tier?: number
  suggested_impact?: number
  confidence: number
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
  project?: {
    name: string
    repo_url: string | null
    default_branch: string
  } | null
}
