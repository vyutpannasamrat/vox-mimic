-- P1 #4: Add validation trigger for clips_uploaded <= total_clips
CREATE OR REPLACE FUNCTION public.validate_clips_uploaded()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clips_uploaded > NEW.total_clips THEN
    RAISE EXCEPTION 'clips_uploaded (%) cannot exceed total_clips (%)', NEW.clips_uploaded, NEW.total_clips;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_clips_uploaded_trigger ON public.voice_projects;
CREATE TRIGGER validate_clips_uploaded_trigger
  BEFORE INSERT OR UPDATE ON public.voice_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_clips_uploaded();

-- P1 #6: Add validation trigger for voice parameter ranges
CREATE OR REPLACE FUNCTION public.validate_voice_parameters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.voice_stability IS NOT NULL AND (NEW.voice_stability < 0 OR NEW.voice_stability > 1) THEN
    RAISE EXCEPTION 'voice_stability must be between 0 and 1, got %', NEW.voice_stability;
  END IF;
  
  IF NEW.voice_similarity_boost IS NOT NULL AND (NEW.voice_similarity_boost < 0 OR NEW.voice_similarity_boost > 1) THEN
    RAISE EXCEPTION 'voice_similarity_boost must be between 0 and 1, got %', NEW.voice_similarity_boost;
  END IF;
  
  IF NEW.voice_style IS NOT NULL AND (NEW.voice_style < 0 OR NEW.voice_style > 1) THEN
    RAISE EXCEPTION 'voice_style must be between 0 and 1, got %', NEW.voice_style;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_voice_parameters_trigger ON public.voice_projects;
CREATE TRIGGER validate_voice_parameters_trigger
  BEFORE INSERT OR UPDATE ON public.voice_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_voice_parameters();

-- P1 #8: Add rate limiting - track last generation time
ALTER TABLE public.voice_projects 
ADD COLUMN IF NOT EXISTS last_generation_at TIMESTAMP WITH TIME ZONE;