-- Populate missing repo_url on existing projects
UPDATE projects SET repo_url = 'https://github.com/natcrypto/arjo-synthesis'
WHERE name = 'Arjo' AND repo_url IS NULL;

UPDATE projects SET repo_url = 'https://github.com/natcrypto/life-management-agent'
WHERE name = 'Life Management Agent' AND repo_url IS NULL;

UPDATE projects SET repo_url = 'https://github.com/natcrypto/monzo-freeagent-sync'
WHERE name = 'Monzo-FreeAgent Sync' AND repo_url IS NULL;

-- Insert Henry Tutor project if it doesn't exist
INSERT INTO projects (name, repo_url, local_path, project_type, default_branch)
SELECT 'Henry Tutor', 'https://github.com/natcrypto/henry-tutor', '/Users/nathan/henry-tutor', 'internal', 'main'
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Henry Tutor');
