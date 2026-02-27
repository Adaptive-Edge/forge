import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type GitHubRepoResponse = {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  private: boolean
  default_branch: string
  owner: { login: string }
  language: string | null
  pushed_at: string | null
}

async function fetchAllRepos(url: string, token: string): Promise<GitHubRepoResponse[]> {
  const all: GitHubRepoResponse[] = []
  let page = 1

  while (true) {
    const res = await fetch(`${url}?per_page=100&page=${page}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    })

    if (!res.ok) break

    const repos: GitHubRepoResponse[] = await res.json()
    if (repos.length === 0) break

    all.push(...repos)
    if (repos.length < 100) break
    page++
  }

  return all
}

export async function POST() {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'GITHUB_TOKEN not configured' }, { status: 500 })
  }

  const [userRepos, orgRepos] = await Promise.all([
    fetchAllRepos('https://api.github.com/users/natcrypto/repos', token),
    fetchAllRepos('https://api.github.com/orgs/Adaptive-Edge/repos', token),
  ])

  const allRepos = [...userRepos, ...orgRepos]

  const rows = allRepos.map(r => ({
    github_id: r.id,
    name: r.name,
    full_name: r.full_name,
    html_url: r.html_url,
    description: r.description,
    is_private: r.private,
    default_branch: r.default_branch,
    owner_login: r.owner.login,
    language: r.language,
    pushed_at: r.pushed_at,
    synced_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('github_repos')
    .upsert(rows, { onConflict: 'github_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ synced: rows.length })
}
