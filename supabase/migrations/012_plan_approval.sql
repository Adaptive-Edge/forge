-- Plan approval gate: allow briefs to require manual plan approval before building
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS require_plan_approval BOOLEAN DEFAULT false;
