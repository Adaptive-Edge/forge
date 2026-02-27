CREATE TABLE github_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  full_name VARCHAR(500) NOT NULL UNIQUE,
  html_url VARCHAR(500) NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT false,
  default_branch VARCHAR(100) DEFAULT 'main',
  owner_login VARCHAR(255) NOT NULL,
  language VARCHAR(100),
  pushed_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE github_repos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON github_repos FOR ALL USING (true);
