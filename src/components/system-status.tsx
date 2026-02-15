'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

type AgentPresence = {
  agent: string
  status: string
  since: string
}

type RecentLog = {
  id: string
  agent: string | null
  action: string | null
  timestamp: string
  log_level: string
}

export function SystemStatus() {
  const [agents, setAgents] = useState<AgentPresence[]>([])
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Subscribe to agent presence
    const presenceChannel = supabase.channel('forge-agents')

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const online: AgentPresence[] = []
        for (const key in state) {
          const presences = state[key] as unknown as AgentPresence[]
          for (const p of presences) {
            online.push(p)
          }
        }
        setAgents(online)
      })
      .subscribe()

    // Fetch recent build logs
    supabase
      .from('build_logs')
      .select('id, agent, action, timestamp, log_level')
      .order('timestamp', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setRecentLogs(data) })

    // Live build log updates
    const logsChannel = supabase
      .channel('system-logs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'build_logs',
      }, (payload) => {
        setRecentLogs(prev => [payload.new as RecentLog, ...prev].slice(0, 5))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(presenceChannel)
      supabase.removeChannel(logsChannel)
    }
  }, [])

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  const agentCount = agents.length
  const hasActivity = recentLogs.length > 0

  return (
    <div className="border-t border-zinc-800 bg-zinc-950">
      {/* Status bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-2 flex items-center justify-between text-xs hover:bg-zinc-900 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Agent status */}
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${
              agentCount > 0 ? 'bg-green-400' : 'bg-zinc-600'
            }`} />
            <span className={agentCount > 0 ? 'text-zinc-300' : 'text-zinc-600'}>
              {agentCount > 0
                ? `${agentCount} agent${agentCount > 1 ? 's' : ''} online`
                : 'No agents connected'
              }
            </span>
          </div>

          {/* Agent names */}
          {agents.map((a, i) => (
            <span key={i} className="text-zinc-500 capitalize">
              {a.agent}
            </span>
          ))}

          {/* Last activity */}
          {hasActivity && (
            <span className="text-zinc-600">
              Last: {recentLogs[0]?.agent} at {formatTime(recentLogs[0]?.timestamp)}
            </span>
          )}
        </div>

        <span className="text-zinc-600">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {/* Expanded log view */}
      {expanded && (
        <div className="px-6 pb-3 space-y-1 border-t border-zinc-800/50">
          <p className="text-xs text-zinc-500 pt-2 pb-1">Recent activity</p>
          {recentLogs.length > 0 ? (
            recentLogs.map((log) => (
              <div key={log.id} className="flex gap-2 text-xs font-mono">
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
                <span className="text-zinc-400 truncate">{log.action}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-zinc-600">No activity yet</p>
          )}
        </div>
      )}
    </div>
  )
}
