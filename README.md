# The Forge

A personal autonomous build queue that evaluates, plans, and builds software features through a pipeline of AI agents. Submit an idea in plain language, and a council of opinionated agents decides whether it's worth building, designs the implementation, writes the code, and opens a PR for review.

Built for a solo operator who has too many ideas and not enough time. The agents are deliberately hostile gatekeepers — they exist to protect your time, not to rubber-stamp everything.

## How it works

```
You submit a brief ("Add auth to StrategyOS")
        |
   4 agents evaluate it in parallel
   (Gatekeeper, Skeptic, Cynic, Accountant)
        |
   They deliberate — see each other's verdicts,
   can change their minds or hold firm
        |
   Confidence-weighted vote: approved or rejected
        |
   If approved: Architect designs a plan
        |
   Critic reviews the plan (up to 2 revision rounds)
        |
   Builder executes the plan, creates a PR
        |
   You review, request changes, or merge
```

Everything streams to a Kanban board UI in real time. Every verdict, deliberation, plan, and log entry is persisted and visible.

## The agents

### Evaluation panel (run in parallel, then deliberate)

| Agent | Role | Personality |
|-------|------|-------------|
| **Gatekeeper** | Strategic filter | Evaluates against a 4-tier outcome hierarchy. "Does this actually move the needle?" |
| **Skeptic** | Devil's advocate | Hostile by default. Checks clarity, scope, ROI, duplication. Rejects ~40% of briefs by design. "A brief must earn approval, not be given it." |
| **Cynic** | Pattern recognition | Detects shiny object syndrome, scope creep, displacement activity, building tools instead of using them. "Haven't you done this before?" |
| **Accountant** | Cost-benefit analysis | Calculates realistic time estimates (+50% buffer), opportunity cost, ROI timeline. Tier 3-4 tasks must prove ROI within 2 weeks. |

After independent evaluation (Round 1), agents enter **deliberation** (Round 2) where they see each other's verdicts and can revise their position or hold firm with reasons. A confidence-weighted vote determines the final decision.

### Planning and building

| Agent | Role | Details |
|-------|------|---------|
| **Architect** | Implementation design | Explores the project structure, reads existing patterns, designs a concrete plan with file paths and approach. Uses Claude Opus. |
| **Critic** | Plan review | Validates the Architect's plan before building starts. Checks for missing edge cases, over-engineering, security risks. Can request up to 2 revisions. |
| **Builder** | Code execution | Takes the approved plan and writes the code. Makes atomic commits, pushes a branch, creates a PR. Uses Claude Opus. Never deploys — that's your job. |
| **Brand Guardian** | Design review (advisory) | Reviews the PR diff for design system violations. Advisory only, doesn't block merges. |

## The outcome hierarchy

Briefs are evaluated against a 4-tier hierarchy. Lower tiers are more important and get more generous approval thresholds:

| Tier | Category | Examples | Approval bar |
|------|----------|----------|--------------|
| 1 | Foundation | Health, family, wellbeing | Almost always approved |
| 2 | Leverage | Productivity, efficiency, time | Approved if ROI is clear |
| 3 | Growth | Revenue, client value | Must prove ROI |
| 4 | Reach | Brand, awareness | Needs strong justification |

## Tech stack

- **Frontend:** Next.js 14, React 18, Tailwind CSS 4, @dnd-kit (drag-and-drop Kanban)
- **Backend:** Supabase (Postgres + Realtime + REST API)
- **Agents:** TypeScript, invoked via the Claude CLI (`claude -p`)
- **AI models:** Claude Haiku (evaluators), Claude Sonnet (Critic), Claude Opus (Architect, Builder)
- **Orchestrator:** Long-running Node process that watches Supabase Realtime for status changes and advances the pipeline

## Prerequisites

