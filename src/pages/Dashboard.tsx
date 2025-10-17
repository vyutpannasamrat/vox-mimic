import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mic, LogOut, Plus, Sparkles } from "lucide-react";
import VoiceProjectCard from "@/components/VoiceProjectCard";
import CreateProjectDialog from "@/components/CreateProjectDialog";

interface VoiceProject {
  id: string;
  name: string;
  status: string;
  created_at: string;
  voice_sample_url: string | null;
  script_text: string | null;
  generated_audio_url: string | null;
}

const Dashboard = () => {
  const [projects, setProjects] = useState<VoiceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("voice_projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading projects",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-xl bg-card/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Mic className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              VoiceClone AI
            </h1>
          </div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-12 text-center max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            Your Voice Projects
          </h2>
          <p className="text-muted-foreground text-lg">
            Upload your voice, provide a script, and let AI create perfect voice clones
          </p>
        </div>

        {/* Create Project Button */}
        <div className="mb-8 flex justify-center">
          <Button
            size="lg"
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Project
            <Sparkles className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Loading projects...</p>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <Card className="p-12 text-center backdrop-blur-xl bg-card/80 border-border/50">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Mic className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">No projects yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Get started by creating your first voice cloning project
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-primary to-accent"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Project
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <VoiceProjectCard
                key={project.id}
                project={project}
                onUpdate={loadProjects}
              />
            ))}
          </div>
        )}
      </main>

      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={loadProjects}
      />
    </div>
  );
};

export default Dashboard;
