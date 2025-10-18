import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Sparkles, Loader2 } from "lucide-react";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(100, "Name must be less than 100 characters"),
  script: z.string().trim().min(10, "Script must be at least 10 characters").max(5000, "Script must be less than 5000 characters"),
});

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateProjectDialog = ({ open, onOpenChange, onSuccess }: CreateProjectDialogProps) => {
  const [name, setName] = useState("");
  const [script, setScript] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("audio/")) {
        toast({
          title: "Invalid file",
          description: "Please upload an audio file",
          variant: "destructive",
        });
        return;
      }
      setAudioFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const validation = projectSchema.safeParse({ name, script });
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      toast({
        title: "Validation Error",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    if (!audioFile) {
      toast({
        title: "Missing voice sample",
        description: "Please upload an audio file",
        variant: "destructive",
      });
      return;
    }

    if (audioFile.size > 20 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Audio file must be less than 20MB",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload voice sample
      const fileExt = audioFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("voice-samples")
        .upload(fileName, audioFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("voice-samples")
        .getPublicUrl(fileName);

      // Create project
      const { data: newProject, error: insertError } = await supabase
        .from("voice_projects")
        .insert({
          user_id: user.id,
          name: validation.data.name,
          script_text: validation.data.script,
          voice_sample_url: publicUrl,
          status: "draft",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: "Project created!",
        description: "Starting voice cloning process...",
      });

      // Start voice cloning in background
      supabase.functions
        .invoke("clone-voice", {
          body: { projectId: newProject.id },
        })
        .then(({ error }) => {
          if (error) {
            console.error("Voice cloning error:", error);
          }
        });

      // Reset form
      setName("");
      setScript("");
      setAudioFile(null);
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="audio">Voice Sample</Label>
            <div className="relative">
              <Input
                id="audio"
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="bg-background/50"
              />
              <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            {audioFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {audioFile.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="script">Script</Label>
            <Textarea
              id="script"
              placeholder="Enter the text you want to be spoken in your cloned voice..."
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={6}
              className="bg-background/50 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {script.length} characters
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating & Cloning Voice...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Create & Clone Voice
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialog;
