import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2 } from "lucide-react";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(100, "Name must be less than 100 characters"),
  totalClips: z.number().min(10, "Minimum 10 clips required").max(100, "Maximum 100 clips allowed"),
});

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateProjectDialog = ({ open, onOpenChange, onSuccess }: CreateProjectDialogProps) => {
  const [name, setName] = useState("");
  const [totalClips, setTotalClips] = useState(30);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const validation = projectSchema.safeParse({ name, totalClips });
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      toast({
        title: "Validation Error",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create project with recording status
      const { data: newProject, error: insertError } = await supabase
        .from("voice_projects")
        .insert({
          user_id: user.id,
          name: validation.data.name,
          status: "recording",
          total_clips: validation.data.totalClips,
          clips_uploaded: 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: "Project created!",
        description: "Ready to record your voice clips.",
      });

      // Reset form
      setName("");
      setTotalClips(30);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] backdrop-blur-xl bg-card/95">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Create New Voice Project
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              placeholder="e.g., Product Demo Voice"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background/50"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clips">Number of Voice Clips</Label>
            <Input
              id="clips"
              type="number"
              min={10}
              max={100}
              value={totalClips}
              onChange={(e) => setTotalClips(Number(e.target.value))}
              className="bg-background/50"
            />
            <p className="text-xs text-muted-foreground">
              More clips = better voice quality (recommended: 30-50)
            </p>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">Next Steps:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Record or upload {totalClips} voice clips</li>
              <li>Each clip will have a suggested phrase</li>
              <li>AI will train your custom voice model</li>
              <li>Generate speech with your cloned voice</li>
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Project...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Create Project & Start Recording
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialog;
