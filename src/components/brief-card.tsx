'use client'

type Brief = {
  id: string
  title: string
  brief: string
  status: string
  outcome_tier: number
  outcome_type: string
  impact_score: number
  project_id: string
  created_at: string
}

const TIER_COLORS: Record<number, string> = {
  1: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  2: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  3: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  4: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

const TIER_NAMES: Record<number, string> = {
  1: 'Foundation',
  2: 'Leverage',
  3: 'Growth',
  4: 'Reach',
}

export function BriefCard({ brief }: { brief: Brief }) {
  return (
    <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700 hover:border-zinc-600 transition-colors cursor-pointer">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm leading-tight">{brief.title}</h3>
        <span className={`text-xs px-1.5 py-0.5 rounded border ${TIER_COLORS[brief.outcome_tier]}`}>
          T{brief.outcome_tier}
        </span>
      </div>
      <p className="text-xs text-zinc-400 line-clamp-2 mb-3">{brief.brief}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 capitalize">{brief.project_id}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-500">Impact:</span>
          <span className="text-xs font-medium text-orange-400">{brief.impact_score}/10</span>
        </div>
      </div>
    </div>
  )
}