- **Node.js** 18+
- **Claude Code CLI** installed — the agents spawn `claude -p` as child processes. Install from [claude.ai/download](https://claude.ai/download).
- **Supabase** instance (self-hosted or cloud) with the schema applied

### How agent costs work

The Forge runs all its agents through the Claude Code CLI. You have two options for how you pay:

| Option | How it works | Cost model | Tradeoff |
|--------|-------------|------------|----------|
| **Claude Pro/Max subscription** | Authenticate Claude Code with your Anthropic account. Agents use your subscription allowance. | Fixed monthly fee (from $20/month) | Your machine must stay running while builds process, or install on a cloud server (DigitalOcean, AWS, etc.) |
| **Anthropic API key** | Set `ANTHROPIC_API_KEY` in your `.env.local`. The CLI detects it and bills per-token. | Pay-per-use (~$0.50–$5 per full pipeline run depending on complexity) | No subscription needed, but costs scale with usage |

**If you already have a Claude Pro or Max subscription**, you can run The Forge at no additional cost beyond your existing subscription. The tradeoff is that the orchestrator needs to be running continuously to process the queue — so either keep your laptop open, or install it on a VPS ($5–10/month on DigitalOcean or similar).

For most solo operators, the subscription route is significantly cheaper if you're running more than a handful of builds per month.

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Adaptive-Edge/forge.git
cd forge
npm install
```

### 2. Set up Supabase

Apply the migrations in order to create the schema:

```bash
ls supabase/migrations/
# Run each .sql file against your Supabase database in order (001, 002, etc.)
```

The migrations create tables for briefs, projects, agent evaluations, deliberation rounds, decision reports, build logs, acceptance criteria, and revision requests.

### 3. Configure environment

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-instance.example.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Only needed if using API key billing (omit if using your Claude subscription)
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### 4. Run the UI

```bash
npm run dev
# Opens on http://localhost:3000
```

### 5. Run the orchestrator

In a separate terminal:

```bash
npx tsx agents/orchestrator.ts
```

The orchestrator connects to Supabase Realtime and watches for briefs entering the "evaluating" status. It coordinates the full pipeline automatically.

## Usage

### Via the UI

1. Click **New Brief** on the Kanban board
2. Fill in the title, description, outcome tier, impact score, and optionally acceptance criteria
3. The brief appears in the **Intake** column
4. Click **Start Build** to trigger evaluation
5. Watch the agents deliberate in real time via the Agents and Logs tabs
6. If approved, the brief moves through Planning and Building automatically
7. When complete, review the PR link in the Review column

### Via the Claude Code slash command

If you use Claude Code, the `.claude/commands/forge.md` file provides a `/forge` slash command:

```
/forge Add user authentication to StrategyOS
```

This starts a short interview to refine the brief, then inserts it directly into Supabase.

### Feedback loop

From the Review column, you can submit revision feedback. This triggers a replan-rebuild cycle:

1. Architect revises the plan based on your feedback
2. Builder re-executes the revised plan
3. New commits are pushed to the same PR

## Project configuration

Register your projects in the `projects` table so agents know where to find code and how to build:

| Field | Purpose |
|-------|---------|
| `name` | Project display name |
| `repo_url` | GitHub repo URL |
| `default_branch` | Branch to base work on |
| `local_path` | Absolute path to the project on your machine |
| `deployment_notes` | Human-readable deploy instructions (shown to Builder as context) |
| `context_notes` | Project-specific notes for agents (stack, conventions, gotchas) |

## Adapting for your own use

The agent prompts live in `agents/lib/prompts.ts`. The personas, evaluation criteria, and outcome hierarchy are all defined there — adjust them to match your own priorities and working patterns.

Key things to customise:

- **Outcome hierarchy** — the tiers and what they mean to you
- **Agent personas** — make the Skeptic more or less hostile, teach the Cynic your own bad habits
- **Model selection** — evaluators use Haiku for speed, Architect/Builder use Opus for quality. Tune the cost/quality tradeoff in `agents/lib/pipeline.ts`
- **Path resolution** — `agents/lib/claude.ts` maps local paths to server paths for the Builder. Update for your own environment.

## Key files

```
agents/
  orchestrator.ts          # Event loop — watches Realtime, advances pipeline
  gatekeeper.ts            # Standalone evaluator (also available in pipeline)
  lib/
    pipeline.ts            # Full pipeline: evaluation, planning, critic, building
    evaluators.ts          # The 4 evaluator functions + Brand Guardian
    prompts.ts             # All agent system prompts and personas
    claude.ts              # Spawns Claude CLI as child process
    supabase.ts            # Database helpers
    types.ts               # TypeScript types

src/
  app/page.tsx             # Home — Kanban board + system status
  components/
    kanban-board.tsx        # 4-column board with real-time updates
    brief-card.tsx          # Card UI with tier colours and pipeline stage
    brief-detail-panel.tsx  # Detail view: agents, plan, logs, feedback tabs
    new-brief-modal.tsx     # Brief submission form
    system-status.tsx       # Agent presence and recent logs

supabase/
  migrations/              # SQL schema (run in order: 001, 002, etc.)
```

## Licence

MIT
