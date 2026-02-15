'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Project } from '@/lib/types'

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

export function NewBriefModal({ onClose }: { onClose: () => void }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [projectId, setProjectId] = useState('')
  const [outcomeTier, setOutcomeTier] = useState(2)
  const [outcomeType, setOutcomeType] = useState('Productivity & Time')
  const [impactScore, setImpactScore] = useState(5)
  const [criteria, setCriteria] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('projects').select('*').order('name').then(({ data }) => {
      if (data) {
        setProjects(data)
        if (data.length > 0) setProjectId(data[0].id)
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const supabase = createClient()
    const { data: newBrief, error } = await supabase
      .from('briefs')
      .insert({
        title,
        brief,
        project_id: projectId || null,
        outcome_tier: outcomeTier,
        outcome_type: outcomeType,
        impact_score: impactScore,
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
          <h2 className="text-lg font-semibold">New Brief</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
      </div>
    </div>
  )
}
