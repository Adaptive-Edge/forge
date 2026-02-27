'use client'

export function BulkActionBar({
  count,
  onMove,
  onDelete,
  onClear,
}: {
  count: number
  onMove: (status: string) => void
  onDelete: () => void
  onClear: () => void
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2 shadow-xl shadow-black/40">
        <span className="text-sm text-zinc-300 font-medium mr-1">
          {count} selected
        </span>

        <div className="w-px h-5 bg-zinc-700" />

        <span className="text-xs text-zinc-500 ml-1">Move to:</span>
        {['intake', 'building', 'review', 'done'].map(status => (
          <button
            key={status}
            onClick={() => onMove(status)}
            className="px-2.5 py-1 rounded-full text-xs bg-zinc-700 text-zinc-300 hover:bg-zinc-600 capitalize transition-colors"
          >
            {status}
          </button>
        ))}

        <div className="w-px h-5 bg-zinc-700" />

        <button
          onClick={onDelete}
          className="px-2.5 py-1 rounded-full text-xs bg-red-900/50 text-red-400 hover:bg-red-900/80 transition-colors"
        >
          Delete
        </button>

        <button
          onClick={onClear}
          className="px-2.5 py-1 rounded-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
