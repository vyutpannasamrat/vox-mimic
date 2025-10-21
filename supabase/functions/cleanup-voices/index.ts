import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting voice cleanup job...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    // Find projects with voice_ids that are older than 1 hour (stuck or failed)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: projectsWithVoices, error: queryError } = await supabaseClient
      .from('voice_projects')
      .select('id, elevenlabs_voice_id, status, updated_at')
      .not('elevenlabs_voice_id', 'is', null)
      .or(`status.eq.failed,status.eq.completed,updated_at.lt.${oneHourAgo}`);

    if (queryError) {
      console.error('Error querying projects:', queryError);
      throw queryError;
    }

    console.log(`Found ${projectsWithVoices?.length || 0} projects with voice IDs to cleanup`);

    let cleanedCount = 0;
    let failedCount = 0;

    if (projectsWithVoices && projectsWithVoices.length > 0) {
      for (const project of projectsWithVoices) {
        try {
          console.log(`Cleaning up voice ${project.elevenlabs_voice_id} for project ${project.id}`);
          
          const deleteResponse = await fetch(
            `https://api.elevenlabs.io/v1/voices/${project.elevenlabs_voice_id}`,
            {
              method: 'DELETE',
              headers: {
                'xi-api-key': elevenLabsApiKey,
              },
            }
          );

          if (deleteResponse.ok || deleteResponse.status === 404) {
            // Successfully deleted or voice doesn't exist
            await supabaseClient
              .from('voice_projects')
              .update({ elevenlabs_voice_id: null })
              .eq('id', project.id);
            
            cleanedCount++;
            console.log(`Successfully cleaned up voice for project ${project.id}`);
          } else {
            const errorText = await deleteResponse.text();
            console.warn(`Failed to delete voice ${project.elevenlabs_voice_id}: ${errorText}`);
            failedCount++;
          }
        } catch (error) {
          console.error(`Error cleaning up voice for project ${project.id}:`, error);
          failedCount++;
        }
      }
    }

    // Also fetch list of all voices from ElevenLabs and clean up any that don't match our database
    try {
      const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'xi-api-key': elevenLabsApiKey,
        },
      });

      if (voicesResponse.ok) {
        const { voices } = await voicesResponse.json();
        console.log(`Found ${voices.length} voices in ElevenLabs account`);

        // Get all voice IDs currently in our database
        const { data: allProjects } = await supabaseClient
          .from('voice_projects')
          .select('elevenlabs_voice_id')
          .not('elevenlabs_voice_id', 'is', null);

        const knownVoiceIds = new Set(allProjects?.map(p => p.elevenlabs_voice_id) || []);

        // Delete voices that start with "Voice_" prefix but aren't in our database
        for (const voice of voices) {
          if (voice.name.startsWith('Voice_') && !knownVoiceIds.has(voice.voice_id)) {
            try {
              const deleteResponse = await fetch(
                `https://api.elevenlabs.io/v1/voices/${voice.voice_id}`,
                {
                  method: 'DELETE',
                  headers: {
                    'xi-api-key': elevenLabsApiKey,
                  },
                }
              );

              if (deleteResponse.ok) {
                cleanedCount++;
                console.log(`Cleaned up orphaned voice: ${voice.voice_id}`);
              }
            } catch (error) {
              console.warn(`Failed to cleanup orphaned voice ${voice.voice_id}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error fetching ElevenLabs voices list:', error);
    }

    const result = {
      success: true,
      cleaned: cleanedCount,
      failed: failedCount,
      timestamp: new Date().toISOString(),
    };

    console.log('Cleanup job completed:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in cleanup-voices function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
