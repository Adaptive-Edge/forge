'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Brief, AgentEvaluation, BuildLog, AcceptanceCriterion } from '@/lib/types'

const TIER_COLORS: Record<number, string> = {
  1: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  2: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  3: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  4: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

const TIER_NAMES: Record<number, string> = {
  1: 'Foundation',
  2: 'Leverage',
  3: 'Growth',
  4: 'Reach',
}

export function BriefDetailPanel({
  brief,
  projectName,
  onClose,
  onStatusChange,
}: {
  brief: Brief
  projectName?: string
  onClose: () => void
  onStatusChange?: (newStatus: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'agents' | 'plan' | 'logs'>('details')
  const [isEditing, setIsEditing] = useState(false)
  const [editedBrief, setEditedBrief] = useState(brief.brief)
  const [editedTitle, setEditedTitle] = useState(brief.title)
  const [evaluations, setEvaluations] = useState<AgentEvaluation[]>([])
  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([])
  const [criteria, setCriteria] = useState<AcceptanceCriterion[]>([])

  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('agent_evaluations')
      .select('*')
      .eq('brief_id', brief.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setEvaluations(data) })

    supabase
      .from('build_logs')
      .select('*')
      .eq('brief_id', brief.id)
      .order('timestamp', { ascending: true })
      .then(({ data }) => { if (data) setBuildLogs(data) })

    supabase
      .from('acceptance_criteria')
      .select('*')
      .eq('brief_id', brief.id)
      .order('sort_order')
      .then(({ data }) => { if (data) setCriteria(data) })

    // Realtime subscriptions for live updates
    const channel = supabase
      .channel(`brief-${brief.id}-live`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_evaluations',
        filter: `brief_id=eq.${brief.id}`,
      }, (payload) => {
        setEvaluations(prev => [payload.new as AgentEvaluation, ...prev])
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'build_logs',
        filter: `brief_id=eq.${brief.id}`,
      }, (payload) => {
        setBuildLogs(prev => [...prev, payload.new as BuildLog])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [brief.id])

  useEffect(() => {
    setEditedBrief(brief.brief)
    setEditedTitle(brief.title)
    setIsEditing(false)
  }, [brief.id, brief.brief, brief.title])

  const handleSave = async () => {
    const supabase = createClient()
    const { error } = await supabase
      .from('briefs')
      .update({
        title: editedTitle,
        brief: editedBrief,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brief.id)

    if (!error) {
      setIsEditing(false)
    } else {
      console.error('Failed to save brief:', error)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this brief?')) return

    const supabase = createClient()
    const { error } = await supabase
      .from('briefs')
      .delete()
      .eq('id', brief.id)

    if (!error) {
      onClose()
    } else {
      console.error('Failed to delete brief:', error)
    }
  }

  const toggleCriterion = async (criterion: AcceptanceCriterion) => {
    const newCompleted = !criterion.completed
    setCriteria(prev =>
      prev.map(c => c.id === criterion.id ? { ...c, completed: newCompleted } : c)
    )

    const supabase = createClient()
    await supabase
      .from('acceptance_criteria')
      .update({ completed: newCompleted })
      .eq('id', criterion.id)
  }

  const handleStartBuild = async () => {
    const supabase = createClient()
    await supabase
      .from('briefs')
      .update({ status: 'evaluating', updated_at: new Date().toISOString() })
      .eq('id', brief.id)
    setActiveTab('agents')
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatRelative = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-zinc-900 border-l border-zinc-800 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full text-xl font-semibold bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
                />
              ) : (
                <h2 className="text-xl font-semibold">{brief.title}</h2>
              )}
              <div className="flex items-center gap-2 mt-2">
                {brief.outcome_tier && (
                  <span className={`text-xs px-2 py-0.5 rounded border ${TIER_COLORS[brief.outcome_tier]}`}>
                    {TIER_NAMES[brief.outcome_tier]}
                  </span>
                )}
                {brief.outcome_type && (
                  <span className="text-xs text-zinc-500">{brief.outcome_type}</span>
                )}
                <span className="text-xs text-zinc-500">&middot;</span>
                <span className="text-xs text-zinc-500">{projectName || 'Unassigned'}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white">
              ✕
            </button>
          </div>

          {/* Pipeline progress */}
          {brief.pipeline_stage && (brief.status === 'evaluating' || brief.status === 'building') && (
            <div className="flex items-center gap-2 mt-3 text-xs">
              {['gatekeeper', 'voting', 'planning', 'building'].map((stage, i) => {
                const stages = ['gatekeeper', 'voting', 'planning', 'building']
                const currentIdx = stages.indexOf(brief.pipeline_stage || '')
                const isActive = stage === brief.pipeline_stage
                const isDone = i < currentIdx
                return (
                  <div key={stage} className="flex items-center gap-2">
                    {i > 0 && <span className={`w-4 h-px ${isDone ? 'bg-orange-500' : 'bg-zinc-700'}`} />}
                    <span className={`capitalize ${
                      isActive ? 'text-orange-400 font-medium' :
                      isDone ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                      {isActive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse mr-1 align-middle" />}
                      {stage === 'gatekeeper' ? 'Evaluate' : stage}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex gap-4 mt-4">
            {(['details', 'agents', 'plan', 'logs'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm font-medium pb-2 border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'text-orange-400 border-orange-400'
                    : 'text-zinc-400 border-transparent hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Brief Description */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-zinc-400">Brief</h3>
                  <button
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    className="text-xs text-orange-400 hover:text-orange-300"
                  >
                    {isEditing ? 'Save' : 'Edit'}
                  </button>
                </div>
                {isEditing ? (
                  <textarea
                    value={editedBrief}
                    onChange={(e) => setEditedBrief(e.target.value)}
                    rows={4}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm resize-none"
                  />
                ) : (
                  <p className="text-sm text-zinc-300">{brief.brief}</p>
                )}
              </div>

              {/* Acceptance Criteria */}
              {criteria.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Acceptance Criteria</h3>
                  <div className="space-y-1">
                    {criteria.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => toggleCriterion(c)}
                        className="flex items-center gap-2 w-full text-left text-sm py-1 hover:bg-zinc-800/50 rounded px-1"
                      >
                        <span className={c.completed ? 'text-green-400' : 'text-zinc-600'}>
                          {c.completed ? '\u2713' : '\u25CB'}
                        </span>
                        <span className={c.completed ? 'text-zinc-500 line-through' : 'text-zinc-300'}>
                          {c.criterion}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Impact Score */}
              {brief.impact_score && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Impact Score</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                        style={{ width: `${brief.impact_score * 10}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold text-orange-400">{brief.impact_score}/10</span>
                  </div>
                </div>
              )}

              {/* PR URL */}
              {brief.pr_url && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Pull Request</h3>
                  <a
                    href={brief.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-orange-400 hover:text-orange-300 underline underline-offset-2"
                  >
                    {brief.pr_url}
                  </a>
                </div>
              )}

              {/* Status Actions */}
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Move to</h3>
                <div className="flex gap-2">
                  {['intake', 'building', 'review', 'done'].map((status) => (
                    <button
                      key={status}
                      onClick={() => onStatusChange?.(status)}
                      disabled={status === brief.status}
                      className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-colors ${
                        status === brief.status
                          ? 'bg-orange-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-4 border-t border-zinc-800">
                {brief.status === 'evaluating' || (brief.status === 'building' && brief.pipeline_stage && brief.pipeline_stage !== 'build_complete') ? (
                  <div className="flex-1 py-2 text-center text-sm text-amber-400 flex items-center justify-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    {brief.pipeline_stage === 'gatekeeper' ? 'Evaluating...' :
                     brief.pipeline_stage === 'voting' ? 'Voting...' :
                     brief.pipeline_stage === 'planning' ? 'Architect planning...' :
                     brief.pipeline_stage === 'building' ? 'Builder working...' :
                     'Processing...'}
                  </div>
                ) : evaluations.length > 0 ? (
                  <button
                    onClick={handleStartBuild}
                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Re-evaluate
                  </button>
                ) : (
                  <button
                    onClick={handleStartBuild}
                    className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-medium transition-colors"
                  >
                    Start Build
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-zinc-800 hover:bg-red-900/50 hover:text-red-400 rounded-lg text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500 mb-4">
                Agent evaluations and decisions for this brief
              </p>
              {evaluations.map((evaluation) => (
                <div key={evaluation.id} className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {evaluation.verdict === 'approve' ? '\u2705' : evaluation.verdict === 'reject' ? '\u274C' : '\u26A0\uFE0F'}
                      </span>
                      <span className="font-medium capitalize">{evaluation.agent_slug}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{formatRelative(evaluation.created_at)}</span>
                  </div>
                  <p className="text-sm text-zinc-400">{evaluation.reasoning}</p>
                  {evaluation.confidence && (
                    <p className="text-xs text-zinc-500 mt-2">Confidence: {evaluation.confidence}/10</p>
                  )}
                </div>
              ))}

              {evaluations.length === 0 && (
                <div className="text-center text-zinc-500 py-8">
                  No agent evaluations yet. Start the build to trigger agent analysis.
                </div>
              )}
            </div>
          )}

          {activeTab === 'plan' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500 mb-4">
                Implementation plan from the Architect agent
              </p>
              {brief.architect_plan ? (
                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                  <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {brief.architect_plan}
                  </pre>
                </div>
              ) : brief.pipeline_stage === 'planning' ? (
                <div className="text-center text-amber-400 py-8 flex items-center justify-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Architect is designing the plan...
                </div>
              ) : (
                <div className="text-center text-zinc-500 py-8">
                  No plan yet. The Architect creates a plan after evaluators approve the brief.
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 mb-4">
                Build activity and progress logs
              </p>
              {buildLogs.length > 0 ? (
                <div className="space-y-2 font-mono text-xs">
                  {buildLogs.map((log) => (
                    <div key={log.id} className="flex gap-2 text-zinc-400">
                      <span className="text-zinc-600 shrink-0">{formatTime(log.timestamp)}</span>
                      {log.agent && (
                        <span className={
                          log.log_level === 'error' ? 'text-red-400' :
                          log.log_level === 'warn' ? 'text-yellow-400' :
                          'text-blue-400'
                        }>
                          [{log.agent}]
                        </span>
                      )}
                      <span>{log.action}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-zinc-500 py-8">
                  No build logs yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
