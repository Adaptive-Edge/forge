import { callClaude } from './claude'
import { logBuild, updateBrief, fetchBriefWithProject } from './supabase'
import { architectPrompt, builderPrompt } from './prompts'
import { runGatekeeper, runSkeptic } from './evaluators'
import type { EvaluationResult } from './types'

export async function runEvaluation(briefId: string): Promise<boolean> {
  const brief = await fetchBriefWithProject(briefId)

  await updateBrief(briefId, { pipeline_stage: 'gatekeeper' })

  let results: EvaluationResult[]
  try {
    results = await Promise.all([
      runGatekeeper(brief),
      runSkeptic(brief),
    ])
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    await logBuild(briefId, 'Pipeline', `Evaluation failed: ${msg}`, 'error')
    await updateBrief(briefId, { status: 'intake', pipeline_stage: null })
    return false
  }

  // Tally votes
  await updateBrief(briefId, { pipeline_stage: 'voting' })

  const approvals = results.filter(r => r.verdict === 'approve').length
  const concerns = results.filter(r => r.verdict === 'concern').length
  const rejections = results.filter(r => r.verdict === 'reject').length

  // Majority wins — "concern" counts as soft approve
  const approved = (approvals + concerns) > rejections

  const summary = `Voting: ${approvals} approve, ${concerns} concern, ${rejections} reject \u2192 ${approved ? 'APPROVED' : 'REJECTED'}`
  await logBuild(briefId, 'Pipeline', summary, approved ? 'info' : 'warn')
  console.log(`  [Pipeline] ${summary}`)

  if (!approved) {
    const reasoning = results
      .filter(r => r.verdict === 'reject')
      .map(r => r.reasoning)
      .join(' | ')
    await updateBrief(briefId, {
      status: 'intake',
      pipeline_stage: null,
      rejection_reason: reasoning,
    })
    return false
  }

  return true
}

export async function runPlanning(briefId: string): Promise<boolean> {
  await updateBrief(briefId, { pipeline_stage: 'planning' })
  const brief = await fetchBriefWithProject(briefId)

  await logBuild(briefId, 'Architect', 'Designing implementation plan...')
  console.log('  [Architect] Planning...')

  try {
    const plan = await callClaude(architectPrompt(brief), { model: 'sonnet' })

    await updateBrief(briefId, { architect_plan: plan })

    const firstLine = plan.split('\n').find(l => l.trim()) || 'Plan created'
    await logBuild(briefId, 'Architect', `Plan complete: ${firstLine.substring(0, 100)}`)
    console.log(`  [Architect] Plan complete (${plan.length} chars)`)

    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    await logBuild(briefId, 'Architect', `Planning failed: ${msg}`, 'error')
    await updateBrief(briefId, { status: 'review', pipeline_stage: null })
    return false
  }
}

export async function runBuilding(briefId: string): Promise<boolean> {
  await updateBrief(briefId, { pipeline_stage: 'building' })
  const brief = await fetchBriefWithProject(briefId)

  if (!brief.architect_plan) {
    await logBuild(briefId, 'Builder', 'No architect plan found \u2014 cannot build', 'error')
    await updateBrief(briefId, { status: 'review', pipeline_stage: null })
    return false
  }

  const repoUrl = brief.project?.repo_url || brief.repo_url
  if (!repoUrl) {
    await logBuild(briefId, 'Builder', 'No repository URL \u2014 cannot build', 'error')
    await updateBrief(briefId, { status: 'review', pipeline_stage: null })
    return false
  }

  // Map GitHub URL to repo path on this machine
  const repoName = repoUrl.split('/').pop()?.replace('.git', '') || ''
  const basePath = process.env.REPO_BASE_PATH || '/var/www'
  const cwd = `${basePath}/${repoName}`

  await logBuild(briefId, 'Builder', `Starting build in ${cwd}...`)
  console.log(`  [Builder] Building in ${cwd}...`)

  try {
    const prompt = builderPrompt(brief, brief.architect_plan)

    const output = await callClaude(prompt, {
      model: 'sonnet',
      cwd,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
    })

    // Check if a PR URL was created
    const prMatch = output.match(/https:\/\/github\.com\/[^\s)]+\/pull\/\d+/)
    if (prMatch) {
      await updateBrief(briefId, { pr_url: prMatch[0] })
      await logBuild(briefId, 'Builder', `PR created: ${prMatch[0]}`)
    }

    await logBuild(briefId, 'Builder', 'Build complete')
    await updateBrief(briefId, {
      status: 'review',
      pipeline_stage: 'build_complete',
    })

    console.log('  [Builder] Build complete')
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    await logBuild(briefId, 'Builder', `Build failed: ${msg}`, 'error')
    await updateBrief(briefId, { status: 'review', pipeline_stage: null })
    return false
  }
}

export async function advancePipeline(briefId: string): Promise<void> {
  console.log(`\n--- Pipeline: advancing brief ${briefId} ---`)

  const approved = await runEvaluation(briefId)
  if (!approved) {
    console.log('  [Pipeline] Brief rejected, returning to intake')
    return
  }

  const planned = await runPlanning(briefId)
  if (!planned) {
    console.log('  [Pipeline] Planning failed, moving to review')
    return
  }

  await runBuilding(briefId)
  console.log('  [Pipeline] Pipeline complete')
}
