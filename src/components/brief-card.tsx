'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Brief } from '@/lib/types'

const TIER_COLORS: Record<number, string> = {
  1: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  2: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  3: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  4: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

export function BriefCardContent({ brief, projectName }: { brief: Brief; projectName?: string }) {
  return (
    <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700 hover:border-zinc-600 transition-colors cursor-pointer">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm leading-tight">{brief.title}</h3>
        {brief.outcome_tier && (
          <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${TIER_COLORS[brief.outcome_tier] || ''}`}>
            T{brief.outcome_tier}
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{brief.brief}</p>
      {(brief.brief_type === 'run' || brief.fast_track || brief.auto_deploy) && (
        <div className="flex gap-1.5 mb-2">
          {brief.brief_type === 'run' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 border border-violet-500/30">
              Run
            </span>
          )}
          {brief.fast_track && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
              Fast-track
            </span>
          )}
          {brief.auto_deploy && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
              Auto-deploy
            </span>
          )}
        </div>
      )}
      {(brief.status === 'evaluating' || brief.status === 'revising' || (brief.status === 'building' && brief.pipeline_stage)) && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          {brief.status === 'revising' ? 'Revising...' :
           brief.pipeline_stage === 'gatekeeper' ? 'Evaluating...' :
           brief.pipeline_stage === 'skeptic' ? 'Skeptic...' :
           brief.pipeline_stage === 'deliberating' ? 'Deliberating...' :
           brief.pipeline_stage === 'voting' ? 'Voting...' :
           brief.pipeline_stage === 'planning' ? 'Planning...' :
           brief.pipeline_stage === 'critic_review' ? 'Critic reviewing...' :
           brief.pipeline_stage === 'building' ? 'Building...' :
           brief.pipeline_stage === 'brand_review' ? 'Brand review...' :
           brief.pipeline_stage === 'build_complete' ? 'Build complete' :
           brief.pipeline_stage === 'running' ? 'Running task...' :
           brief.pipeline_stage === 'task_complete' ? 'Task complete' :
           brief.pipeline_stage === 'deploying' ? 'Deploying...' :
           brief.pipeline_stage === 'deploy_complete' ? 'Deployed' :
           brief.status === 'evaluating' ? 'Evaluating...' :
           'Processing...'}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{projectName || 'Unassigned'}</span>
        {brief.impact_score && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500">Impact:</span>
            <span className="text-xs font-medium text-orange-400">{brief.impact_score}/10</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function SortableBriefCard({
  brief,
  projectName,
  onClick,
}: {
  brief: Brief
  projectName?: string
  onClick?: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: brief.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging && onClick) onClick()
      }}
    >
      <BriefCardContent brief={brief} projectName={projectName} />
    </div>
  )
}
