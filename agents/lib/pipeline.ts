import { callClaude } from './claude'
import {
  logBuild, updateBrief, fetchBriefWithProject,
  writeDeliberationRound, fetchDeliberationRounds, writeDecisionReport,
  writeEvaluation, fetchBriefHistory,
} from './supabase'
import { architectPrompt, architectRevisionPrompt, architectFeedbackPrompt, builderPrompt, criticPrompt, deliberationPrompt } from './prompts'
import { runGatekeeper, runSkeptic, runCynic, runAccountant, parseEvaluation } from './evaluators'
import type { EvaluationResult, Verdict } from './types'

const EVALUATOR_AGENTS = [
  { name: 'Gatekeeper', slug: 'gatekeeper', runner: runGatekeeper },
  { name: 'Skeptic', slug: 'skeptic', runner: runSkeptic },
  { name: 'Cynic', slug: 'cynic', runner: runCynic },
  { name: 'Accountant', slug: 'accountant', runner: runAccountant },
]

export async function runEvaluation(briefId: string): Promise<boolean> {
  const brief = await fetchBriefWithProject(briefId)

  // Guard: only proceed if brief is still in evaluating status
  if (brief.status !== 'evaluating') {
    console.log(`  [Pipeline] Brief status is '${brief.status}', not 'evaluating' — skipping`)
    return false
  }

  // Fetch brief history once for all agents
  let history: Awaited<ReturnType<typeof fetchBriefHistory>> | undefined
  try {
    history = await fetchBriefHistory()
    console.log(`  [Pipeline] Loaded ${history.length} historical briefs for agent context`)
  } catch {
    console.log('  [Pipeline] Could not fetch brief history, proceeding without it')
  }

  // --- Round 1: All 4 agents evaluate independently in parallel ---
  await updateBrief(briefId, { pipeline_stage: 'gatekeeper' })
  await logBuild(briefId, 'Pipeline', 'Round 1: 4 agents evaluating independently...')
  console.log('  [Pipeline] Round 1: Gatekeeper, Skeptic, Cynic, Accountant evaluating...')

  const settled = await Promise.allSettled(
    EVALUATOR_AGENTS.map(async (agent) => {
      const result = await agent.runner(brief, history)
      return { slug: agent.slug, result }
    })
  )

  const round1Results: { slug: string; result: EvaluationResult }[] = []
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i]
    if (s.status === 'fulfilled') {
      round1Results.push(s.value)
    } else {
      const agent = EVALUATOR_AGENTS[i]
      const msg = s.reason instanceof Error ? s.reason.message : 'Unknown error'
      console.log(`  [${agent.name}] FAILED: ${msg}`)
      await logBuild(briefId, agent.name, `Evaluation failed: ${msg}`, 'error')
    }
  }

  if (round1Results.length < 2) {
    await logBuild(briefId, 'Pipeline', `Only ${round1Results.length} agent(s) completed Round 1 — need at least 2 to proceed`, 'error')
    await updateBrief(briefId, { status: 'intake', pipeline_stage: null })
    return false
  }

  // Store Round 1 in deliberation_rounds
  await Promise.all(
    round1Results.map(({ slug, result }) =>
      writeDeliberationRound(briefId, slug, 1, {
        verdict: result.verdict,
        reasoning: result.reasoning,
        confidence: result.confidence,
      })
    )
  )

  // --- Round 2: Deliberation — agents see each other's verdicts and can revise ---
  await updateBrief(briefId, { pipeline_stage: 'deliberating' })
  await logBuild(briefId, 'Pipeline', 'Round 2: Agents deliberating after seeing team verdicts...')
  console.log('  [Pipeline] Round 2: Deliberation — agents reviewing each other\'s reasoning...')

  const round1ForPrompt = round1Results.map(({ slug, result }) => ({
    agent_slug: slug,
    verdict: result.verdict,
    reasoning: result.reasoning,
    confidence: result.confidence,
  }))

  // Only deliberate agents that succeeded in Round 1
  const round1Agents = EVALUATOR_AGENTS.filter(a => round1Results.some(r => r.slug === a.slug))

  const settled2 = await Promise.allSettled(
    round1Agents.map(async (agent) => {
      const output = await callClaude(deliberationPrompt(brief, round1ForPrompt))
      const result = parseEvaluation(output)

      const round1Verdict = round1Results.find(r => r.slug === agent.slug)?.result.verdict
      const revisedFrom = round1Verdict && round1Verdict !== result.verdict ? round1Verdict : undefined

      if (revisedFrom) {
        console.log(`  [${agent.name}] REVISED: ${revisedFrom} -> ${result.verdict}: ${result.reasoning}`)
        await logBuild(briefId, agent.name, `Revised verdict: ${revisedFrom} \u2192 ${result.verdict} \u2014 ${result.reasoning}`)
      } else {
        console.log(`  [${agent.name}] Held firm: ${result.verdict}: ${result.reasoning}`)
        await logBuild(briefId, agent.name, `Held firm: ${result.verdict} \u2014 ${result.reasoning}`)
      }

      return { slug: agent.slug, result, revisedFrom }
    })
  )

  const round2Results: { slug: string; result: EvaluationResult; revisedFrom?: Verdict }[] = []
  for (let i = 0; i < settled2.length; i++) {
    const s = settled2[i]
    if (s.status === 'fulfilled') {
      round2Results.push(s.value)
    } else {
      const agent = round1Agents[i]
      const msg = s.reason instanceof Error ? s.reason.message : 'Unknown error'
      console.log(`  [${agent.name}] Deliberation failed: ${msg}`)
      await logBuild(briefId, agent.name, `Deliberation failed: ${msg}`, 'error')
      // Fall back to Round 1 result for this agent
      const r1 = round1Results.find(r => r.slug === agent.slug)
      if (r1) round2Results.push({ slug: r1.slug, result: r1.result })
    }
  }

  // Store Round 2 in deliberation_rounds
  await Promise.all(
    round2Results.map(({ slug, result, revisedFrom }) =>
      writeDeliberationRound(briefId, slug, 2, {
        verdict: result.verdict,
        reasoning: result.reasoning,
        confidence: result.confidence,
      }, revisedFrom)
    )
  )

  // --- Confidence-Weighted Voting ---
  await updateBrief(briefId, { pipeline_stage: 'voting' })

  // Use Round 2 (final) verdicts for scoring
  // approve = +confidence, concern = +confidence * 0.3, reject = -confidence
  let weightedScore = 0
  const agentVotes: string[] = []
  const dissenters: string[] = []

  for (const { slug, result } of round2Results) {
    let contribution: number
    if (result.verdict === 'approve') {
      contribution = result.confidence
    } else if (result.verdict === 'concern') {
      contribution = result.confidence * 0.3
    } else {
      contribution = -result.confidence
    }
    weightedScore += contribution
    agentVotes.push(`${slug}: ${result.verdict} (conf ${result.confidence}, score ${contribution > 0 ? '+' : ''}${contribution.toFixed(1)})`)

    if (result.verdict === 'reject') {
      dissenters.push(`${slug}: ${result.reasoning}`)
    }
  }

  const approved = weightedScore > 0
  const voteSummary = agentVotes.join(', ')
  const summary = `Weighted vote: ${weightedScore.toFixed(1)} \u2192 ${approved ? 'APPROVED' : 'REJECTED'} | ${voteSummary}`

  await logBuild(briefId, 'Pipeline', summary, approved ? 'info' : 'warn')
  console.log(`  [Pipeline] ${summary}`)

  // Write decision report
  const decisionSummary = approved
    ? `Brief approved with weighted score ${weightedScore.toFixed(1)}. ${round2Results.filter(r => r.result.verdict === 'approve').length} approvals, ${round2Results.filter(r => r.result.verdict === 'concern').length} concerns, ${round2Results.filter(r => r.result.verdict === 'reject').length} rejections.`
    : `Brief rejected with weighted score ${weightedScore.toFixed(1)}. The team's concerns outweighed support.`

  await writeDecisionReport(briefId, {
    decision: approved ? 'approved' : 'rejected',
    summary: decisionSummary,
    weighted_score: weightedScore,
    dissenting_views: dissenters.length > 0 ? dissenters.join(' | ') : null,
  })

  if (!approved) {
    const reasoning = round2Results
      .filter(r => r.result.verdict === 'reject')
      .map(r => r.result.reasoning)
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

  const localPath = brief.project?.local_path

  try {
    const plan = await callClaude(architectPrompt(brief), {
      model: 'sonnet',
      ...(localPath && {
        cwd: localPath,
        allowedTools: ['Read', 'Glob', 'Grep'],
      }),
    })

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

export async function runCriticReview(briefId: string): Promise<boolean> {
  await updateBrief(briefId, { pipeline_stage: 'critic_review' })
  const brief = await fetchBriefWithProject(briefId)

  if (!brief.architect_plan) {
    await logBuild(briefId, 'Critic', 'No architect plan found \u2014 skipping review', 'warn')
    return true
  }

  await logBuild(briefId, 'Critic', 'Reviewing architect\'s plan...')
  console.log('  [Critic] Reviewing plan...')

  let currentPlan = brief.architect_plan
  const MAX_REVISIONS = 2

  for (let revision = 0; revision < MAX_REVISIONS; revision++) {
    try {
      const output = await callClaude(criticPrompt(brief, currentPlan), { model: 'sonnet' })
      const result = parseEvaluation(output)

      // Store Critic's evaluation
      await writeEvaluation(briefId, 'critic', 'plan_review', {
        verdict: result.verdict,
        reasoning: result.reasoning,
        confidence: result.confidence,
      })

      const emoji = result.verdict === 'approve' ? '\u2713' : result.verdict === 'reject' ? '\u2717' : '\u26A0'
      await logBuild(
        briefId,
        'Critic',
        `${emoji} Plan ${result.verdict === 'approve' ? 'approved' : result.verdict + 'ed'} \u2014 ${result.reasoning}`,
        result.verdict === 'reject' ? 'warn' : 'info'
      )
      console.log(`  [Critic] ${result.verdict}: ${result.reasoning}`)

      if (result.verdict === 'approve') {
        return true
      }

      // Critic has concerns — ask Architect to revise
      if (revision < MAX_REVISIONS - 1) {
        await logBuild(briefId, 'Pipeline', `Critic raised concerns (round ${revision + 1}). Architect revising plan...`)
        console.log(`  [Pipeline] Architect revising plan (round ${revision + 2})...`)

        const localPath = brief.project?.local_path
        const revisedPlan = await callClaude(
          architectRevisionPrompt(brief, currentPlan, result.reasoning),
          {
            model: 'sonnet',
            ...(localPath && {
              cwd: localPath,
              allowedTools: ['Read', 'Glob', 'Grep'],
            }),
          }
        )

        currentPlan = revisedPlan
        await updateBrief(briefId, { architect_plan: revisedPlan })
        await logBuild(briefId, 'Architect', `Plan revised (v${revision + 2}) addressing Critic feedback`)
        console.log(`  [Architect] Plan revised (v${revision + 2})`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      await logBuild(briefId, 'Critic', `Review failed: ${msg}`, 'error')
      // Proceed to building anyway — Critic failure shouldn't block
      return true
    }
  }

  // Max revisions reached — proceed anyway
  await logBuild(briefId, 'Pipeline', 'Max Critic revisions reached. Proceeding to build.', 'warn')
  console.log('  [Pipeline] Max Critic revisions reached. Proceeding to build.')
  return true
}

export async function runBuilding(briefId: string): Promise<boolean> {
  await updateBrief(briefId, { pipeline_stage: 'building' })
  const brief = await fetchBriefWithProject(briefId)

  if (!brief.architect_plan) {
    await logBuild(briefId, 'Builder', 'No architect plan found \u2014 cannot build', 'error')
    await updateBrief(briefId, { status: 'review', pipeline_stage: null })
    return false
  }

  // Prefer project local_path, fall back to deriving from repo_url
  let cwd = brief.project?.local_path
  if (!cwd) {
    const repoUrl = brief.project?.repo_url || brief.repo_url
    if (!repoUrl) {
      await logBuild(briefId, 'Builder', 'No repository URL or local path \u2014 cannot build', 'error')
      await updateBrief(briefId, { status: 'review', pipeline_stage: null })
      return false
    }
    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || ''
    const basePath = process.env.REPO_BASE_PATH || '/var/www'
    cwd = `${basePath}/${repoName}`
  }

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

export async function runRevision(briefId: string, feedback: string, revisionNumber: number): Promise<void> {
  console.log(`\n--- Pipeline: revision ${revisionNumber} for brief ${briefId} ---`)

  await updateBrief(briefId, { status: 'building', pipeline_stage: 'planning' })
  const brief = await fetchBriefWithProject(briefId)

  if (!brief.architect_plan) {
    await logBuild(briefId, 'Pipeline', 'No existing plan to revise — running full planning', 'warn')
    await runPlanning(briefId)
  } else {
    // Architect revises plan based on Nathan's feedback
    const localPath = brief.project?.local_path
    await logBuild(briefId, 'Architect', `Revising plan based on feedback (revision ${revisionNumber})...`)
    console.log(`  [Architect] Revising plan (v${revisionNumber + 1})...`)

    try {
      const revisedPlan = await callClaude(
        architectFeedbackPrompt(brief, brief.architect_plan, feedback, revisionNumber),
        {
          model: 'sonnet',
          ...(localPath && {
            cwd: localPath,
            allowedTools: ['Read', 'Glob', 'Grep'],
          }),
        }
      )

      await updateBrief(briefId, { architect_plan: revisedPlan })
      await logBuild(briefId, 'Architect', `Plan revised (v${revisionNumber + 1}) addressing Nathan's feedback`)
      console.log(`  [Architect] Plan revised (v${revisionNumber + 1})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      await logBuild(briefId, 'Architect', `Revision planning failed: ${msg}`, 'error')
      await updateBrief(briefId, { status: 'review', pipeline_stage: null })
      return
    }
  }

  // Skip to build (no evaluation or critic review for revisions)
  await runBuilding(briefId)
  console.log('  [Pipeline] Revision complete')
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

  const criticOk = await runCriticReview(briefId)
  if (!criticOk) {
    console.log('  [Pipeline] Critic review failed, moving to review')
    return
  }

  await runBuilding(briefId)
  console.log('  [Pipeline] Pipeline complete')
}
