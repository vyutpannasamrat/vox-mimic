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

// Helper function to retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.error(`[clone-voice] Attempt ${attempt + 1} failed:`, error);
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`[clone-voice] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY') ?? '';
  let projectId: string | null = null;
  let elevenLabsVoiceId: string | null = null;

  try {
    console.log('[clone-voice] ========== REQUEST RECEIVED ==========');

    // Get project ID from request
    const body = await req.json();
    projectId = body.projectId;
    
    if (!projectId) {
      throw new Error('Project ID is required');
    }
    
    console.log('[clone-voice] Processing project:', projectId);

    // Get project details
    console.log('[clone-voice] Fetching project details...');
    const { data: project, error: projectError } = await supabaseClient
      .from('voice_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('[clone-voice] Project fetch error:', projectError);
      throw new Error('Project not found');
    }
    
    console.log('[clone-voice] Project found:', project.name);

    // Get all voice samples for this project
    console.log('[clone-voice] Fetching voice samples...');
    const { data: samples, error: samplesError } = await supabaseClient
      .from('voice_samples')
      .select('*')
      .eq('project_id', projectId)
      .order('clip_number');

    if (samplesError || !samples || samples.length === 0) {
      console.error('[clone-voice] Samples fetch error:', samplesError);
      throw new Error('No voice samples found for this project');
    }

    console.log(`[clone-voice] Found ${samples.length} voice samples`);

    // Update status to analyzing
    console.log('[clone-voice] Updating status to analyzing...');
    await supabaseClient
      .from('voice_projects')
      .update({ status: 'analyzing' })
      .eq('id', projectId);

    // Step 1: Add voice to ElevenLabs with multiple samples
    console.log('[clone-voice] ========== STEP 1: CLONING VOICE ==========');
    const formData = new FormData();
    formData.append('name', `Voice_${projectId}`);
    
    // Download and add all voice samples (ElevenLabs accepts multiple files)
    let successfulSamples = 0;
    console.log('[clone-voice] Downloading voice samples...');
    
    for (let i = 0; i < Math.min(samples.length, 25); i++) {
      const sample = samples[i];
      try {
        // Download with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
        
        const voiceResponse = await fetch(sample.sample_url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!voiceResponse.ok) {
          console.warn(`[clone-voice] Failed to fetch sample ${i}: HTTP ${voiceResponse.status}`);
          continue;
        }
        
        const voiceBlob = await voiceResponse.blob();
        if (voiceBlob.size === 0) {
          console.warn(`[clone-voice] Sample ${i} is empty`);
          continue;
        }
        
        const voiceArrayBuffer = await voiceBlob.arrayBuffer();
        formData.append('files', new Blob([voiceArrayBuffer], { type: 'audio/mpeg' }), `sample_${i}.mp3`);
        successfulSamples++;
        console.log(`[clone-voice] Downloaded sample ${i + 1}/${samples.length}`);
      } catch (error) {
        console.warn(`[clone-voice] Failed to download sample ${i}:`, error);
      }
    }
    
    if (successfulSamples === 0) {
      throw new Error('No valid voice samples could be loaded. Please check your recordings and try again.');
    }
    
    console.log(`[clone-voice] Successfully loaded ${successfulSamples} voice samples`);
    formData.append('description', 'Voice clone from VoiceClone AI');

    // Call ElevenLabs API with retry logic
    console.log('[clone-voice] Calling ElevenLabs API to clone voice...');
    const addVoiceData = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout
      
      const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsApiKey,
        },
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        await handleElevenLabsError(response, 'voice creation');
      }
      
      return await response.json();
    }, 3, 2000);

    elevenLabsVoiceId = addVoiceData.voice_id;
    
    if (!elevenLabsVoiceId) {
      throw new Error('No voice ID returned from ElevenLabs. Please try again.');
    }
    
    console.log('[clone-voice] ✅ Voice cloned successfully, ID:', elevenLabsVoiceId);
    
    // Store the voice_id in the database for tracking and cleanup
    console.log('[clone-voice] Storing voice ID in database...');
    await supabaseClient
      .from('voice_projects')
      .update({ 
        elevenlabs_voice_id: elevenLabsVoiceId,
        status: 'generating'
      })
      .eq('id', projectId);

    // Step 2: Generate speech with the cloned voice
    console.log('[clone-voice] ========== STEP 2: GENERATING SPEECH ==========');
    
    if (!project.script_text || project.script_text.trim().length === 0) {
      throw new Error('No script text provided. Please add text to generate speech.');
    }
    
    console.log('[clone-voice] Script length:', project.script_text.length, 'characters');
    console.log('[clone-voice] Calling ElevenLabs TTS API...');
    
    const audioBlob = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout
      
      const ttsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': elevenLabsApiKey,
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
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);

      if (!ttsResponse.ok) {
        await handleElevenLabsError(ttsResponse, 'speech generation');
      }

      return await ttsResponse.blob();
    }, 3, 2000);
    
    if (audioBlob.size === 0) {
      throw new Error('Generated audio is empty. Please try again or adjust voice settings.');
    }
    
    console.log('[clone-voice] ✅ Speech generated, size:', audioBlob.size, 'bytes');
    const audioArrayBuffer = await audioBlob.arrayBuffer();

    // Upload to Supabase Storage
    console.log('[clone-voice] ========== STEP 3: UPLOADING TO STORAGE ==========');
    const fileName = `${project.user_id}/${projectId}_generated.mp3`;
    const { error: uploadError } = await supabaseClient.storage
      .from('voice-samples')
      .upload(fileName, audioArrayBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('[clone-voice] Upload error:', uploadError);
      throw new Error(`Failed to upload audio to storage: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from('voice-samples')
      .getPublicUrl(fileName);

    console.log('[clone-voice] ✅ Audio uploaded successfully');

    // Update project with generated audio and clear voice_id
    console.log('[clone-voice] Updating project with final results...');
    await supabaseClient
      .from('voice_projects')
      .update({
        generated_audio_url: publicUrl,
        status: 'completed',
        elevenlabs_voice_id: null, // Clear after successful completion
      })
      .eq('id', projectId);

    // Clean up: Delete the voice from ElevenLabs
    console.log('[clone-voice] ========== CLEANUP: DELETING VOICE ==========');
    try {
      const deleteResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${elevenLabsVoiceId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': elevenLabsApiKey,
        },
      });
      
      if (deleteResponse.ok) {
        console.log('[clone-voice] ✅ Voice cleaned up from ElevenLabs');
      } else {
        console.warn(`[clone-voice] ⚠️ Failed to delete voice (${deleteResponse.status}). Voice may remain in ElevenLabs account.`);
      }
    } catch (cleanupError) {
      console.warn('[clone-voice] ⚠️ Failed to cleanup voice:', cleanupError);
      // Non-critical error, don't fail the entire operation
    }

    console.log('[clone-voice] ========== ✅ COMPLETED SUCCESSFULLY ==========');

    return new Response(
      JSON.stringify({ success: true, audioUrl: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[clone-voice] ========== ❌ ERROR ==========');
    console.error('[clone-voice] Error details:', error);

    // P0 Fix #7: Clean up voice ID on ANY failure
    if (projectId && elevenLabsVoiceId) {
      console.log('[clone-voice] Cleaning up after failure...');
      
      // Try to delete the voice from ElevenLabs
      try {
        const deleteResponse = await fetch(
          `https://api.elevenlabs.io/v1/voices/${elevenLabsVoiceId}`,
          {
            method: 'DELETE',
            headers: {
              'xi-api-key': elevenLabsApiKey,
            },
          }
        );
        
        if (deleteResponse.ok) {
          console.log('[clone-voice] ✅ Deleted orphaned voice from ElevenLabs');
        } else {
          console.warn('[clone-voice] ⚠️ Failed to delete orphaned voice from ElevenLabs');
        }
      } catch (cleanupError) {
        console.error('[clone-voice] ⚠️ Cleanup error (non-fatal):', cleanupError);
      }

      // Clear voice ID from database
      try {
        await supabaseClient
          .from('voice_projects')
          .update({
            elevenlabs_voice_id: null,
            status: 'failed',
          })
          .eq('id', projectId);
        console.log('[clone-voice] ✅ Cleared voice ID from database');
      } catch (dbError) {
        console.error('[clone-voice] ⚠️ Failed to clear voice ID from database:', dbError);
      }
    } else if (projectId) {
      // Update to failed status even if no voice ID
      try {
        await supabaseClient
          .from('voice_projects')
          .update({ status: 'failed' })
          .eq('id', projectId);
        console.log('[clone-voice] Updated project status to failed');
      } catch (dbError) {
        console.error('[clone-voice] Failed to update status:', dbError);
      }
    }

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
