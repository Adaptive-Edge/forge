#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import { callClaude } from './lib/claude'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const OUTCOME_TIERS: Record<number, string> = {
  1: 'Foundation (Health, Family)',
  2: 'Leverage (Productivity, Efficiency)',
  3: 'Growth (Revenue, Client Value)',
  4: 'Reach (Brand, Customer Attraction)',
}

async function evaluateBrief(briefId: string) {
  const { data: brief, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('id', briefId)
    .single()

  if (error || !brief) {
    console.error('  Failed to fetch brief:', error)
    return
  }

  // Fetch project name
  let projectName = 'Unassigned'
  if (brief.project_id) {
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', brief.project_id)
      .single()
    if (project) projectName = project.name
  }

  // Log start
  await supabase.from('build_logs').insert({
    brief_id: briefId,
    agent: 'Gatekeeper',
    action: 'Evaluating brief against outcome hierarchy...',
    log_level: 'info',
  })

  console.log('  Calling Claude to evaluate...')

  const prompt = `You are the Gatekeeper agent for The Forge, a personal build system owned by Nathan, a strategy consultant who runs Adaptive Edge. Your job is to evaluate briefs against a 4-tier outcome hierarchy and decide whether they should be built.

## Outcome Hierarchy (higher tiers = more fundamental, protect these first):
- Tier 1: Foundation — Health & Wellbeing, Family (most important, protect at all costs)
- Tier 2: Leverage — Productivity & Time, Efficiency (force multipliers)
- Tier 3: Growth — Revenue Potential, Client Value, Project Goals (business growth)
- Tier 4: Reach — Brand Awareness, Customer Attraction (nice to have)

## Rules:
- Lower tier numbers are MORE important. A Tier 1 task should almost always be approved.
- Higher tier tasks (3-4) need strong justification.
- If something is claimed as Tier 2 but is really Tier 4, call it out.
- Be honest and direct. Nathan values blunt assessment over politeness.
- Consider opportunity cost: is there something more important he should be doing?
- A brief about improving The Forge itself is legitimate — it's a Tier 2 productivity tool.

## Brief to evaluate:
- Title: ${brief.title}
- Description: ${brief.brief}
- Project: ${projectName}
- Claimed Outcome Tier: Tier ${brief.outcome_tier} — ${OUTCOME_TIERS[brief.outcome_tier] || 'Unknown'}
- Claimed Outcome Type: ${brief.outcome_type || 'Not specified'}
- Claimed Impact Score: ${brief.impact_score}/10

Respond with ONLY valid JSON (no markdown fences, no commentary, no extra text before or after):
{"verdict":"approve","reasoning":"2-3 sentences explaining your decision","suggested_tier":2,"suggested_impact":7,"confidence":8}`

  try {
    const { result: output } = await callClaude(prompt)

    // Extract JSON from response
    const jsonMatch = output.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response')
    }

    const evaluation = JSON.parse(jsonMatch[0])

    // Validate verdict
    if (!['approve', 'reject', 'concern'].includes(evaluation.verdict)) {
      throw new Error(`Invalid verdict: ${evaluation.verdict}`)
    }

    // Write evaluation
    await supabase.from('agent_evaluations').insert({
      brief_id: briefId,
      agent_slug: 'gatekeeper',
      evaluation_type: 'strategic_filter',
      verdict: evaluation.verdict,
      reasoning: evaluation.reasoning,
      suggestions: {
        suggested_tier: evaluation.suggested_tier,
        suggested_impact: evaluation.suggested_impact,
      },
      confidence: Math.min(10, Math.max(1, evaluation.confidence)),
    })

    // Log result
    const emoji = evaluation.verdict === 'approve' ? '\u2713' : evaluation.verdict === 'reject' ? '\u2717' : '\u26A0'
    await supabase.from('build_logs').insert({
      brief_id: briefId,
      agent: 'Gatekeeper',
      action: `${emoji} Brief ${evaluation.verdict}ed \u2014 ${evaluation.reasoning}`,
      details: evaluation,
      log_level: evaluation.verdict === 'reject' ? 'warn' : 'info',
    })

    // Move approved briefs to building, others back to intake
    const nextStatus = evaluation.verdict === 'approve' ? 'building' : 'intake'
    await supabase.from('briefs').update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', briefId)

    console.log(`  \u2713 ${evaluation.verdict}: ${evaluation.reasoning}`)
    console.log(`    Confidence: ${evaluation.confidence}/10 | Suggested tier: ${evaluation.suggested_tier} | Suggested impact: ${evaluation.suggested_impact}`)

  } catch (err) {
    console.error('  \u2717 Evaluation failed:', err)

    await supabase.from('build_logs').insert({
      brief_id: briefId,
      agent: 'Gatekeeper',
      action: `Evaluation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      log_level: 'error',
    })

    // Reset status
    await supabase.from('briefs').update({
      status: 'intake',
      updated_at: new Date().toISOString(),
    }).eq('id', briefId)
  }
}

let processing = false

async function main() {
  console.log('\n\uD83D\uDD25 Gatekeeper Agent')
  console.log('  Watching for briefs to evaluate...\n')

  // Check for any briefs already in evaluating state
  const { data: pending } = await supabase
    .from('briefs')
    .select('id, title')
    .eq('status', 'evaluating')

  if (pending && pending.length > 0) {
    console.log(`Found ${pending.length} brief(s) waiting for evaluation:`)
    for (const brief of pending) {
      console.log(`\n\uD83D\uDCCB "${brief.title}"`)
      await evaluateBrief(brief.id)
    }
  }

  // Announce presence so the UI knows we're online
  const presenceChannel = supabase.channel('forge-agents')
  presenceChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await presenceChannel.track({
        agent: 'gatekeeper',
        status: 'online',
        since: new Date().toISOString(),
      })
    }
  })

  // Watch for new evaluating briefs via Realtime
  supabase
    .channel('gatekeeper-watch')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'briefs',
    }, async (payload) => {
      const brief = payload.new as { id: string; title: string; status: string }
      if (brief.status === 'evaluating' && !processing) {
        processing = true
        console.log(`\n\uD83D\uDCCB "${brief.title}"`)
        await evaluateBrief(brief.id)
        processing = false
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('\u2713 Connected to Supabase Realtime')
        console.log('  Click "Start Build" on a brief in Forge to trigger evaluation')
        console.log('  Press Ctrl+C to stop\n')
      }
    })
}

main().catch(console.error)
