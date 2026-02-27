'use client'

const SHORTCUTS = [
  { key: 'N', description: 'New brief' },
  { key: '/', description: 'Focus search' },
  { key: '?', description: 'Toggle this help' },
  { key: 'Esc', description: 'Close panel / modal / help' },
]

export function KeyboardHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            &#x2715;
          </button>
        </div>
        <div className="space-y-3">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">{s.description}</span>
              <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-400 font-mono">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
