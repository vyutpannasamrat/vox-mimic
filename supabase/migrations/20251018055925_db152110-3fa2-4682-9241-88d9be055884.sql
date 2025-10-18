-- Create voice_samples table for storing multiple voice clips per project
CREATE TABLE public.voice_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.voice_projects(id) ON DELETE CASCADE,
  clip_number INTEGER NOT NULL,
  sample_url TEXT NOT NULL,
  duration REAL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, clip_number)
);

-- Enable RLS on voice_samples
ALTER TABLE public.voice_samples ENABLE ROW LEVEL SECURITY;

-- RLS policies for voice_samples
CREATE POLICY "Users can view their own voice samples"
  ON public.voice_samples FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.voice_projects
      WHERE voice_projects.id = voice_samples.project_id
      AND voice_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own voice samples"
  ON public.voice_samples FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.voice_projects
      WHERE voice_projects.id = voice_samples.project_id
      AND voice_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own voice samples"
  ON public.voice_samples FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.voice_projects
      WHERE voice_projects.id = voice_samples.project_id
      AND voice_projects.user_id = auth.uid()
    )
  );

-- Update voice_projects table to track clips
ALTER TABLE public.voice_projects 
  ADD COLUMN total_clips INTEGER DEFAULT 30,
  ADD COLUMN clips_uploaded INTEGER DEFAULT 0;

-- Create index for better query performance
CREATE INDEX idx_voice_samples_project_id ON public.voice_samples(project_id);