import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ExpressionControlPanel from "./ExpressionControlPanel";

interface GenerateVoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  initialStability?: number;
  initialSimilarityBoost?: number;
  initialStyle?: number;
  initialSpeakerBoost?: boolean;
}

const GenerateVoiceDialog = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  initialStability = 0.5,
  initialSimilarityBoost = 0.75,
  initialStyle = 0.0,
  initialSpeakerBoost = true,
}: GenerateVoiceDialogProps) => {
  const [scriptText, setScriptText] = useState("");
  const [stability, setStability] = useState(initialStability);
  const [similarityBoost, setSimilarityBoost] = useState(initialSimilarityBoost);
  const [style, setStyle] = useState(initialStyle);
  const [speakerBoost, setSpeakerBoost] = useState(initialSpeakerBoost);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!scriptText.trim()) {
      toast({
        title: "Script Required",
        description: "Please enter the text you want to convert to speech",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Update project with script and expression settings
      const { error: updateError } = await supabase
        .from("voice_projects")
        .update({
          script_text: scriptText,
          voice_stability: stability,
          voice_similarity_boost: similarityBoost,
          voice_style: style,
          voice_speaker_boost: speakerBoost,
        })
        .eq("id", projectId);

      if (updateError) throw updateError;

      // Trigger clone-voice function
      const { error: functionError } = await supabase.functions.invoke("clone-voice", {
        body: { projectId },
      });

      if (functionError) throw functionError;

      toast({
        title: "Generation Started!",
        description: "Your voice is being cloned. This may take a few minutes.",
      });

      onOpenChange(false);
      setScriptText("");
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] backdrop-blur-xl bg-card/95 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Generate Voice for {projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Script Input */}
          <div className="space-y-2">
            <Label htmlFor="script">Script Text</Label>
            <Textarea
              id="script"
              placeholder="Enter the text you want to convert to speech..."
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              className="min-h-[120px] bg-background/50"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Enter the text that will be spoken in your cloned voice
            </p>
          </div>

          {/* Expression Controls */}
          <ExpressionControlPanel
            stability={stability}
            similarityBoost={similarityBoost}
            style={style}
            speakerBoost={speakerBoost}
            onStabilityChange={setStability}
            onSimilarityBoostChange={setSimilarityBoost}
            onStyleChange={setStyle}
            onSpeakerBoostChange={setSpeakerBoost}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Voice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateVoiceDialog;
