'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { BRIEF_TEMPLATES, type BriefTemplate } from '@/lib/brief-templates'
import type { Project, GitHubRepo } from '@/lib/types'

const OUTCOME_TIERS = [
  { value: 1, name: 'Tier 1: Foundation', description: 'Health, Family' },
  { value: 2, name: 'Tier 2: Leverage', description: 'Productivity, Efficiency' },
  { value: 3, name: 'Tier 3: Growth', description: 'Revenue, Client Value, Project Goals' },
  { value: 4, name: 'Tier 4: Reach', description: 'Brand Awareness, Customer Attraction' },
]

const OUTCOME_TYPES: Record<number, string[]> = {
  1: ['Health & Wellbeing', 'Family'],
  2: ['Productivity & Time', 'Efficiency'],
  3: ['Revenue Potential', 'Client Value', 'Project Goals'],
  4: ['Brand Awareness', 'Customer Attraction'],
}

export type BriefDefaultValues = {
  title?: string
  brief?: string
  outcome_tier?: number
  outcome_type?: string
  impact_score?: number
  acceptance_criteria?: string[]
  fast_track?: boolean
  auto_deploy?: boolean
  brief_type?: 'build' | 'run'
}

export function NewBriefModal({
  onClose,
  defaultValues,
}: {
  onClose: () => void
  defaultValues?: BriefDefaultValues
}) {
  const [step, setStep] = useState<'template' | 'form'>(defaultValues ? 'form' : 'template')
  const [projects, setProjects] = useState<Project[]>([])
  const [title, setTitle] = useState(defaultValues?.title || '')
  const [brief, setBrief] = useState(defaultValues?.brief || '')
  const [projectId, setProjectId] = useState('')
  const [outcomeTier, setOutcomeTier] = useState(defaultValues?.outcome_tier || 2)
  const [outcomeType, setOutcomeType] = useState(defaultValues?.outcome_type || 'Productivity & Time')
  const [impactScore, setImpactScore] = useState(defaultValues?.impact_score || 5)
  const [criteria, setCriteria] = useState<string[]>(
    defaultValues?.acceptance_criteria?.length ? defaultValues.acceptance_criteria : ['']
  )
  const [repoUrl, setRepoUrl] = useState('')
  const [repoQuery, setRepoQuery] = useState('')
  const [allRepos, setAllRepos] = useState<GitHubRepo[]>([])
  const [showRepoSuggestions, setShowRepoSuggestions] = useState(false)
  const repoInputRef = useRef<HTMLInputElement>(null)
  const [briefType, setBriefType] = useState<'build' | 'run'>(defaultValues?.brief_type || 'build')
  const [fastTrack, setFastTrack] = useState(defaultValues?.fast_track || false)
  const [autoDeploy, setAutoDeploy] = useState(defaultValues?.auto_deploy || false)
  const [requirePlanApproval, setRequirePlanApproval] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('projects').select('*').order('name').then(({ data }) => {
      if (data) {
        setProjects(data)
        if (data.length > 0) setProjectId(data[0].id)
      }
    })
    supabase.from('github_repos').select('*').order('pushed_at', { ascending: false }).then(({ data }) => {
      if (data) setAllRepos(data)
    })
  }, [])

  const applyTemplate = (template: BriefTemplate) => {
    const d = template.defaults
    if (d.outcome_tier) setOutcomeTier(d.outcome_tier)
    if (d.outcome_type) setOutcomeType(d.outcome_type)
    if (d.impact_score) setImpactScore(d.impact_score)
    if (d.fast_track !== undefined) setFastTrack(d.fast_track)
    if (d.auto_deploy !== undefined) setAutoDeploy(d.auto_deploy)
    if (d.brief_type) setBriefType(d.brief_type)
    setStep('form')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const supabase = createClient()
    const selectedProject = projects.find(p => p.id === projectId)
    const finalRepoUrl = selectedProject?.repo_url || repoUrl || null

    const { data: newBrief, error } = await supabase
      .from('briefs')
      .insert({
        title,
        brief,
        brief_type: briefType,
        project_id: projectId || null,
        repo_url: finalRepoUrl,
        outcome_tier: outcomeTier,
        outcome_type: outcomeType,
        impact_score: impactScore,
        fast_track: fastTrack,
        auto_deploy: autoDeploy,
        require_plan_approval: requirePlanApproval,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create brief:', error)
      setSubmitting(false)
      return
    }

    // Insert acceptance criteria
    const validCriteria = criteria.filter(c => c.trim())
    if (validCriteria.length > 0 && newBrief) {
      await supabase.from('acceptance_criteria').insert(
        validCriteria.map((c, i) => ({
          brief_id: newBrief.id,
          criterion: c.trim(),
          sort_order: i,
        }))
      )
    }

    onClose()
  }

  const addCriterion = () => setCriteria([...criteria, ''])
  const updateCriterion = (index: number, value: string) => {
    const newCriteria = [...criteria]
    newCriteria[index] = value
    setCriteria(newCriteria)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold">
            {step === 'template' ? 'Choose a Template' : 'New Brief'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            &#x2715;
          </button>
        </div>

        {step === 'template' ? (
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {BRIEF_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  className="text-left bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-lg p-4 transition-colors"
                >
                  <div className="text-2xl mb-2">{template.icon}</div>
                  <h3 className="font-medium text-sm text-white">{template.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1">{template.description}</p>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep('form')}
              className="w-full text-center py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Blank brief
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Back to templates */}
            {!defaultValues && (
              <button
                type="button"
                onClick={() => setStep('template')}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                &larr; Back to templates
              </button>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What do you want to build?"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500"
                required
                autoFocus
              />
            </div>

            {/* Brief */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Brief</label>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder="Describe what you want in plain language..."
                rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 resize-none"
                required
              />
            </div>

            {/* Project */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Project</label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Repo URL */}
            <div className="relative">
              <label className="block text-sm font-medium text-zinc-400 mb-1">Repository</label>
              {(() => {
                const selectedProject = projects.find(p => p.id === projectId)
                if (selectedProject?.repo_url) {
                  return (
                    <div className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-400 text-sm">
                      {selectedProject.repo_url}
                    </div>
                  )
                }
                const filteredRepos = repoQuery
                  ? allRepos.filter(r =>
                      r.full_name.toLowerCase().includes(repoQuery.toLowerCase()) ||
                      (r.description && r.description.toLowerCase().includes(repoQuery.toLowerCase()))
                    )
                  : allRepos.slice(0, 10)
                return (
                  <>
                    <input
                      ref={repoInputRef}
                      type="text"
                      value={repoQuery || repoUrl}
                      onChange={e => {
                        setRepoQuery(e.target.value)
                        setRepoUrl(e.target.value)
                        setShowRepoSuggestions(true)
                      }}
                      onFocus={() => setShowRepoSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowRepoSuggestions(false), 200)}
                      placeholder="Search repos or paste URL..."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 text-sm"
                    />
                    {showRepoSuggestions && filteredRepos.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg max-h-48 overflow-y-auto">
                        {filteredRepos.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onMouseDown={() => {
                              setRepoUrl(r.html_url)
                              setRepoQuery(r.full_name)
                              setShowRepoSuggestions(false)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-zinc-700 text-sm transition-colors"
                          >
                            <span className="text-white">{r.full_name}</span>
                            {r.language && (
                              <span className="text-zinc-500 ml-2">{r.language}</span>
                            )}
                            {r.description && (
                              <p className="text-xs text-zinc-500 truncate">{r.description}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Brief Type */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setBriefType('build'); setAutoDeploy(false) }}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    briefType === 'build'
                      ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  Build
                  <span className="block text-xs text-zinc-500 font-normal mt-0.5">Code changes, PR</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setBriefType('run'); setAutoDeploy(false) }}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    briefType === 'run'
                      ? 'bg-violet-600/20 text-violet-400 border-violet-500/50'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  Run
                  <span className="block text-xs text-zinc-500 font-normal mt-0.5">Decks, docs, tasks</span>
                </button>
              </div>
            </div>

            {/* Strategic Alignment */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Outcome Tier</label>
                <select
                  value={outcomeTier}
                  onChange={e => {
                    const tier = Number(e.target.value)
                    setOutcomeTier(tier)
                    setOutcomeType(OUTCOME_TYPES[tier][0])
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                >
                  {OUTCOME_TIERS.map(t => (
                    <option key={t.value} value={t.value}>{t.name}</option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 mt-1">
                  {OUTCOME_TIERS.find(t => t.value === outcomeTier)?.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Outcome Type</label>
                <select
                  value={outcomeType}
                  onChange={e => setOutcomeType(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                >
                  {OUTCOME_TYPES[outcomeTier].map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Impact Score */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Impact Score: <span className="text-orange-400">{impactScore}/10</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={impactScore}
                onChange={e => setImpactScore(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Low impact</span>
                <span>High impact</span>
              </div>
            </div>

            {/* Acceptance Criteria */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Acceptance Criteria
              </label>
              {criteria.map((c, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={c}
                    onChange={e => updateCriterion(i, e.target.value)}
                    placeholder={`Criterion ${i + 1}`}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 text-sm"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addCriterion}
                className="text-sm text-orange-400 hover:text-orange-300"
              >
                + Add criterion
              </button>
            </div>

            {/* Pipeline Mode */}
            <div className="space-y-3 pt-2">
              <label className="block text-sm font-medium text-zinc-400">Pipeline Mode</label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={fastTrack}
                    onChange={e => setFastTrack(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-700 rounded-full peer-checked:bg-orange-600 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                </div>
                <div>
                  <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Fast-track</span>
                  <p className="text-xs text-zinc-500">Skip evaluation panel and critic — straight to plan and build</p>
                </div>
              </label>
              {briefType === 'build' && (
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={autoDeploy}
                      onChange={e => setAutoDeploy(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-700 rounded-full peer-checked:bg-red-600 transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                  </div>
                  <div>
                    <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Auto-deploy</span>
                    <p className="text-xs text-zinc-500">Merge PR and deploy to production automatically after build</p>
                  </div>
                </label>
              )}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={requirePlanApproval}
                    onChange={e => setRequirePlanApproval(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-700 rounded-full peer-checked:bg-blue-600 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                </div>
                <div>
                  <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Require plan approval</span>
                  <p className="text-xs text-zinc-500">Pause pipeline after planning for manual review before building</p>
                </div>
              </label>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Brief'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
