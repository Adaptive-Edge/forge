-- Pipeline tracking columns for multi-agent evaluation flow
ALTER TABLE briefs ADD COLUMN pipeline_stage text DEFAULT NULL;
ALTER TABLE briefs ADD COLUMN architect_plan text DEFAULT NULL;

-- Widen build_logs.action from VARCHAR(100) to TEXT
-- Agent messages frequently exceed 100 chars
ALTER TABLE build_logs ALTER COLUMN action TYPE text;
