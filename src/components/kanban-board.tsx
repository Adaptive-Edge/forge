'use client'

import { useEffect, useState } from 'react'
import { BriefCard } from './brief-card'

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

const COLUMNS = [
  { id: 'intake', name: 'Intake', icon: '📥' },
  { id: 'building', name: 'Building', icon: '🔨' },
  { id: 'review', name: 'Review', icon: '👀' },
  { id: 'done', name: 'Done', icon: '✅' },
]

// Mock data for now
const MOCK_BRIEFS: Brief[] = [
  {
    id: '1',
    title: 'Add dark mode toggle',
    brief: 'I want users to switch between light and dark mode in settings.',
    status: 'intake',
    outcome_tier: 2,
    outcome_type: 'Productivity & Time',
    impact_score: 6,
    project_id: 'strategyos',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Video edit: Insight 7',
    brief: 'Create Premiere sequence for equipment concerns insight.',
    status: 'building',
    outcome_tier: 3,
    outcome_type: 'Client Value',
    impact_score: 8,
    project_id: 'arjo',
    created_at: new Date().toISOString(),
  },
]

export function KanbanBoard() {
  const [briefs, setBriefs] = useState<Brief[]>(MOCK_BRIEFS)

  const getBriefsForColumn = (columnId: string) => {
    return briefs.filter(b => b.status === columnId)
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {COLUMNS.map(column => (
        <div key={column.id} className="flex flex-col">
          <div className="flex items-center gap-2 mb-3 px-2">
            <span>{column.icon}</span>
            <h2 className="font-medium text-zinc-400">{column.name}</h2>
            <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-500">
              {getBriefsForColumn(column.id).length}
            </span>
          </div>
          <div className="flex flex-col gap-3 min-h-[200px] bg-zinc-900/50 rounded-lg p-3">
            {getBriefsForColumn(column.id).map(brief => (
              <BriefCard key={brief.id} brief={brief} />
            ))}
            {getBriefsForColumn(column.id).length === 0 && (
              <div className="text-center text-zinc-600 text-sm py-8">
                No briefs
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
