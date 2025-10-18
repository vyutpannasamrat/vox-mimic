import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface VoiceProject {
  id: string;
  name: string;
  status: string;
  created_at: string;
  voice_sample_url: string | null;
  script_text: string | null;
  generated_audio_url: string | null;
  total_clips: number | null;
  clips_uploaded: number | null;
}

export const useRealtimeProjects = () => {
  const [projects, setProjects] = useState<VoiceProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial projects
    loadProjects();

    // Set up realtime subscription
    const channel = supabase
      .channel('voice-projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_projects',
        },
        (payload) => {
          console.log('Realtime update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setProjects((prev) => [payload.new as VoiceProject, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setProjects((prev) =>
              prev.map((project) =>
                project.id === payload.new.id ? (payload.new as VoiceProject) : project
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setProjects((prev) =>
              prev.filter((project) => project.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("voice_projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  return { projects, loading, refresh: loadProjects };
};
