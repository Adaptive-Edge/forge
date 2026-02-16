-- Phase 3: Deliberative team model
-- Adds deliberation rounds, decision reports, and new evaluator agents

-- Deliberation rounds (track each agent's verdict per round)
CREATE TABLE deliberation_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
  agent_slug VARCHAR(50) NOT NULL,
  round INT NOT NULL DEFAULT 1,
  verdict VARCHAR(50) NOT NULL,
  reasoning TEXT NOT NULL,
  confidence INT CHECK (confidence BETWEEN 1 AND 10),
  revised_from VARCHAR(50),  -- previous verdict if changed in round 2
  created_at TIMESTAMP DEFAULT NOW()
);

-- Decision reports (synthesized team decision)
CREATE TABLE decision_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
  decision VARCHAR(50) NOT NULL,  -- 'approved' | 'rejected'
  summary TEXT NOT NULL,
  weighted_score DECIMAL(4,2),
  dissenting_views TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS
ALTER TABLE deliberation_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON deliberation_rounds FOR ALL USING (true);
CREATE POLICY "Allow all" ON decision_reports FOR ALL USING (true);

-- Realtime for deliberation_rounds and decision_reports
ALTER PUBLICATION supabase_realtime ADD TABLE deliberation_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE decision_reports;

-- Seed new agents
INSERT INTO agents (slug, name, category, phase, persona) VALUES
('cynic', 'The Cynic', 'critical_voice', 'intake',
  'Recognises patterns in Nathan''s behaviour. Asks: have you been here before? Is this a shiny object? Are you avoiding something harder?'),
('accountant', 'The Accountant', 'critical_voice', 'intake',
  'Evaluates cost vs return. How long will this take? What''s the opportunity cost? Is the ROI justified in hours, not abstractions?');
