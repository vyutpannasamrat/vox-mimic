-- Add column to track ElevenLabs voice ID for cleanup
ALTER TABLE voice_projects 
ADD COLUMN elevenlabs_voice_id TEXT;

-- Add index for faster lookups
CREATE INDEX idx_voice_projects_elevenlabs_voice_id 
ON voice_projects(elevenlabs_voice_id) 
WHERE elevenlabs_voice_id IS NOT NULL;

-- Enable pg_cron and pg_net for scheduled cleanup (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;