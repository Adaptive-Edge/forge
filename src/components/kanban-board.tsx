'use client'

import { useState } from 'react'
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
import { MobileColumnTabs } from './mobile-column-tabs'
import { createClient } from '@/lib/supabase'
import type { Brief } from '@/lib/types'

const COLUMNS = [
  { id: 'intake', name: 'Intake', icon: '\u{1F4E5}' },
  { id: 'building', name: 'Building', icon: '\u{1F528}' },
  { id: 'review', name: 'Review', icon: '\u{1F440}' },
  { id: 'done', name: 'Done', icon: '\u2705' },
]

type Props = {
  briefs: Brief[]
  projects: Record<string, string>
  selectedBrief: Brief | null
  onSelectBrief: (b: Brief | null) => void
  onStatusChange: (briefId: string, newStatus: string) => void
  selectMode: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  loading: boolean
}

export function KanbanBoard({
  briefs,
  projects,
  selectedBrief,
  onSelectBrief,
  onStatusChange,
  selectMode,
  selectedIds,
  onToggleSelect,
  loading,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeColumn, setActiveColumn] = useState('intake')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const getBriefsForColumn = (columnId: string) => {
    if (columnId === 'intake') {
      return briefs.filter(b => b.status === 'intake' || b.status === 'evaluating')
    }
    return briefs.filter(b => b.status === columnId)
  }

  const handleDragStart = (event: DragStartEvent) => {
    if (selectMode) return
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || selectMode) return

    const briefId = active.id as string
    const overId = over.id as string
    const targetColumn = COLUMNS.find(col => col.id === overId)
    if (!targetColumn) return

    const brief = briefs.find(b => b.id === briefId)
    if (!brief || brief.status === targetColumn.id) return

    onStatusChange(briefId, targetColumn.id)
  }

  const activeBrief = activeId ? briefs.find(b => b.id === activeId) : null

  // Column counts for mobile tabs
  const columnCounts = COLUMNS.reduce((acc, col) => {
    acc[col.id] = getBriefsForColumn(col.id).length
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      {/* Mobile column tabs */}
      <div className="md:hidden mb-4">
        <MobileColumnTabs
          columns={COLUMNS}
          counts={columnCounts}
          activeColumn={activeColumn}
          onColumnChange={setActiveColumn}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {COLUMNS.map(column => {
            const columnBriefs = getBriefsForColumn(column.id)
            const isActiveOnMobile = column.id === activeColumn
            return (
              <DroppableColumn
                key={column.id}
                column={column}
                count={columnBriefs.length}
                className={isActiveOnMobile ? 'flex' : 'hidden md:flex'}
                selectMode={selectMode}
                allSelected={columnBriefs.length > 0 && columnBriefs.every(b => selectedIds.has(b.id))}
                onSelectAll={(checked) => {
                  columnBriefs.forEach(b => {
                    if (checked && !selectedIds.has(b.id)) onToggleSelect(b.id)
                    if (!checked && selectedIds.has(b.id)) onToggleSelect(b.id)
                  })
                }}
              >
                <SortableContext
                  items={columnBriefs.map(b => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {columnBriefs.map(brief => (
                    <SortableBriefCard
                      key={brief.id}
                      brief={brief}
                      projectName={brief.project_id ? projects[brief.project_id] : undefined}
                      onClick={() => {
                        if (selectMode) {
                          onToggleSelect(brief.id)
                        } else {
                          onSelectBrief(brief)
                        }
                      }}
                      selectMode={selectMode}
                      selected={selectedIds.has(brief.id)}
                      onToggleSelect={() => onToggleSelect(brief.id)}
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
          onClose={() => onSelectBrief(null)}
          onStatusChange={(newStatus) => onStatusChange(selectedBrief.id, newStatus)}
        />
      )}
    </>
  )
}
