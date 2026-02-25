-- Phase 5b: Run brief support
-- output_path: stores file path(s) for deliverables produced by run briefs

ALTER TABLE briefs ADD COLUMN output_path TEXT;
