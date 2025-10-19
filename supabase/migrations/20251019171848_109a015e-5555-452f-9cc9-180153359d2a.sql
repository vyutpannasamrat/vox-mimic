-- Add expression control settings to voice_projects table
ALTER TABLE voice_projects
ADD COLUMN IF NOT EXISTS voice_stability real DEFAULT 0.5 CHECK (voice_stability >= 0 AND voice_stability <= 1),
ADD COLUMN IF NOT EXISTS voice_similarity_boost real DEFAULT 0.75 CHECK (voice_similarity_boost >= 0 AND voice_similarity_boost <= 1),
ADD COLUMN IF NOT EXISTS voice_style real DEFAULT 0.0 CHECK (voice_style >= 0 AND voice_style <= 1),
ADD COLUMN IF NOT EXISTS voice_speaker_boost boolean DEFAULT true;