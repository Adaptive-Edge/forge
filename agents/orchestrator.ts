#!/usr/bin/env npx tsx
import { supabase, logBuild } from './lib/supabase'
import { advancePipeline, runRevision } from './lib/pipeline'

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

async function main() {
  console.log('\n\uD83D\uDD25 Forge Orchestrator (Phase 4)')
  console.log('  Pipeline: Evaluate (4 agents) \u2192 Deliberate \u2192 Vote \u2192 Plan \u2192 Critic \u2192 Build')
  console.log('  + Revision loop: Feedback \u2192 Revise Plan \u2192 Re-build')
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

  // Watch for briefs entering evaluating status
  supabase
    .channel('orchestrator-watch')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'briefs',
    }, async (payload) => {
      const brief = payload.new as { id: string; title: string; status: string }
      if (brief.status === 'evaluating') {
        console.log(`\n\uD83D\uDCCB "${brief.title}"`)
        processBrief(brief.id, brief.title)
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
