-- Phase 5: Fast-track mode and auto-deploy
-- fast_track: skip evaluation panel and critic, go straight to plan → build
-- auto_deploy: after build, merge PR and deploy to production automatically

ALTER TABLE briefs ADD COLUMN fast_track BOOLEAN DEFAULT false;
ALTER TABLE briefs ADD COLUMN auto_deploy BOOLEAN DEFAULT false;
