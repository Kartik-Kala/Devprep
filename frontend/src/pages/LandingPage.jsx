import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutTemplate, Database, Layers, Loader2, Code2, GitBranch, Layout, Users, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const roles = [
  { id: "Frontend", title: "Frontend", description: "React, Vue, Angular, CSS, JavaScript", icon: LayoutTemplate },
  { id: "Backend", title: "Backend", description: "Node.js, Python, Java, Databases, APIs", icon: Database },
  { id: "Full Stack", title: "Full Stack", description: "End-to-end development expertise", icon: Layers },
];

const experienceLevels = [
  { id: "Fresher", label: "Fresher" },
  { id: "1-3 years", label: "1-3 years" },
  { id: "3+ years", label: "3+ years" },
];

const modes = [
  { id: "technical", label: "Technical", icon: Code2, desc: "Core concepts & frameworks" },
  { id: "dsa", label: "DSA", icon: GitBranch, desc: "Data structures & algorithms" },
  { id: "system_design", label: "System Design", icon: Layout, desc: "Scalable systems & architecture" },
  { id: "hr", label: "HR Round", icon: Users, desc: "Culture fit & HR questions" },
  { id: "behavioral", label: "Behavioral", icon: Brain, desc: "Situation-based STAR questions" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartInterview = async () => {
    if (!selectedRole || !selectedExperience || !selectedMode) {
      toast.error("Please select role, experience, and interview round");
      return;
    }

    setIsLoading(true);

    if (window.posthog) {
      window.posthog.capture("interview_started", {
        role: selectedRole,
        experience: selectedExperience,
        mode: selectedMode,
      });
    }

    try {
      const response = await axios.post(`${API}/interview/start`, {
        role: selectedRole,
        experience: selectedExperience,
        mode: selectedMode,
      });
      navigate(`/interview/${response.data.session_id}`, {
        state: {
          role: response.data.role,
          experience: response.data.experience,
          mode: response.data.mode,
          firstQuestion: response.data.first_question,
        },
      });
    } catch (error) {
      console.error("Failed to start interview:", error);
      toast.error("Failed to start interview. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const canStart = selectedRole && selectedExperience && selectedMode;

  return (
    <main
      data-testid="landing-page"
      className="min-h-screen flex flex-col justify-center items-center relative overflow-hidden px-4 py-12"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1641749471127-3f76436e8b38?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMGRhcmslMjBtaW5pbWFsJTIwdGVjaG5vbG9neSUyMGJhY2tncm91bmQlMjBkaWdpdGFsJTIwbWVzaHxlbnwwfHx8fDE3NzM4MTQ2NDV8MA&ixlib=rb-4.1.0&q=85)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto w-full">

        {/* Hero */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="font-mono font-bold text-4xl sm:text-5xl lg:text-6xl tracking-tight text-white mb-4">
            Master Your <span className="text-emerald-500">Tech Interview</span>
          </h1>
          <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            AI-powered mock interviews tailored for Indian developers. Practice with real questions and get instant feedback.
          </p>
        </div>

        {/* Role Selection */}
        <section className="mb-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="font-mono font-bold text-lg text-slate-300 mb-4 text-left">Select Your Role</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roles.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  style={{
                    background: isSelected ? "rgba(16,185,129,0.1)" : "rgba(30,41,59,0.5)",
                    border: `1px solid ${isSelected ? "rgba(16,185,129,0.6)" : "rgba(51,65,85,0.5)"}`,
                    boxShadow: isSelected ? "0 0 20px rgba(16,185,129,0.15)" : "none",
                    borderRadius: 8,
                    padding: "24px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    width: "100%",
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 16,
                    background: isSelected ? "rgba(16,185,129,0.2)" : "rgba(30,41,59,0.8)",
                  }}>
                    <Icon size={24} color={isSelected ? "#34d399" : "#64748b"} />
                  </div>
                  <h3 style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: 18, marginBottom: 8, color: isSelected ? "#34d399" : "#fff" }}>
                    {role.title}
                  </h3>
                  <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>{role.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Experience Level */}
        <section className="mb-10 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <h2 className="font-mono font-bold text-lg text-slate-300 mb-4 text-left">Experience Level</h2>
          <div style={{
            display: "inline-flex",
            background: "rgba(15,23,42,0.8)",
            border: "1px solid rgba(51,65,85,0.5)",
            borderRadius: 8,
            padding: 4,
            gap: 4,
          }}>
            {experienceLevels.map((level) => {
              const isSelected = selectedExperience === level.id;
              return (
                <button
                  key={level.id}
                  onClick={() => setSelectedExperience(level.id)}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: "JetBrains Mono, monospace",
                    cursor: "pointer",
                    border: "none",
                    transition: "all 0.2s ease",
                    background: isSelected ? "rgba(16,185,129,0.15)" : "transparent",
                    color: isSelected ? "#34d399" : "#94a3b8",
                    boxShadow: isSelected ? "0 0 12px rgba(16,185,129,0.2)" : "none",
                  }}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Interview Round */}
        <section className="mb-10 animate-slide-up" style={{ animationDelay: "0.25s" }}>
          <h2 className="font-mono font-bold text-lg text-slate-300 mb-4 text-left">Interview Round</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {modes.map((mode) => {
              const Icon = mode.icon;
              const isSelected = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  style={{
                    background: isSelected ? "rgba(16,185,129,0.08)" : "rgba(30,41,59,0.5)",
                    border: `1px solid ${isSelected ? "rgba(16,185,129,0.6)" : "rgba(51,65,85,0.5)"}`,
                    boxShadow: isSelected ? "0 0 16px rgba(16,185,129,0.15)" : "none",
                    borderRadius: 8,
                    padding: "16px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    width: "100%",
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 12,
                    background: isSelected ? "rgba(16,185,129,0.2)" : "rgba(30,41,59,0.8)",
                  }}>
                    <Icon size={20} color={isSelected ? "#34d399" : "#64748b"} />
                  </div>
                  <h3 style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: 13, marginBottom: 4, color: isSelected ? "#34d399" : "#fff" }}>
                    {mode.label}
                  </h3>
                  <p style={{ fontSize: 11, color: "#64748b", margin: 0, lineHeight: 1.4 }}>{mode.desc}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <Button
            onClick={handleStartInterview}
            disabled={isLoading || !canStart}
            className="btn-primary px-8 py-6 text-lg"
            style={{ opacity: canStart ? 1 : 0.4, cursor: canStart ? "pointer" : "not-allowed" }}
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Starting Interview...</>
            ) : (
              "Start Interview"
            )}
          </Button>
          {!canStart && (
            <p className="text-slate-500 text-sm mt-4">
              Select a role, experience level, and interview round to begin
            </p>
          )}
        </div>

      </div>
    </main>
  );
}