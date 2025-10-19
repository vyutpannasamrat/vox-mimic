import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ExpressionControlPanelProps {
  stability: number;
  similarityBoost: number;
  style: number;
  speakerBoost: boolean;
  onStabilityChange: (value: number) => void;
  onSimilarityBoostChange: (value: number) => void;
  onStyleChange: (value: number) => void;
  onSpeakerBoostChange: (value: boolean) => void;
}

const ExpressionControlPanel = ({
  stability,
  similarityBoost,
  style,
  speakerBoost,
  onStabilityChange,
  onSimilarityBoostChange,
  onStyleChange,
  onSpeakerBoostChange,
}: ExpressionControlPanelProps) => {
  return (
    <Card className="p-6 backdrop-blur-xl bg-card/80 border-border/50">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Voice Expression Controls
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">Fine-tune how your cloned voice sounds</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h3>
        </div>

        {/* Stability Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="stability" className="text-sm font-medium">
              Stability
            </Label>
            <span className="text-xs text-muted-foreground">{stability.toFixed(2)}</span>
          </div>
          <Slider
            id="stability"
            value={[stability]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={(value) => onStabilityChange(value[0])}
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">
            Higher = more consistent, Lower = more expressive
          </p>
        </div>

        {/* Similarity Boost Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="similarity" className="text-sm font-medium">
              Similarity Boost
            </Label>
            <span className="text-xs text-muted-foreground">{similarityBoost.toFixed(2)}</span>
          </div>
          <Slider
            id="similarity"
            value={[similarityBoost]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={(value) => onSimilarityBoostChange(value[0])}
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">
            Enhances similarity to the original voice
          </p>
        </div>

        {/* Style Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="style" className="text-sm font-medium">
              Style Exaggeration
            </Label>
            <span className="text-xs text-muted-foreground">{style.toFixed(2)}</span>
          </div>
          <Slider
            id="style"
            value={[style]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={(value) => onStyleChange(value[0])}
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">
            Amplifies the style of the original speaker
          </p>
        </div>

        {/* Speaker Boost Switch */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-1">
            <Label htmlFor="speaker-boost" className="text-sm font-medium">
              Speaker Boost
            </Label>
            <p className="text-xs text-muted-foreground">
              Boost similarity to the original speaker
            </p>
          </div>
          <Switch
            id="speaker-boost"
            checked={speakerBoost}
            onCheckedChange={onSpeakerBoostChange}
          />
        </div>
      </div>
    </Card>
  );
};

export default ExpressionControlPanel;
