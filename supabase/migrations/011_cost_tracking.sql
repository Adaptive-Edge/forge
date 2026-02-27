-- Cost tracking: add token usage columns to build_logs
ALTER TABLE build_logs ADD COLUMN IF NOT EXISTS input_tokens INT;
ALTER TABLE build_logs ADD COLUMN IF NOT EXISTS output_tokens INT;
ALTER TABLE build_logs ADD COLUMN IF NOT EXISTS model VARCHAR(50);
