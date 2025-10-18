import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileAudio, Loader2 } from "lucide-react";
import { format } from "date-fns";
import AudioPlayer from "./AudioPlayer";

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

interface VoiceProjectCardProps {
  project: VoiceProject;
  onUpdate: () => void;
}

const VoiceProjectCard = ({ project }: VoiceProjectCardProps) => {
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
        <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-sm text-primary">
            {project.status === 'analyzing' 
              ? '🎤 Analyzing your voice samples...'
              : project.status === 'training'
              ? '🧠 Training your custom voice model...'
              : '🎵 Generating your cloned voice...'}
          </p>
        </div>
      )}

      {project.status === 'failed' && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">
            ⚠️ Voice cloning failed. Please try again.
          </p>
        </div>
      )}

      {project.generated_audio_url && project.status === 'completed' && (
        <AudioPlayer audioUrl={project.generated_audio_url} projectName={project.name} />
      )}
    </Card>
  );
};

export default VoiceProjectCard;
