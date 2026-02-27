import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()

  // Briefs by status
  const { data: allBriefs } = await supabase
    .from('briefs')
    .select('id, status, project_id, created_at, updated_at, brief_type')

  const statusDistribution: Record<string, number> = {}
  const projectCounts: Record<string, number> = {}
  const completedByWeek: Record<string, number> = {}
  let totalDuration = 0
  let durationCount = 0

  for (const b of allBriefs || []) {
    statusDistribution[b.status] = (statusDistribution[b.status] || 0) + 1

    if (b.project_id) {
      projectCounts[b.project_id] = (projectCounts[b.project_id] || 0) + 1
    }

    if (b.status === 'done' || b.status === 'review') {
      // Week key
      const d = new Date(b.updated_at || b.created_at)
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toISOString().split('T')[0]
      if (b.status === 'done') {
        completedByWeek[key] = (completedByWeek[key] || 0) + 1
      }

      // Duration (minutes)
      if (b.created_at && b.updated_at) {
        const mins = (new Date(b.updated_at).getTime() - new Date(b.created_at).getTime()) / 60000
        if (mins > 0 && mins < 10000) {
          totalDuration += mins
          durationCount++
        }
      }
    }
  }

  // Completed per week
  const completedPerWeek = Object.entries(completedByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }))

  // Avg duration
  const avgDuration = durationCount > 0 ? totalDuration / durationCount : null

  // Agent approval rates from decision_reports
  const { data: evaluations } = await supabase
    .from('agent_evaluations')
    .select('agent_slug, verdict')

  const agentStats: Record<string, { approve: number; total: number }> = {}
  for (const e of evaluations || []) {
    if (!agentStats[e.agent_slug]) agentStats[e.agent_slug] = { approve: 0, total: 0 }
    agentStats[e.agent_slug].total++
    if (e.verdict === 'approve') agentStats[e.agent_slug].approve++
  }

  const agentApprovalRates = Object.entries(agentStats)
    .map(([agent, s]) => ({ agent, rate: s.total > 0 ? s.approve / s.total : 0, total: s.total }))
    .sort((a, b) => b.total - a.total)

  // Token usage by day
  const { data: logs } = await supabase
    .from('build_logs')
    .select('timestamp, input_tokens, output_tokens')
    .not('input_tokens', 'is', null)
    .order('timestamp', { ascending: true })

  const tokenByDay: Record<string, { input: number; output: number }> = {}
  for (const l of logs || []) {
    const day = new Date(l.timestamp).toISOString().split('T')[0]
    if (!tokenByDay[day]) tokenByDay[day] = { input: 0, output: 0 }
    tokenByDay[day].input += l.input_tokens || 0
    tokenByDay[day].output += l.output_tokens || 0
  }

  const tokenUsage = Object.entries(tokenByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, t]) => ({ date, ...t }))

  // Top projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')

  const projectNameMap = new Map((projects || []).map(p => [p.id, p.name]))
  const topProjects = Object.entries(projectCounts)
    .map(([id, count]) => ({ name: projectNameMap.get(id) || 'Unknown', count }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({
    statusDistribution,
    completedPerWeek,
    avgDuration,
    agentApprovalRates,
    tokenUsage,
    topProjects,
  })
}
