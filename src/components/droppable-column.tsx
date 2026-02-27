'use client'

import { useDroppable } from '@dnd-kit/core'
import { ReactNode } from 'react'

type Column = {
  id: string
  name: string
  icon: string
}

export function DroppableColumn({
  column,
  count,
  children,
  className,
  selectMode,
  allSelected,
  onSelectAll,
}: {
  column: Column
  count: number
  children: ReactNode
  className?: string
  selectMode?: boolean
  allSelected?: boolean
  onSelectAll?: (checked: boolean) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex-col rounded-xl p-4 min-h-[500px] transition-colors ${
        isOver
          ? 'bg-zinc-700/50 ring-2 ring-blue-500/50'
          : 'bg-zinc-900'
      } ${className || 'flex'}`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {selectMode && count > 0 && (
            <button
              onClick={() => onSelectAll?.(!allSelected)}
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                allSelected ? 'bg-orange-600 border-orange-500' : 'border-zinc-600 hover:border-zinc-400'
              }`}
            >
              {allSelected && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )}
          <span className="text-lg">{column.icon}</span>
          <h2 className="font-semibold text-zinc-200">{column.name}</h2>
        </div>
        <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full">
          {count}
        </span>
      </div>

      {/* Cards container */}
      <div className="flex flex-col gap-2 flex-1">
        {children}
      </div>
    </div>
  )
}
