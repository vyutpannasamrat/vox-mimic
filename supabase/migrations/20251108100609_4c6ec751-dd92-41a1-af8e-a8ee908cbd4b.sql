-- Drop the old check constraint
ALTER TABLE voice_projects DROP CONSTRAINT IF EXISTS voice_projects_status_check;

-- Add the updated check constraint with all required statuses
ALTER TABLE voice_projects ADD CONSTRAINT voice_projects_status_check 
CHECK (status IN ('draft', 'recording', 'analyzing', 'training', 'ready', 'generating', 'completed', 'failed'));