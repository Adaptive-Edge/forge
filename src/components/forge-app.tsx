'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { KanbanBoard } from './kanban-board'
import { NewBriefButton } from './new-brief-button'
import { NewBriefModal, type BriefDefaultValues } from './new-brief-modal'
import { SystemStatus } from './system-status'
import { HeaderActions } from './header-actions'
import { BriefFilters, type ActiveFilters } from './brief-filters'
import { BulkActionBar } from './bulk-action-bar'
import { KeyboardHelp } from './keyboard-help'
import { AnalyticsPanel } from './analytics-panel'
import { useKeyboardShortcuts } from '@/lib/use-keyboard-shortcuts'
import { useNotifications } from '@/lib/use-notifications'
import { createClient } from '@/lib/supabase'
import type { Brief, Project } from '@/lib/types'

export function ForgeApp() {
  // Core data
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectMap, setProjectMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  // Selection
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [defaultValues, setDefaultValues] = useState<BriefDefaultValues | undefined>()

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({})
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Bulk select
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Panels
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // Notifications
  const { notify } = useNotifications()
  const statusMapRef = useRef<Map<string, string>>(new Map())

  // Load data
  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const [briefsRes, projectsRes] = await Promise.all([
        supabase.from('briefs').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').order('name'),
      ])

      if (briefsRes.data) {
        setBriefs(briefsRes.data)
        // Initialize status map for notifications
        const map = new Map<string, string>()
        briefsRes.data.forEach(b => map.set(b.id, b.status))
        statusMapRef.current = map
      }
      if (projectsRes.data) {
        setProjects(projectsRes.data)
        const map: Record<string, string> = {}
        projectsRes.data.forEach((p: Project) => { map[p.id] = p.name })
        setProjectMap(map)
      }
      setLoading(false)
    }
    load()

    // Realtime subscription
    const channel = supabase
      .channel('briefs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'briefs' }, (payload) => {
        const newBrief = payload.new as Brief
        setBriefs(prev => [newBrief, ...prev])
        statusMapRef.current.set(newBrief.id, newBrief.status)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'briefs' }, (payload) => {
        const updated = payload.new as Brief
        setBriefs(prev => prev.map(b => b.id === updated.id ? updated : b))
        setSelectedBrief(prev => prev?.id === updated.id ? updated : prev)

        // Browser notification on status change
        const oldStatus = statusMapRef.current.get(updated.id)
        if (oldStatus && oldStatus !== updated.status) {
          notify(
            `Brief: ${updated.title}`,
            `Status changed: ${oldStatus} → ${updated.status}`
          )
        }
        statusMapRef.current.set(updated.id, updated.status)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'briefs' }, (payload) => {
        const deleted = payload.old as { id: string }
        setBriefs(prev => prev.filter(b => b.id !== deleted.id))
        setSelectedBrief(prev => prev?.id === deleted.id ? null : prev)
        statusMapRef.current.delete(deleted.id)
        setSelectedIds(prev => {
          const next = new Set(prev)
          next.delete(deleted.id)
          return next
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [notify])

  // Filter briefs
  const filteredBriefs = useMemo(() => {
    let result = briefs

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.brief.toLowerCase().includes(q)
      )
    }

    // Filter by project
    if (activeFilters.projectId) {
      result = result.filter(b => b.project_id === activeFilters.projectId)
    }

    // Filter by tier
    if (activeFilters.tier) {
      result = result.filter(b => b.outcome_tier === activeFilters.tier)
    }

    // Filter by type
    if (activeFilters.briefType) {
      result = result.filter(b => b.brief_type === activeFilters.briefType)
    }

    return result
  }, [briefs, searchQuery, activeFilters])

  // Status change handler
  const handleStatusChange = useCallback(async (briefId: string, newStatus: string) => {
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
  }, [briefs])

  // Bulk actions
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBulkMove = useCallback(async (status: string) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    // Optimistic update
    setBriefs(prev => prev.map(b =>
      selectedIds.has(b.id) ? { ...b, status } : b
    ))

    const supabase = createClient()
    const { error } = await supabase
      .from('briefs')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids)

    if (error) {
      console.error('Bulk move failed:', error)
      // Reload to get correct state
      const { data } = await supabase.from('briefs').select('*').order('created_at', { ascending: false })
      if (data) setBriefs(data)
    }

    setSelectedIds(new Set())
    setSelectMode(false)
  }, [selectedIds])

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} brief${ids.length > 1 ? 's' : ''}?`)) return

    setBriefs(prev => prev.filter(b => !selectedIds.has(b.id)))

    const supabase = createClient()
    const { error } = await supabase
      .from('briefs')
      .delete()
      .in('id', ids)

    if (error) {
      console.error('Bulk delete failed:', error)
      const { data } = await supabase.from('briefs').select('*').order('created_at', { ascending: false })
      if (data) setBriefs(data)
    }

    setSelectedIds(new Set())
    setSelectMode(false)
    setSelectedBrief(prev => prev && selectedIds.has(prev.id) ? null : prev)
  }, [selectedIds])

  // Modal controls
  const openModal = useCallback((values?: BriefDefaultValues) => {
    setDefaultValues(values)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setDefaultValues(undefined)
  }, [])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'n': () => openModal(),
    'N': () => openModal(),
    '/': () => searchInputRef.current?.focus(),
    '?': () => setShowHelp(prev => !prev),
    'Escape': () => {
      if (showHelp) setShowHelp(false)
      else if (modalOpen) closeModal()
      else if (selectedBrief) setSelectedBrief(null)
      else if (selectMode) { setSelectMode(false); setSelectedIds(new Set()) }
    },
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-lg font-bold">
              F
            </div>
            <h1 className="text-xl font-semibold">The Forge</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAnalytics(prev => !prev)}
              className={`text-xs transition-colors ${
                showAnalytics ? 'text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => {
                if (selectMode) {
                  setSelectMode(false)
                  setSelectedIds(new Set())
                } else {
                  setSelectMode(true)
                }
              }}
              className={`text-xs transition-colors ${
                selectMode ? 'text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {selectMode ? 'Cancel Select' : 'Select'}
            </button>
            <HeaderActions />
            <NewBriefButton
              isOpen={modalOpen}
              onOpen={openModal}
              onClose={closeModal}
            />
          </div>
        </div>
      </header>

      {showAnalytics && <AnalyticsPanel />}

      <BriefFilters
        ref={searchInputRef}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        projects={projects}
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
        onClearAll={() => { setSearchQuery(''); setActiveFilters({}) }}
      />

      <main className="flex-1 p-6">
        <KanbanBoard
          briefs={filteredBriefs}
          projects={projectMap}
          selectedBrief={selectedBrief}
          onSelectBrief={setSelectedBrief}
          onStatusChange={handleStatusChange}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          loading={loading}
        />
      </main>

      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          onMove={handleBulkMove}
          onDelete={handleBulkDelete}
          onClear={() => { setSelectedIds(new Set()); setSelectMode(false) }}
        />
      )}

      <SystemStatus />

      {modalOpen && (
        <NewBriefModal onClose={closeModal} defaultValues={defaultValues} />
      )}

      {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}
    </div>
  )
}
