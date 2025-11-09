import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileAudio, Loader2, Sparkles, Clock } from "lucide-react";
import { format } from "date-fns";
import AudioPlayer from "./AudioPlayer";
import GenerateVoiceDialog from "./GenerateVoiceDialog";

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
  voice_stability: number | null;
  voice_similarity_boost: number | null;
  voice_style: number | null;
  voice_speaker_boost: boolean | null;
}

interface VoiceProjectCardProps {
  project: VoiceProject;
  onUpdate: () => void;
}

const VoiceProjectCard = ({ project }: VoiceProjectCardProps) => {
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [progress, setProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  
  // Estimate progress and time based on status
  useEffect(() => {
    const statusProgress: Record<string, { progress: number; timeMinutes: number }> = {
      analyzing: { progress: 15, timeMinutes: 2 },
      training: { progress: 45, timeMinutes: 3 },
      generating: { progress: 75, timeMinutes: 1 },
    };

    const statusInfo = statusProgress[project.status];
    if (statusInfo) {
      setProgress(statusInfo.progress);
      setEstimatedTime(statusInfo.timeMinutes);
      
      // Simulate progress increment for better UX
      const interval = setInterval(() => {
        setProgress((prev) => {
          const nextProgress = prev + 1;
          const maxProgress = statusInfo.progress + 25; // Allow progress up to next stage
          return nextProgress < maxProgress ? nextProgress : prev;
        });
        setEstimatedTime((prev) => Math.max(0, prev - 0.1));
      }, 3000); // Update every 3 seconds

      return () => clearInterval(interval);
    } else {
      setProgress(0);
      setEstimatedTime(0);
    }
  }, [project.status]);
  
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      recording: "bg-blue-500/20 text-blue-400",
      analyzing: "bg-primary/20 text-primary",
      training: "bg-purple-500/20 text-purple-400",
      ready: "bg-accent/20 text-accent",
      generating: "bg-primary/20 text-primary",
      completed: "bg-green-500/20 text-green-400",
      failed: "bg-destructive/20 text-destructive",
    };
    return colors[status] || colors.draft;
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      draft: "Draft",
      recording: "Recording",
      analyzing: "Analyzing Voice",
      training: "Training Model",
      ready: "Ready",
      generating: "Generating Audio",
      completed: "Completed",
      failed: "Failed",
    };
    return texts[status] || status;
  };

  const isProcessing = ['analyzing', 'generating', 'training'].includes(project.status);

  return (
    <Card className="p-6 backdrop-blur-xl bg-card/80 border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            {isProcessing ? (
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            ) : (
              <FileAudio className="w-6 h-6 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{project.name}</h3>
            <p className="text-xs text-muted-foreground">
              {format(new Date(project.created_at), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <Badge className={getStatusColor(project.status)}>
          {isProcessing && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          {getStatusText(project.status)}
        </Badge>
      </div>

      {project.script_text && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {project.script_text}
        </p>
      )}

      {project.status === 'recording' && (
        <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-400">
            🎙️ Recording voice clips: {project.clips_uploaded || 0}/{project.total_clips || 0}
          </p>
        </div>
      )}

      {isProcessing && (
        <div className="mb-4 space-y-3">
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-primary font-medium">
                {project.status === 'analyzing' 
                  ? '🎤 Analyzing your voice samples...'
                  : project.status === 'training'
                  ? '🧠 Training your custom voice model...'
                  : '🎵 Generating your cloned voice...'}
              </p>
              <div className="flex items-center gap-1 text-xs text-primary">
                <Clock className="w-3 h-3" />
                <span>~{Math.ceil(estimatedTime)} min</span>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-primary/70 mt-2">
              {progress < 30 
                ? 'Processing audio samples...' 
                : progress < 60 
                ? 'Building voice model...' 
                : 'Finalizing voice clone...'}
            </p>
          </div>
        </div>
      )}

      {project.status === 'failed' && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">
            ⚠️ Voice cloning failed. Please try again.
          </p>
        </div>
      )}

      {project.status === 'training' && (
        <div className="mt-4">
          <Button
            onClick={() => setShowGenerateDialog(true)}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Voice with Script
          </Button>
        </div>
      )}

      {project.generated_audio_url && project.status === 'completed' && (
        <AudioPlayer audioUrl={project.generated_audio_url} projectName={project.name} />
      )}

      <GenerateVoiceDialog
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
        projectId={project.id}
        projectName={project.name}
        initialStability={project.voice_stability ?? 0.5}
        initialSimilarityBoost={project.voice_similarity_boost ?? 0.75}
        initialStyle={project.voice_style ?? 0.0}
        initialSpeakerBoost={project.voice_speaker_boost ?? true}
      />
    </Card>
  );
};

export default VoiceProjectCard;
