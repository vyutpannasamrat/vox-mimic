import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mic, Sparkles, Zap, Shield } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Mic className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              VoiceClone AI
            </h1>
          </div>
          <Button
            onClick={() => navigate("/auth")}
            variant="outline"
            className="border-primary/50 hover:bg-primary/10"
          >
            Sign In
          </Button>
        </header>

        {/* Hero Section */}
        <main className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-8">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Voice Cloning</span>
            </div>

            <h2 className="text-5xl md:text-7xl font-bold leading-tight">
              Clone Your Voice
              <br />
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                With AI Precision
              </span>
            </h2>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload a voice sample, provide your script, and let our advanced AI
              generate perfect voice clones in seconds. Natural, authentic, and
              indistinguishable from the real thing.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity text-lg px-8 shadow-lg shadow-primary/20"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Get Started Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-border/50 hover:bg-card/50 text-lg px-8"
              >
                Learn More
              </Button>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-8 pt-20">
              <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-xl border border-border/50 hover:border-primary/50 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 mx-auto">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Lightning Fast</h3>
                <p className="text-muted-foreground">
                  Generate voice clones in seconds with our optimized AI pipeline
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-xl border border-border/50 hover:border-primary/50 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 mx-auto">
                  <Mic className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Studio Quality</h3>
                <p className="text-muted-foreground">
                  Professional-grade audio output that sounds natural and authentic
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-xl border border-border/50 hover:border-primary/50 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 mx-auto">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Secure & Private</h3>
                <p className="text-muted-foreground">
                  Your voice data is encrypted and protected with enterprise-grade security
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
