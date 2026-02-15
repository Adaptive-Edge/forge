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
}: {
  column: Column
  count: number
  children: ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl p-4 min-h-[500px] transition-colors ${
        isOver
          ? 'bg-zinc-700/50 ring-2 ring-blue-500/50'
          : 'bg-zinc-900'
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
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
