import { KanbanBoard } from '@/components/kanban-board'
import { NewBriefButton } from '@/components/new-brief-button'

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-lg font-bold">
              F
            </div>
            <h1 className="text-xl font-semibold">The Forge</h1>
          </div>
          <NewBriefButton />
        </div>
      </header>
      <main className="p-6">
        <KanbanBoard />
      </main>
    </div>
  )
}
