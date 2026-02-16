-- Phase 4: Feedback loop for revision requests
-- Allows Nathan to send feedback from the Review column back through Architect → Builder

CREATE TABLE revision_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
  feedback TEXT NOT NULL,
  revision_number INT DEFAULT 1,
  status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE revision_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON revision_requests FOR ALL USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE revision_requests;
