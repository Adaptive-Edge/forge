export type Brief = {
  id: string
  created_at: string
  updated_at: string
  title: string
  brief: string
  brief_type: string
  status: string
  project_id: string | null
  tags: string[] | null
  outcome_tier: number | null
  outcome_type: string | null
  impact_score: number | null
  time_horizon: string | null
  approved: boolean | null
  rejection_reason: string | null
  repo_url: string | null
  branch_name: string | null
  pr_url: string | null
  pipeline_stage: string | null
  architect_plan: string | null
  fast_track: boolean
  auto_deploy: boolean
  output_path: string | null
  estimated_hours: number | null
  actual_hours: number | null
  agent_name: string | null
  inputs: Record<string, unknown> | null
  target_machine: string | null
  created_by: string | null
}

export type Project = {
  id: string
  name: string
  project_type: string
  repo_url: string | null
  default_branch: string
  extra_agents: string[] | null
  deployment_notes: string | null
  local_path: string | null
  context_notes: string | null
  created_at: string
}

export type AgentEvaluation = {
  id: string
  brief_id: string
  agent_slug: string
  created_at: string
  evaluation_type: string | null
  verdict: string | null
  reasoning: string | null
  suggestions: Record<string, unknown> | null
  confidence: number | null
}

export type BuildLog = {
  id: string
  brief_id: string
  timestamp: string
  agent: string | null
  action: string | null
  details: Record<string, unknown> | null
  log_level: string
}

export type AcceptanceCriterion = {
  id: string
  brief_id: string
  criterion: string
  completed: boolean
  sort_order: number | null
}

export type DeliberationRound = {
  id: string
  brief_id: string
  agent_slug: string
  round: number
  verdict: string
  reasoning: string
  confidence: number
  revised_from: string | null
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

export type GitHubRepo = {
  id: string
  github_id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  is_private: boolean
  default_branch: string
  owner_login: string
  language: string | null
  pushed_at: string | null
  synced_at: string
}
