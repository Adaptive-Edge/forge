-- Forge MVP Schema
-- Phase 0-2: Core tables for brief submission and building

-- Projects (which repos/apps can we build for)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  project_type VARCHAR(50) DEFAULT 'internal',
  repo_url VARCHAR(500),
  default_branch VARCHAR(100) DEFAULT 'main',
  extra_agents TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Briefs (the queue items)
CREATE TABLE briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Basic info
  title VARCHAR(255) NOT NULL,
  brief TEXT NOT NULL,
  brief_type VARCHAR(50) DEFAULT 'build',  -- 'build' | 'run'
  status VARCHAR(50) DEFAULT 'intake',

  -- Project & tagging
  project_id UUID REFERENCES projects(id),
  tags TEXT[],

  -- Strategic alignment
  outcome_tier INT CHECK (outcome_tier BETWEEN 1 AND 4),
  outcome_type VARCHAR(100),
  impact_score INT CHECK (impact_score BETWEEN 1 AND 10),
  time_horizon VARCHAR(50),

  -- Approval
  approved BOOLEAN,
  rejection_reason TEXT,

  -- Build details
  repo_url VARCHAR(500),
  branch_name VARCHAR(255),
  pr_url VARCHAR(500),

  -- Estimates
  estimated_hours DECIMAL(4,1),
  actual_hours DECIMAL(4,1),

  -- For RUN briefs
  agent_name VARCHAR(100),
  inputs JSONB,
  target_machine VARCHAR(100),

  -- Owner
  created_by UUID
);

-- Acceptance criteria
CREATE TABLE acceptance_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
  criterion TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  sort_order INT
);

-- Agents (the cast of characters)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  phase VARCHAR(50),
  persona TEXT,
  system_prompt TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Agent evaluations
CREATE TABLE agent_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
  agent_slug VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  evaluation_type VARCHAR(50),
  verdict VARCHAR(50),
  reasoning TEXT,
  suggestions JSONB,
  confidence INT CHECK (confidence BETWEEN 1 AND 10)
);

-- Build logs
CREATE TABLE build_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
  timestamp TIMESTAMP DEFAULT NOW(),
  agent VARCHAR(100),
  action VARCHAR(100),
  details JSONB,
  log_level VARCHAR(20) DEFAULT 'info'
);

-- Seed MVP agents
INSERT INTO agents (slug, name, category, phase, persona) VALUES
('gatekeeper', 'Gatekeeper', 'pipeline', 'intake',
  'Runs strategic filter. Checks outcome alignment, scores impact, approves or rejects briefs.'),
('skeptic', 'The Skeptic', 'critical_voice', 'intake',
  'Challenges every brief with "Why does this matter? Prove it." Demands evidence of value.'),
('architect', 'Architect', 'pipeline', 'planning',
  'Designs the implementation approach. Considers alternatives. Creates step-by-step plan.'),
('critic', 'Critic', 'pipeline', 'planning',
  'Reviews architect''s plan. Finds holes, risks, edge cases. Suggests improvements.'),
('builder', 'Builder', 'pipeline', 'build',
  'Executes the work. Writes code, creates files, makes commits. The hands.');

-- Seed initial projects
INSERT INTO projects (name, project_type, repo_url) VALUES
('Forge', 'internal', 'https://github.com/adaptiveedge/forge'),
('StrategyOS', 'internal', 'https://github.com/adaptiveedge/strategyos'),
('Arjo', 'client', NULL);

-- Enable realtime for briefs (daemon will listen)
ALTER PUBLICATION supabase_realtime ADD TABLE briefs;

-- RLS policies (simple for now - Nathan only)
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_logs ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated users (single user system for now)
CREATE POLICY "Allow all for authenticated" ON briefs FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON projects FOR ALL USING (true);
CREATE POLICY "Allow read for all" ON agents FOR SELECT USING (true);
CREATE POLICY "Allow all for authenticated" ON agent_evaluations FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON build_logs FOR ALL USING (true);
