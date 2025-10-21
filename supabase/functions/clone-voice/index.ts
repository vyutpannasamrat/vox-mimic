import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to parse ElevenLabs errors
async function handleElevenLabsError(response: Response, operation: string): Promise<never> {
  const statusCode = response.status;
  let errorMessage = 'Unknown error occurred';
  let userFriendlyMessage = '';

  try {
    const errorData = await response.json();
    errorMessage = errorData.detail?.message || errorData.message || JSON.stringify(errorData);
  } catch {
    errorMessage = await response.text();
  }

  console.error(`ElevenLabs ${operation} error (${statusCode}):`, errorMessage);

  switch (statusCode) {
    case 401:
      userFriendlyMessage = 'ElevenLabs API key is invalid or expired. Please update your API key.';
      break;
    case 402:
      userFriendlyMessage = 'ElevenLabs quota exceeded. Please check your subscription or wait until your quota resets.';
      break;
    case 422:
      if (errorMessage.toLowerCase().includes('audio')) {
        userFriendlyMessage = 'Invalid audio format or corrupted audio files. Please re-record your voice samples.';
      } else {
        userFriendlyMessage = 'Invalid request data. Please check your voice settings and try again.';
      }
      break;
    case 429:
      userFriendlyMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      break;
    case 500:
    case 502:
    case 503:
      userFriendlyMessage = 'ElevenLabs service is temporarily unavailable. Please try again in a few minutes.';
      break;
    default:
      if (errorMessage.toLowerCase().includes('voice limit') || errorMessage.toLowerCase().includes('maximum')) {
        userFriendlyMessage = 'Voice limit reached on your ElevenLabs account. Please delete unused voices or upgrade your plan.';
      } else if (errorMessage.toLowerCase().includes('format')) {
        userFriendlyMessage = 'Audio format not supported. Please ensure recordings are in MP3 format.';
      } else {
        userFriendlyMessage = `ElevenLabs ${operation} failed: ${errorMessage}`;
      }
  }

  throw new Error(userFriendlyMessage);
}

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

    // Get all voice samples for this project
    const { data: samples, error: samplesError } = await supabaseClient
      .from('voice_samples')
      .select('*')
      .eq('project_id', projectId)
      .order('clip_number');

    if (samplesError || !samples || samples.length === 0) {
      throw new Error('No voice samples found for this project');
    }

    console.log(`Found ${samples.length} voice samples`);

    // Update status to analyzing
    await supabaseClient
      .from('voice_projects')
      .update({ status: 'analyzing' })
      .eq('id', projectId);

    console.log('Analyzing voice samples...');

    // Step 1: Add voice to ElevenLabs with multiple samples
    console.log('Adding voice to ElevenLabs...');
    const formData = new FormData();
    formData.append('name', `Voice_${projectId}`);
    
    // Download and add all voice samples (ElevenLabs accepts multiple files)
    let successfulSamples = 0;
    for (let i = 0; i < Math.min(samples.length, 25); i++) {
      const sample = samples[i];
      try {
        const voiceResponse = await fetch(sample.sample_url);
        if (!voiceResponse.ok) {
          console.warn(`Failed to fetch sample ${i}: HTTP ${voiceResponse.status}`);
          continue;
        }
        const voiceBlob = await voiceResponse.blob();
        if (voiceBlob.size === 0) {
          console.warn(`Sample ${i} is empty`);
          continue;
        }
        const voiceArrayBuffer = await voiceBlob.arrayBuffer();
        formData.append('files', new Blob([voiceArrayBuffer], { type: 'audio/mpeg' }), `sample_${i}.mp3`);
        successfulSamples++;
      } catch (error) {
        console.warn(`Failed to download sample ${i}:`, error);
      }
    }
    
    if (successfulSamples === 0) {
      throw new Error('No valid voice samples could be loaded. Please check your recordings and try again.');
    }
    
    console.log(`Successfully loaded ${successfulSamples} voice samples`);
    
    formData.append('description', 'Voice clone from VoiceClone AI');

    const addVoiceResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') ?? '',
      },
      body: formData,
    });

    if (!addVoiceResponse.ok) {
      await handleElevenLabsError(addVoiceResponse, 'voice creation');
    }

    const addVoiceData = await addVoiceResponse.json();
    const voice_id = addVoiceData.voice_id;
    
    if (!voice_id) {
      throw new Error('No voice ID returned from ElevenLabs. Please try again.');
    }
    
    console.log('Voice added successfully:', voice_id);

    // Update status to generating
    await supabaseClient
      .from('voice_projects')
      .update({ status: 'generating' })
      .eq('id', projectId);

    // Step 2: Generate speech with the cloned voice
    console.log('Generating speech...');
    
    if (!project.script_text || project.script_text.trim().length === 0) {
      throw new Error('No script text provided. Please add text to generate speech.');
    }
    
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
      await handleElevenLabsError(ttsResponse, 'speech generation');
    }

    // Get the generated audio
    const audioBlob = await ttsResponse.blob();
    
    if (audioBlob.size === 0) {
      throw new Error('Generated audio is empty. Please try again or adjust voice settings.');
    }
    
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
      throw new Error(`Failed to upload audio to storage: ${uploadError.message}`);
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
      const deleteResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voice_id}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') ?? '',
        },
      });
      
      if (deleteResponse.ok) {
        console.log('Voice cleaned up from ElevenLabs');
      } else {
        console.warn(`Failed to delete voice (${deleteResponse.status}). Voice may remain in ElevenLabs account.`);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup voice:', cleanupError);
      // Non-critical error, don't fail the entire operation
    }

    console.log('Voice cloning completed successfully!');

    return new Response(
      JSON.stringify({ success: true, audioUrl: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in clone-voice function:', error);

    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (error.message.includes('quota') || error.message.includes('limit')) {
      statusCode = 402;
    } else if (error.message.includes('invalid') || error.message.includes('format')) {
      statusCode = 422;
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
    } else if (error.message.includes('API key')) {
      statusCode = 401;
    }

    // Update project status to failed with error details
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      // Try to get projectId from request
      let projectId;
      try {
        const body = await req.clone().json();
        projectId = body.projectId;
      } catch {
        // If we can't parse the body, that's ok
      }
      
      if (projectId) {
        await supabaseClient
          .from('voice_projects')
          .update({ 
            status: 'failed',
            // You could add an error_message column to store this
          })
          .eq('id', projectId);
      }
    } catch (updateError) {
      console.error('Failed to update project status:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Please check the error message and try again. If the problem persists, contact support.'
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
