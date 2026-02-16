-- Phase 4: Deployment protocol
-- Add deployment_notes column to projects for per-project deployment instructions

ALTER TABLE projects ADD COLUMN deployment_notes TEXT;

-- Seed known project deployment notes
UPDATE projects SET deployment_notes = 'Next.js app deployed via PM2 on adaptiveedge.uk. Apache reverse proxy. Build on server only — never rsync local builds.' WHERE name = 'Forge';
UPDATE projects SET deployment_notes = 'Monorepo app at /var/www/adaptive-edge-apps/apps/strategyos. PM2: strategyos-api, port 5015. Apache reverse proxy. Build on server only.' WHERE name = 'StrategyOS';
