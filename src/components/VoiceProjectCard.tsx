import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileAudio, Download, Play, Pause } from "lucide-react";
import { useState, useRef } from "react";
import { format } from "date-fns";

interface VoiceProject {
  id: string;
  name: string;
  status: string;
  created_at: string;
  voice_sample_url: string | null;
  script_text: string | null;
  generated_audio_url: string | null;
}

interface VoiceProjectCardProps {
  project: VoiceProject;
  onUpdate: () => void;
}

const VoiceProjectCard = ({ project }: VoiceProjectCardProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      analyzing: "bg-primary/20 text-primary",
      ready: "bg-accent/20 text-accent",
      generating: "bg-primary/20 text-primary animate-pulse",
      completed: "bg-green-500/20 text-green-400",
      failed: "bg-destructive/20 text-destructive",
    };
    return colors[status] || colors.draft;
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    if (project.generated_audio_url) {
      window.open(project.generated_audio_url, "_blank");
    }
  };

  return (
    <Card className="p-6 backdrop-blur-xl bg-card/80 border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <FileAudio className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{project.name}</h3>
            <p className="text-xs text-muted-foreground">
              {format(new Date(project.created_at), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <Badge className={getStatusColor(project.status)}>
          {project.status}
        </Badge>
      </div>

      {project.script_text && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {project.script_text}
        </p>
      )}

      {project.generated_audio_url && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={togglePlay}
            className="flex-1"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Preview
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDownload}
            className="px-3"
          >
            <Download className="w-4 h-4" />
          </Button>
          <audio
            ref={audioRef}
            src={project.generated_audio_url}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        </div>
      )}
    </Card>
  );
};

export default VoiceProjectCard;
