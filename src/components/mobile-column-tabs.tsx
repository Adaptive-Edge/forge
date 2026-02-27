'use client'

type Column = {
  id: string
  name: string
  icon: string
}

export function MobileColumnTabs({
  columns,
  counts,
  activeColumn,
  onColumnChange,
}: {
  columns: Column[]
  counts: Record<string, number>
  activeColumn: string
  onColumnChange: (id: string) => void
}) {
  return (
    <div className="flex border-b border-zinc-800 overflow-x-auto">
      {columns.map(col => {
        const isActive = col.id === activeColumn
        return (
          <button
            key={col.id}
            onClick={() => onColumnChange(col.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 ${
              isActive
                ? 'text-orange-400 border-orange-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            <span>{col.icon}</span>
            <span>{col.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              isActive ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 text-zinc-500'
            }`}>
              {counts[col.id] || 0}
            </span>
          </button>
        )
      })}
    </div>
  )
}
