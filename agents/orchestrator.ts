#!/usr/bin/env npx tsx
import { supabase, logBuild } from './lib/supabase'
import { advancePipeline, runRevision, resumeFromPlan, processFromBuild } from './lib/pipeline'

const processingQueue = new Set<string>()

async function processBrief(briefId: string, title: string) {
  if (processingQueue.has(briefId)) {
    console.log(`  Skipping "${title}" \u2014 already in pipeline`)
    return
  }

  processingQueue.add(briefId)
  try {
    await advancePipeline(briefId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`  Pipeline error for "${title}":`, msg)
    await logBuild(briefId, 'Orchestrator', `Pipeline error: ${msg}`, 'error')
  } finally {
    processingQueue.delete(briefId)
  }
}

async function processRevision(briefId: string, title: string, feedback: string, revisionNumber: number) {
  if (processingQueue.has(briefId)) {
    console.log(`  Skipping revision for "${title}" \u2014 already in pipeline`)
    return
  }

  processingQueue.add(briefId)
  try {
    await runRevision(briefId, feedback, revisionNumber)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`  Revision error for "${title}":`, msg)
    await logBuild(briefId, 'Orchestrator', `Revision error: ${msg}`, 'error')
  } finally {
    processingQueue.delete(briefId)
  }
}

async function processResume(briefId: string, title: string) {
  if (processingQueue.has(briefId)) {
    console.log(`  Skipping resume for "${title}" \u2014 already in pipeline`)
    return
  }

  processingQueue.add(briefId)
  try {
    await resumeFromPlan(briefId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`  Resume error for "${title}":`, msg)
    await logBuild(briefId, 'Orchestrator', `Resume error: ${msg}`, 'error')
  } finally {
    processingQueue.delete(briefId)
  }
}

async function processPlanApproved(briefId: string, title: string) {
  if (processingQueue.has(briefId)) {
    console.log(`  Skipping plan-approved for "${title}" \u2014 already in pipeline`)
    return
  }

  processingQueue.add(briefId)
  try {
    await processFromBuild(briefId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`  Plan-approved error for "${title}":`, msg)
    await logBuild(briefId, 'Orchestrator', `Plan-approved pipeline error: ${msg}`, 'error')
  } finally {
    processingQueue.delete(briefId)
  }
}

async function main() {
  console.log('\n\uD83D\uDD25 Forge Orchestrator (Phase 5)')
  console.log('  Pipeline: Evaluate (4 agents) \u2192 Deliberate \u2192 Vote \u2192 Plan \u2192 Critic \u2192 Build \u2192 Brand')
  console.log('  + Revision loop: Feedback \u2192 Revise Plan \u2192 Re-build')
  console.log('  + Resume from plan, Plan approval gate')
  console.log('  Watching for briefs...\n')

  // Catch up: process any briefs already in evaluating state
  const { data: pending } = await supabase
    .from('briefs')
    .select('id, title')
    .eq('status', 'evaluating')

  if (pending && pending.length > 0) {
    console.log(`Found ${pending.length} brief(s) waiting for evaluation:`)
    for (const brief of pending) {
      console.log(`\n\uD83D\uDCCB "${brief.title}"`)
      await processBrief(brief.id, brief.title)
    }
  }

  // Track presence — single process represents all agents
  const presenceChannel = supabase.channel('forge-agents')
  presenceChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await presenceChannel.track({
        agent: 'orchestrator',
        status: 'online',
        since: new Date().toISOString(),
      })
    }
  })

  // Watch for briefs entering evaluating status, resume_from_plan, or plan_approved
  supabase
    .channel('orchestrator-watch')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'briefs',
    }, async (payload) => {
      const brief = payload.new as { id: string; title: string; status: string; pipeline_stage: string | null }
      const oldBrief = payload.old as { id: string; pipeline_stage: string | null }

      if (brief.status === 'evaluating') {
        console.log(`\n\uD83D\uDCCB "${brief.title}"`)
        processBrief(brief.id, brief.title)
      }

      // Watch for resume_from_plan transition
      if (brief.pipeline_stage === 'resume_from_plan' && oldBrief.pipeline_stage !== 'resume_from_plan') {
        console.log(`\n\uD83D\uDD04 Resume from plan: "${brief.title}"`)
        processResume(brief.id, brief.title)
      }

      // Watch for plan_approved transition
      if (brief.pipeline_stage === 'plan_approved' && oldBrief.pipeline_stage !== 'plan_approved') {
        console.log(`\n\u2705 Plan approved: "${brief.title}"`)
        processPlanApproved(brief.id, brief.title)
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('\u2713 Connected to Supabase Realtime (briefs)')
      }
    })

  // Watch for new revision requests
  supabase
    .channel('orchestrator-revisions')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'revision_requests',
    }, async (payload) => {
      const request = payload.new as { id: string; brief_id: string; feedback: string; revision_number: number }
      console.log(`\n\uD83D\uDD04 Revision request for brief ${request.brief_id}`)

      // Fetch brief title for logging
      const { data: brief } = await supabase
        .from('briefs')
        .select('title')
        .eq('id', request.brief_id)
        .single()

      const title = brief?.title || 'Unknown'

      // Mark revision as in_progress
      await supabase
        .from('revision_requests')
        .update({ status: 'in_progress' })
        .eq('id', request.id)

      await processRevision(request.brief_id, title, request.feedback, request.revision_number)

      // Mark revision as completed
      await supabase
        .from('revision_requests')
        .update({ status: 'completed' })
        .eq('id', request.id)
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('\u2713 Connected to Supabase Realtime (revisions)')
        console.log('  Click "Start Build" on a brief in Forge to trigger the pipeline')
        console.log('  Press Ctrl+C to stop\n')
      }
    })

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...')
    if (processingQueue.size > 0) {
      console.log(`  Waiting for ${processingQueue.size} active pipeline(s)...`)
    }
    await supabase.removeAllChannels()
    process.exit(0)
  })
}

main().catch(console.error)
