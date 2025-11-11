import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mic, Square, Play, Pause, Upload, Trash2, CheckCircle } from "lucide-react";
import { voiceTrainingPhrases } from "@/data/voiceTrainingPhrases";

interface VoiceRecordingStudioProps {
  projectId: string;
  totalClips: number;
  onComplete: () => void;
}

interface RecordedClip {
  clipNumber: number;
  blob: Blob | null;
  url: string | null;
  duration: number;
  uploaded: boolean;
}

export default function VoiceRecordingStudio({
  projectId,
  totalClips,
  onComplete,
}: VoiceRecordingStudioProps) {
  const [clips, setClips] = useState<RecordedClip[]>(
    Array.from({ length: totalClips }, (_, i) => ({
      clipNumber: i + 1,
      blob: null,
      url: null,
      duration: 0,
      uploaded: false,
    }))
  );
  const [currentClip, setCurrentClip] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const uploadedCount = clips.filter((c) => c.uploaded).length;
  const recordedCount = clips.filter((c) => c.blob !== null).length;
  const progress = (uploadedCount / totalClips) * 100;

  useEffect(() => {
    // Load existing uploaded clips from database
    const loadUploadedClips = async () => {
      const { data: samples } = await supabase
        .from("voice_samples")
        .select("clip_number")
        .eq("project_id", projectId);
      
      if (samples && samples.length > 0) {
        setClips(prev => prev.map(clip => ({
          ...clip,
          uploaded: samples.some(s => s.clip_number === clip.clipNumber)
        })));
      }
    };
    
    loadUploadedClips();
  }, [projectId]);

  useEffect(() => {
    // Cleanup timer and URLs on unmount
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clips.forEach((clip) => {
        if (clip.url) URL.revokeObjectURL(clip.url);
      });
    };
  }, [clips]);


  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Use the actual mime type from the recorder
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setClips((prev) =>
          prev.map((clip, idx) =>
            idx === currentClip
              ? { ...clip, blob: audioBlob, url: audioUrl, duration: recordingTime }
              : clip
          )
        );

        stream.getTracks().forEach((track) => track.stop());
        setRecordingTime(0);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Microphone Error",
        description: "Could not access your microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playClip = (clipIndex: number) => {
    const clip = clips[clipIndex];
    if (!clip.url) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(clip.url);
    audioRef.current = audio;

    audio.onended = () => {
      setIsPlaying(false);
    };

    audio.play();
    setIsPlaying(true);
  };

  const pauseClip = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const deleteClip = (clipIndex: number) => {
    const clip = clips[clipIndex];
    if (clip.url) URL.revokeObjectURL(clip.url);

    setClips((prev) =>
      prev.map((c, idx) =>
        idx === clipIndex
          ? { ...c, blob: null, url: null, duration: 0, uploaded: false }
          : c
      )
    );
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // P1 #10: 10MB limit
    const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg'];

    Array.from(files).forEach((file, index) => {
      // P1 #10: File size validation
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File Too Large",
          description: `${file.name} exceeds the 10MB limit.`,
          variant: "destructive",
        });
        return;
      }

      // P1 #11: File type validation
      if (!file.type.startsWith("audio/") || !ALLOWED_TYPES.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not a supported audio format (MP3, WAV, WebM, OGG).`,
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const audioBlob = new Blob([e.target?.result as ArrayBuffer], { type: file.type });
          const url = URL.createObjectURL(audioBlob);

          setClips((prev) => {
            const emptyIndex = prev.findIndex((c) => c.blob === null);
            if (emptyIndex === -1) return prev;

            return prev.map((c, idx) =>
              idx === emptyIndex
                ? { ...c, blob: audioBlob, url, duration: 0 }
                : c
            );
          });
        } catch (error) {
          console.error("Error processing uploaded file:", error);
          toast({
            title: "Processing Error",
            description: `Failed to process ${file.name}. Please try again.`,
            variant: "destructive",
          });
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const uploadAllClips = async () => {
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to upload clips.",
        variant: "destructive",
      });
      setUploading(false);
      return;
    }

    let newUploads = 0;

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (!clip.blob || clip.uploaded) continue;

      try {
        // Determine file extension from blob type
        const fileExt = clip.blob.type.includes('webm') ? 'webm' : 
                        clip.blob.type.includes('mp3') || clip.blob.type.includes('mpeg') ? 'mp3' :
                        clip.blob.type.includes('wav') ? 'wav' : 
                        clip.blob.type.includes('ogg') ? 'ogg' : 'webm';
        const fileName = `${user.id}/${projectId}/clip_${clip.clipNumber}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("voice-samples")
          .upload(fileName, clip.blob, { upsert: true, contentType: clip.blob.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("voice-samples")
          .getPublicUrl(fileName);

        const { error: dbError } = await supabase
          .from("voice_samples")
          .insert({
            project_id: projectId,
            clip_number: clip.clipNumber,
            sample_url: urlData.publicUrl,
            duration: clip.duration,
          });

        if (dbError) throw dbError;

        newUploads++;
        setClips((prev) =>
          prev.map((c, idx) =>
            idx === i ? { ...c, uploaded: true } : c
          )
        );
      } catch (error) {
        console.error(`Error uploading clip ${clip.clipNumber}:`, error);
        toast({
          title: "Upload Error",
          description: `Failed to upload clip ${clip.clipNumber}.`,
          variant: "destructive",
        });
      }
    }

    // Get total uploaded count from all clips
    const totalUploaded = clips.filter(c => c.uploaded).length + newUploads;
    
    // Update project with total count
    await supabase
      .from("voice_projects")
      .update({ clips_uploaded: totalUploaded })
      .eq("id", projectId);

    setUploading(false);

    if (totalUploaded >= totalClips) {
      toast({
        title: "Upload Complete",
        description: `All ${totalClips} clips uploaded successfully!`,
      });
      onComplete();
    } else {
      toast({
        title: "Clips Uploaded",
        description: `Uploaded ${newUploads} clips. Total: ${totalUploaded}/${totalClips}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Voice Training Studio</h3>
              <p className="text-sm text-muted-foreground">
                Record or upload {totalClips} voice clips for optimal voice training
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{uploadedCount}/{totalClips}</p>
              <p className="text-xs text-muted-foreground">clips uploaded</p>
            </div>
          </div>
          <Progress value={progress} />
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Current Clip: {currentClip + 1}</h4>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={currentClip}
                onChange={(e) => setCurrentClip(Number(e.target.value))}
              >
                {clips.map((_, idx) => (
                  <option key={idx} value={idx}>
                    Clip {idx + 1}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 bg-muted rounded-lg min-h-[100px] flex items-center">
              <p className="text-sm italic">
                "{voiceTrainingPhrases[currentClip % voiceTrainingPhrases.length]}"
              </p>
            </div>

            <div className="flex gap-2">
              {!isRecording ? (
                <Button onClick={startRecording} className="flex-1">
                  <Mic className="mr-2 h-4 w-4" />
                  Start Recording
                </Button>
              ) : (
                <Button onClick={stopRecording} variant="destructive" className="flex-1">
                  <Square className="mr-2 h-4 w-4" />
                  Stop ({recordingTime}s)
                </Button>
              )}

              <label htmlFor="file-upload">
                <Button variant="outline" asChild>
                  <span className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Files
                  </span>
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                multiple
                accept="audio/mpeg,audio/mp3,audio/wav,audio/webm,audio/ogg"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {clips[currentClip].blob && (
              <div className="flex gap-2">
                {!isPlaying ? (
                  <Button onClick={() => playClip(currentClip)} variant="secondary" className="flex-1">
                    <Play className="mr-2 h-4 w-4" />
                    Play
                  </Button>
                ) : (
                  <Button onClick={pauseClip} variant="secondary" className="flex-1">
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                )}
                <Button
                  onClick={() => deleteClip(currentClip)}
                  variant="outline"
                  size="icon"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="font-semibold mb-4">Recording Progress</h4>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {clips.map((clip, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-2 rounded ${
                  idx === currentClip ? "bg-primary/10" : "bg-muted/50"
                }`}
              >
                <span className="text-sm">Clip {idx + 1}</span>
                <div className="flex items-center gap-2">
                  {clip.uploaded && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {clip.blob && !clip.uploaded && (
                    <span className="text-xs text-muted-foreground">Ready</span>
                  )}
                  {!clip.blob && (
                    <span className="text-xs text-muted-foreground">Empty</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex justify-end gap-4">
        <Button
          onClick={uploadAllClips}
          disabled={uploading || recordedCount === 0}
          size="lg"
        >
          {uploading ? "Uploading..." : `Upload ${recordedCount} Clips`}
        </Button>
      </div>
    </div>
  );
}
