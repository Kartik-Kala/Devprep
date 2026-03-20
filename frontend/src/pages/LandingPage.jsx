import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Code2, GitBranch, Layout, Users, Brain } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const roles = [
  { id: "Frontend", label: "Frontend", desc: "React, Vue, CSS, JS" },
  { id: "Backend", label: "Backend", desc: "Node.js, Python, APIs, DBs" },
  { id: "Full Stack", label: "Full Stack", desc: "End-to-end development" },
];

const experiences = [
  { id: "Fresher", label: "Fresher" },
  { id: "1-3 years", label: "1–3 yrs" },
  { id: "3+ years", label: "3+ yrs" },
];

const modes = [
  {
    id: "technical",
    label: "Technical",
    icon: Code2,
    desc: "Core concepts, frameworks, practical knowledge",
    color: "#3b82f6",
  },
  {
    id: "dsa",
    label: "DSA",
    icon: GitBranch,
    desc: "Data structures, algorithms, complexity",
    color: "#8b5cf6",
  },
  {
    id: "system_design",
    label: "System Design",
    icon: Layout,
    desc: "Scalable systems, architecture decisions",
    color: "#06b6d4",
  },
  {
    id: "hr",
    label: "HR Round",
    icon: Users,
    desc: "Salary, notice period, culture fit",
    color: "#10b981",
  },
  {
    id: "behavioral",
    label: "Behavioral",
    icon: Brain,
    desc: "Situation-based STAR questions",
    color: "#f59e0b",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async () => {
    if (!selectedRole || !selectedExperience || !selectedMode) {
      setError("Please select all three options to continue.");
      return;
    }

    setError("");
    setIsLoading(true);

    // PostHog tracking
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
    } catch (err) {
      console.error("Failed to start:", err);
      setError("Failed to start interview. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const canStart = selectedRole && selectedExperience && selectedMode;

  return (
    <div style={s.root}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>DP</div>
        <span style={s.logoText}>DevPrep India</span>
        <span style={s.badge}>Free · No signup</span>
      </div>

      {/* Hero */}
      <div style={s.hero}>
        <h1 style={s.headline}>
          Practice interviews.<br />
          <span style={s.accent}>Get better. Get hired.</span>
        </h1>
        <p style={s.subheadline}>
          AI mock interviews for Indian developers. Instant, free, no signup needed.
        </p>
      </div>

      {/* Config */}
      <div style={s.card}>

        {/* Role */}
        <div style={s.section}>
          <p style={s.sectionLabel}>Your Role</p>
          <div style={s.pillRow}>
            {roles.map(r => (
              <button
                key={r.id}
                style={{
                  ...s.pill,
                  ...(selectedRole === r.id ? s.pillActive : {})
                }}
                onClick={() => setSelectedRole(r.id)}
              >
                <span style={s.pillLabel}>{r.label}</span>
                <span style={s.pillDesc}>{r.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Experience */}
        <div style={s.section}>
          <p style={s.sectionLabel}>Experience Level</p>
          <div style={s.expRow}>
            {experiences.map(e => (
              <button
                key={e.id}
                style={{
                  ...s.expPill,
                  ...(selectedExperience === e.id ? s.expPillActive : {})
                }}
                onClick={() => setSelectedExperience(e.id)}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div style={s.section}>
          <p style={s.sectionLabel}>Interview Round</p>
          <div style={s.modeGrid}>
            {modes.map(m => {
              const Icon = m.icon;
              const isSelected = selectedMode === m.id;
              return (
                <button
                  key={m.id}
                  style={{
                    ...s.modeCard,
                    ...(isSelected ? {
                      ...s.modeCardActive,
                      borderColor: m.color,
                      boxShadow: `0 0 0 1px ${m.color}`,
                    } : {})
                  }}
                  onClick={() => setSelectedMode(m.id)}
                >
                  <Icon
                    size={20}
                    style={{ color: isSelected ? m.color : "rgba(255,255,255,0.4)", marginBottom: 8 }}
                  />
                  <span style={{
                    ...s.modeLabel,
                    color: isSelected ? "#fff" : "rgba(255,255,255,0.7)"
                  }}>
                    {m.label}
                  </span>
                  <span style={s.modeDesc}>{m.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p style={s.error}>{error}</p>}

        <button
          style={{
            ...s.startBtn,
            ...(canStart ? {} : s.startBtnDisabled)
          }}
          onClick={handleStart}
          disabled={isLoading || !canStart}
        >
          {isLoading ? (
            <><Loader2 size={18} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} /> Starting...</>
          ) : (
            "Start Interview →"
          )}
        </button>

        {!canStart && (
          <p style={s.hint}>Select role, experience, and round to begin</p>
        )}

      </div>

      <p style={s.footer}>No signup · No payment · Instant start</p>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; }
      `}</style>
    </div>
  );
}

const s = {
  root: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#fff",
    fontFamily: "system-ui, -apple-system, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px 16px 48px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 48,
    width: "100%",
    maxWidth: 640,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "#fff",
    color: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "-0.05em",
  },
  logoText: {
    fontSize: 15,
    fontWeight: 600,
    color: "#fff",
    flex: 1,
  },
  badge: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    border: "1px solid rgba(255,255,255,0.1)",
    padding: "3px 10px",
    borderRadius: 20,
  },
  hero: {
    textAlign: "center",
    marginBottom: 40,
    maxWidth: 520,
  },
  headline: {
    fontSize: "clamp(2rem, 6vw, 2.8rem)",
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: "-0.04em",
    marginBottom: 14,
  },
  accent: {
    color: "rgba(255,255,255,0.5)",
  },
  subheadline: {
    fontSize: 15,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.6,
  },
  card: {
    width: "100%",
    maxWidth: 640,
    background: "#111",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 28,
    display: "flex",
    flexDirection: "column",
    gap: 28,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.35)",
  },
  pillRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  pill: {
    flex: 1,
    minWidth: 140,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: "12px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    cursor: "pointer",
    color: "#fff",
    transition: "all 0.15s ease",
    textAlign: "left",
  },
  pillActive: {
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.3)",
  },
  pillLabel: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 3,
    color: "#fff",
  },
  pillDesc: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },
  expRow: {
    display: "flex",
    gap: 8,
  },
  expPill: {
    flex: 1,
    padding: "10px 0",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    cursor: "pointer",
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: 500,
    transition: "all 0.15s ease",
  },
  expPillActive: {
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "#fff",
  },
  modeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
    gap: 10,
  },
  modeCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: "14px 12px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    cursor: "pointer",
    color: "#fff",
    transition: "all 0.15s ease",
    textAlign: "left",
  },
  modeCardActive: {
    background: "rgba(255,255,255,0.06)",
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 4,
  },
  modeDesc: {
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    lineHeight: 1.4,
  },
  startBtn: {
    width: "100%",
    padding: "16px",
    background: "#fff",
    color: "#000",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.15s ease",
  },
  startBtnDisabled: {
    opacity: 0.3,
    cursor: "not-allowed",
  },
  error: {
    fontSize: 12,
    color: "#f87171",
    textAlign: "center",
  },
  hint: {
    fontSize: 12,
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
    marginTop: -16,
  },
  footer: {
    marginTop: 24,
    fontSize: 12,
    color: "rgba(255,255,255,0.2)",
  },
};