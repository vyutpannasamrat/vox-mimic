-- Fix search_path for validation functions
CREATE OR REPLACE FUNCTION public.validate_clips_uploaded()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.clips_uploaded > NEW.total_clips THEN
    RAISE EXCEPTION 'clips_uploaded (%) cannot exceed total_clips (%)', NEW.clips_uploaded, NEW.total_clips;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_voice_parameters()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;