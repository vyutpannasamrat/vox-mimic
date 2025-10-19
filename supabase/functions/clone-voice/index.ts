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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { projectId } = await req.json();
    
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    console.log('Starting voice cloning for project:', projectId);

    // Get project details
    const { data: project, error: projectError } = await supabaseClient
      .from('voice_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    // Update status to analyzing
    await supabaseClient
      .from('voice_projects')
      .update({ status: 'analyzing' })
      .eq('id', projectId);

    console.log('Analyzing voice sample...');

    // Download the voice sample
    const voiceResponse = await fetch(project.voice_sample_url);
    const voiceBlob = await voiceResponse.blob();
    const voiceArrayBuffer = await voiceBlob.arrayBuffer();

    // Step 1: Add voice to ElevenLabs
    console.log('Adding voice to ElevenLabs...');
    const formData = new FormData();
    formData.append('name', `Voice_${projectId}`);
    formData.append('files', new Blob([voiceArrayBuffer], { type: 'audio/mpeg' }), 'sample.mp3');
    formData.append('description', 'Voice clone from VoiceClone AI');

    const addVoiceResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') ?? '',
      },
      body: formData,
    });

    if (!addVoiceResponse.ok) {
      const errorText = await addVoiceResponse.text();
      console.error('ElevenLabs add voice error:', errorText);
      throw new Error(`Failed to add voice: ${errorText}`);
    }

    const { voice_id } = await addVoiceResponse.json();
    console.log('Voice added successfully:', voice_id);

    // Update status to generating
    await supabaseClient
      .from('voice_projects')
      .update({ status: 'generating' })
      .eq('id', projectId);

    // Step 2: Generate speech with the cloned voice
    console.log('Generating speech...');
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') ?? '',
        },
        body: JSON.stringify({
          text: project.script_text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: project.voice_stability ?? 0.5,
            similarity_boost: project.voice_similarity_boost ?? 0.75,
            style: project.voice_style ?? 0.0,
            use_speaker_boost: project.voice_speaker_boost ?? true,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs TTS error:', errorText);
      throw new Error(`Failed to generate speech: ${errorText}`);
    }

    // Get the generated audio
    const audioBlob = await ttsResponse.blob();
    const audioArrayBuffer = await audioBlob.arrayBuffer();

    // Upload to Supabase Storage
    console.log('Uploading generated audio...');
    const fileName = `${project.user_id}/${projectId}_generated.mp3`;
    const { error: uploadError } = await supabaseClient.storage
      .from('voice-samples')
      .upload(fileName, audioArrayBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from('voice-samples')
      .getPublicUrl(fileName);

    // Update project with generated audio
    await supabaseClient
      .from('voice_projects')
      .update({
        generated_audio_url: publicUrl,
        status: 'completed',
      })
      .eq('id', projectId);

    // Clean up: Delete the voice from ElevenLabs
    try {
      await fetch(`https://api.elevenlabs.io/v1/voices/${voice_id}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') ?? '',
        },
      });
      console.log('Voice cleaned up from ElevenLabs');
    } catch (cleanupError) {
      console.warn('Failed to cleanup voice:', cleanupError);
    }

    console.log('Voice cloning completed successfully!');

    return new Response(
      JSON.stringify({ success: true, audioUrl: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in clone-voice function:', error);

    // Update project status to failed
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { projectId } = await req.json();
      if (projectId) {
        await supabaseClient
          .from('voice_projects')
          .update({ status: 'failed' })
          .eq('id', projectId);
      }
    } catch (updateError) {
      console.error('Failed to update project status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
