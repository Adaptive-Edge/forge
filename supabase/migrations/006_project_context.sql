-- Phase 4: Project context for smarter agents
-- local_path: where the project lives on this machine (for file access)
-- context_notes: human-readable description for agents

ALTER TABLE projects ADD COLUMN local_path TEXT;
ALTER TABLE projects ADD COLUMN context_notes TEXT;

-- Seed known projects
UPDATE projects SET
  local_path = '/Users/nathan/forge',
  context_notes = 'Next.js 14 app with Supabase backend. Agents in /agents, UI components in /src/components, Supabase migrations in /supabase/migrations. Read CLAUDE.md if present.'
WHERE name = 'Forge';

UPDATE projects SET
  local_path = '/Users/nathan/adaptive-edge-apps/apps/strategyos',
  context_notes = 'Monorepo app. Express API + Vite React client. Port 5015, PM2: strategyos-api, MySQL DB. Has its own CLAUDE.md with full config.'
WHERE name = 'StrategyOS';

UPDATE projects SET
  context_notes = 'Client project for Arjo. Documents and transcription work — check context before assuming code.'
WHERE name = 'Arjo';
