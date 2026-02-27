import type { BriefDefaultValues } from '@/components/new-brief-modal'

export type BriefTemplate = {
  id: string
  name: string
  icon: string
  description: string
  defaults: BriefDefaultValues & { brief_type?: 'build' | 'run' }
}

export const BRIEF_TEMPLATES: BriefTemplate[] = [
  {
    id: 'bug-fix',
    name: 'Bug Fix',
    icon: '\uD83D\uDC1B',
    description: 'Fix a bug or broken behaviour',
    defaults: {
      outcome_tier: 2,
      outcome_type: 'Productivity & Time',
      impact_score: 6,
      fast_track: true,
      brief_type: 'build',
    },
  },
  {
    id: 'new-feature',
    name: 'New Feature',
    icon: '\u2728',
    description: 'Add new functionality to an app',
    defaults: {
      outcome_tier: 3,
      outcome_type: 'Client Value',
      impact_score: 7,
      brief_type: 'build',
    },
  },
  {
    id: 'deploy-script',
    name: 'Deploy Script',
    icon: '\uD83D\uDE80',
    description: 'Automate a deployment or DevOps task',
    defaults: {
      outcome_tier: 2,
      outcome_type: 'Efficiency',
      impact_score: 5,
      fast_track: true,
      auto_deploy: true,
      brief_type: 'build',
    },
  },
  {
    id: 'research-task',
    name: 'Research Task',
    icon: '\uD83D\uDD0D',
    description: 'Research, analysis, or document creation',
    defaults: {
      outcome_tier: 3,
      outcome_type: 'Project Goals',
      impact_score: 5,
      brief_type: 'run',
    },
  },
]
