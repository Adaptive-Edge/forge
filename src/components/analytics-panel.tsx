'use client'

import { useState, useEffect } from 'react'

type AnalyticsData = {
  statusDistribution: Record<string, number>
  completedPerWeek: { week: string; count: number }[]
  avgDuration: number | null
  agentApprovalRates: { agent: string; rate: number; total: number }[]
  tokenUsage: { date: string; input: number; output: number }[]
  topProjects: { name: string; count: number }[]
}

export function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="px-6 pt-4 pb-2">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 animate-pulse">
              <div className="h-4 bg-zinc-800 rounded w-16 mb-2" />
              <div className="h-8 bg-zinc-800 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const statusColors: Record<string, string> = {
    intake: 'text-zinc-400',
    evaluating: 'text-amber-400',
    building: 'text-blue-400',
    review: 'text-purple-400',
    done: 'text-emerald-400',
  }

  const totalBriefs = Object.values(data.statusDistribution).reduce((a, b) => a + b, 0)

  return (
    <div className="px-6 pt-4 pb-2">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Briefs by status */}
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <h3 className="text-xs text-zinc-500 mb-2">Briefs by Status</h3>
          <p className="text-2xl font-bold text-white mb-2">{totalBriefs}</p>
          <div className="space-y-1">
            {Object.entries(data.statusDistribution).map(([status, count]) => (
              <div key={status} className="flex justify-between text-xs">
                <span className={statusColors[status] || 'text-zinc-400'}>{status}</span>
                <span className="text-zinc-500">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Completed per week */}
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <h3 className="text-xs text-zinc-500 mb-2">Completed / Week</h3>
          {data.completedPerWeek.length > 0 ? (
            <div className="space-y-1">
              {data.completedPerWeek.slice(-4).map(w => (
                <div key={w.week} className="flex justify-between text-xs">
                  <span className="text-zinc-400">{w.week}</span>
                  <span className="text-emerald-400 font-medium">{w.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-600">No completions yet</p>
          )}
        </div>

        {/* Avg pipeline duration */}
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <h3 className="text-xs text-zinc-500 mb-2">Avg Duration</h3>
          <p className="text-2xl font-bold text-white">
            {data.avgDuration ? `${Math.round(data.avgDuration)}m` : '--'}
          </p>
          <p className="text-xs text-zinc-600 mt-1">pipeline time</p>
        </div>

        {/* Agent approval rates */}
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <h3 className="text-xs text-zinc-500 mb-2">Approval Rates</h3>
          <div className="space-y-1.5">
            {data.agentApprovalRates.map(a => (
              <div key={a.agent}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-zinc-400 capitalize">{a.agent}</span>
                  <span className="text-zinc-300">{Math.round(a.rate * 100)}%</span>
                </div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full"
                    style={{ width: `${a.rate * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Token usage */}
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <h3 className="text-xs text-zinc-500 mb-2">Token Usage</h3>
          {data.tokenUsage.length > 0 ? (
            <div className="space-y-1">
              {data.tokenUsage.slice(-4).map(d => (
                <div key={d.date} className="flex justify-between text-xs">
                  <span className="text-zinc-400">{d.date}</span>
                  <span className="text-zinc-300">{((d.input + d.output) / 1000).toFixed(1)}k</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-600">No token data yet</p>
          )}
        </div>

        {/* Top projects */}
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <h3 className="text-xs text-zinc-500 mb-2">Top Projects</h3>
          <div className="space-y-1">
            {data.topProjects.slice(0, 5).map((p, i) => (
              <div key={p.name} className="flex justify-between text-xs">
                <span className="text-zinc-400 truncate mr-2">
                  {i + 1}. {p.name}
                </span>
                <span className="text-zinc-300 shrink-0">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
