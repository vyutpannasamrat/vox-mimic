-- P0 Fix #1: Storage Upload Policy with Security Check
DROP POLICY IF EXISTS "Users can upload their own voice samples" ON storage.objects;
CREATE POLICY "Users can upload their own voice samples"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'voice-samples' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- P0 Fix #2: Add UPDATE Policy for Voice Samples Table
DROP POLICY IF EXISTS "Users can update their own voice samples" ON public.voice_samples;
CREATE POLICY "Users can update their own voice samples"
ON public.voice_samples
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM voice_projects
    WHERE voice_projects.id = voice_samples.project_id
    AND voice_projects.user_id = auth.uid()
  )
);

-- P0 Fix #3: Add UPDATE Policy for Storage Objects
DROP POLICY IF EXISTS "Users can update their own voice samples in storage" ON storage.objects;
CREATE POLICY "Users can update their own voice samples in storage"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'voice-samples'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- P0 Fix #5: Add Cascade Delete for Voice Samples
ALTER TABLE public.voice_samples
DROP CONSTRAINT IF EXISTS voice_samples_project_id_fkey,
ADD CONSTRAINT voice_samples_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.voice_projects(id)
  ON DELETE CASCADE;

-- Function to cleanup storage files when project is deleted
CREATE OR REPLACE FUNCTION public.cleanup_project_files()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  -- Delete all voice samples from storage for this project
  DELETE FROM storage.objects
  WHERE bucket_id = 'voice-samples'
  AND name LIKE OLD.user_id::text || '/' || OLD.id::text || '%';
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_project_files_trigger ON public.voice_projects;
CREATE TRIGGER cleanup_project_files_trigger
  BEFORE DELETE ON public.voice_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_project_files();