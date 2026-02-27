'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function HeaderActions() {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const router = useRouter()

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/sync-repos', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setSyncResult(`${data.synced} repos`)
    } else {
      setSyncResult('Failed')
    }
    setSyncing(false)
    setTimeout(() => setSyncResult(null), 3000)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50 transition-colors"
      >
        {syncing ? 'Syncing...' : syncResult || 'Sync Repos'}
      </button>
      <button
        onClick={handleLogout}
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        Logout
      </button>
    </>
  )
}
