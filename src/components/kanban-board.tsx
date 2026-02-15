'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableBriefCard, BriefCardContent } from './brief-card'
import { DroppableColumn } from './droppable-column'
import { BriefDetailPanel } from './brief-detail-panel'
import { createClient } from '@/lib/supabase'
import type { Brief, Project } from '@/lib/types'

const COLUMNS = [
  { id: 'intake', name: 'Intake', icon: '\u{1F4E5}' },
  { id: 'building', name: 'Building', icon: '\u{1F528}' },
  { id: 'review', name: 'Review', icon: '\u{1F440}' },
  { id: 'done', name: 'Done', icon: '\u2705' },
]

export function KanbanBoard() {
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [projects, setProjects] = useState<Record<string, string>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(true)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const [briefsRes, projectsRes] = await Promise.all([
        supabase.from('briefs').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*'),
      ])

      if (briefsRes.data) setBriefs(briefsRes.data)
      if (projectsRes.data) {
        const map: Record<string, string> = {}
        projectsRes.data.forEach((p: Project) => { map[p.id] = p.name })
        setProjects(map)
      }
      setLoading(false)
    }
    load()

    // Realtime subscription
    const channel = supabase
      .channel('briefs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'briefs' }, (payload) => {
        setBriefs(prev => [payload.new as Brief, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'briefs' }, (payload) => {
        const updated = payload.new as Brief
        setBriefs(prev => prev.map(b => b.id === updated.id ? updated : b))
        setSelectedBrief(prev => prev?.id === updated.id ? updated : prev)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'briefs' }, (payload) => {
        const deleted = payload.old as { id: string }
        setBriefs(prev => prev.filter(b => b.id !== deleted.id))
        setSelectedBrief(prev => prev?.id === deleted.id ? null : prev)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const getBriefsForColumn = (columnId: string) => {
    if (columnId === 'intake') {
      return briefs.filter(b => b.status === 'intake' || b.status === 'evaluating')
    }
    return briefs.filter(b => b.status === columnId)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const briefId = active.id as string
    const overId = over.id as string
    const targetColumn = COLUMNS.find(col => col.id === overId)
    if (!targetColumn) return

    const brief = briefs.find(b => b.id === briefId)
    if (!brief || brief.status === targetColumn.id) return

    // Optimistic update
    setBriefs(prev => prev.map(b =>
      b.id === briefId ? { ...b, status: targetColumn.id } : b
    ))

    const supabase = createClient()
    const { error } = await supabase
      .from('briefs')
      .update({ status: targetColumn.id, updated_at: new Date().toISOString() })
      .eq('id', briefId)

    if (error) {
      // Revert on failure
      setBriefs(prev => prev.map(b =>
        b.id === briefId ? { ...b, status: brief.status } : b
      ))
      console.error('Failed to update brief status:', error)
    }
  }

  const handleStatusChange = async (briefId: string, newStatus: string) => {
    const brief = briefs.find(b => b.id === briefId)
    if (!brief) return

    setBriefs(prev => prev.map(b =>
      b.id === briefId ? { ...b, status: newStatus } : b
    ))
    setSelectedBrief(prev =>
      prev?.id === briefId ? { ...prev, status: newStatus } : prev
    )

    const supabase = createClient()
    const { error } = await supabase
      .from('briefs')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', briefId)

    if (error) {
      setBriefs(prev => prev.map(b =>
        b.id === briefId ? { ...b, status: brief.status } : b
      ))
      setSelectedBrief(prev =>
        prev?.id === briefId ? { ...prev, status: brief.status } : prev
      )
      console.error('Failed to update brief status:', error)
    }
  }

  const activeBrief = activeId ? briefs.find(b => b.id === activeId) : null

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map(col => (
          <div key={col.id} className="bg-zinc-900 rounded-xl p-4 min-h-[500px] animate-pulse">
            <div className="h-6 bg-zinc-800 rounded w-24 mb-4" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map(column => {
            const columnBriefs = getBriefsForColumn(column.id)
            return (
              <DroppableColumn key={column.id} column={column} count={columnBriefs.length}>
                <SortableContext
                  items={columnBriefs.map(b => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {columnBriefs.map(brief => (
                    <SortableBriefCard
                      key={brief.id}
                      brief={brief}
                      projectName={brief.project_id ? projects[brief.project_id] : undefined}
                      onClick={() => setSelectedBrief(brief)}
                    />
                  ))}
                </SortableContext>
                {columnBriefs.length === 0 && (
                  <div className="text-center text-zinc-600 text-sm py-8">
                    Drop briefs here
                  </div>
                )}
              </DroppableColumn>
            )
          })}
        </div>

        <DragOverlay>
          {activeBrief ? (
            <div className="opacity-80 rotate-2">
              <BriefCardContent
                brief={activeBrief}
                projectName={activeBrief.project_id ? projects[activeBrief.project_id] : undefined}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedBrief && (
        <BriefDetailPanel
          brief={selectedBrief}
          projectName={selectedBrief.project_id ? projects[selectedBrief.project_id] : undefined}
          onClose={() => setSelectedBrief(null)}
          onStatusChange={(newStatus) => handleStatusChange(selectedBrief.id, newStatus)}
        />
      )}
    </>
  )
}
