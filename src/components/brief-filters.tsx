'use client'

import { forwardRef, useRef, useEffect, useState } from 'react'
import type { Project } from '@/lib/types'

export type ActiveFilters = {
  projectId?: string
  tier?: number
  briefType?: 'build' | 'run'
}

type Props = {
  searchQuery: string
  onSearchChange: (query: string) => void
  projects: Project[]
  activeFilters: ActiveFilters
  onFilterChange: (filters: ActiveFilters) => void
  onClearAll: () => void
}

export const BriefFilters = forwardRef<HTMLInputElement, Props>(function BriefFilters(
  { searchQuery, onSearchChange, projects, activeFilters, onFilterChange, onClearAll },
  ref
) {
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  const handleSearchChange = (value: string) => {
    setLocalQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSearchChange(value)
    }, 200)
  }

  const hasFilters = searchQuery || activeFilters.projectId || activeFilters.tier || activeFilters.briefType

  return (
    <div className="px-6 pt-4 flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <input
          ref={ref}
          type="text"
          value={localQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search briefs... ( / )"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Project filter */}
      <select
        value={activeFilters.projectId || ''}
        onChange={(e) => onFilterChange({ ...activeFilters, projectId: e.target.value || undefined })}
        className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600"
      >
        <option value="">All projects</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Tier filter chips */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(tier => (
          <button
            key={tier}
            onClick={() => onFilterChange({
              ...activeFilters,
              tier: activeFilters.tier === tier ? undefined : tier,
            })}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              activeFilters.tier === tier
                ? 'bg-orange-600/30 text-orange-400 border border-orange-500/50'
                : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-600'
            }`}
          >
            T{tier}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex gap-1">
        <button
          onClick={() => onFilterChange({
            ...activeFilters,
            briefType: activeFilters.briefType === 'build' ? undefined : 'build',
          })}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            activeFilters.briefType === 'build'
              ? 'bg-blue-600/30 text-blue-400 border border-blue-500/50'
              : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-600'
          }`}
        >
          Build
        </button>
        <button
          onClick={() => onFilterChange({
            ...activeFilters,
            briefType: activeFilters.briefType === 'run' ? undefined : 'run',
          })}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            activeFilters.briefType === 'run'
              ? 'bg-violet-600/30 text-violet-400 border border-violet-500/50'
              : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-600'
          }`}
        >
          Run
        </button>
      </div>

      {/* Clear all */}
      {hasFilters && (
        <button
          onClick={onClearAll}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Clear
        </button>
      )}
    </div>
  )
})
