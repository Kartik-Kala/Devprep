import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Welcome back!");
      } else {
        await register(email, password);
        toast.success("Account created!");
      }
      navigate("/");
    } catch (err) {
      const msg = err.response?.data?.detail || "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div style={s.root}>
      <div style={s.card}>
        {/* Back button */}
        <button style={s.backBtn} onClick={() => navigate("/")}>
          <ArrowLeft size={15} />
          Back
        </button>

        {/* Logo */}
        <div style={s.logoRow}>
          <div style={s.logo}>DP</div>
          <span style={s.logoText}>DevPrep India</span>
        </div>

        <h1 style={s.title}>
          {mode === "login" ? "Welcome back" : "Create account"}
        </h1>
        <p style={s.subtitle}>
          {mode === "login"
            ? "Log in to view your interview history"
            : "Sign up to save your interview sessions"}
        </p>

        {/* Tabs */}
        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(mode === "login" ? s.tabActive : {}) }}
            onClick={() => setMode("login")}
          >
            Log In
          </button>
          <button
            style={{ ...s.tab, ...(mode === "register" ? s.tabActive : {}) }}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        {/* Fields */}
        <div style={s.fields}>
          <div style={s.fieldGroup}>
            <label style={s.label}>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              style={s.input}
              autoComplete="email"
            />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              style={s.input}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
        </div>

        {/* Submit */}
        <button style={s.submitBtn} onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Please wait...</>
          ) : (
            mode === "login" ? "Log In →" : "Create Account →"
          )}
        </button>

        {/* Switch mode */}
        <p style={s.switchText}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            style={s.switchBtn}
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Register" : "Log In"}
          </button>
        </p>

        <p style={s.guestNote}>
          You can also use DevPrep without an account — just{" "}
          <button style={s.switchBtn} onClick={() => navigate("/")}>
            continue as guest
          </button>
        </p>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.2); }
        input:focus { outline: none; border-color: rgba(16,185,129,0.6) !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
      `}</style>
    </div>
  );
}

const s = {
  root: {
    minHeight: "100vh",
    background: "#0a0a0a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#111",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "32px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    alignSelf: "flex-start",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
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
  },
  logoText: {
    fontSize: 15,
    fontWeight: 600,
    color: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#fff",
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    margin: 0,
    marginTop: -10,
  },
  tabs: {
    display: "flex",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    padding: "8px 0",
    borderRadius: 7,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tabActive: {
    background: "rgba(255,255,255,0.1)",
    color: "#fff",
  },
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: "0.04em",
  },
  input: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 14,
    color: "#fff",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  submitBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "13px 0",
    background: "#fff",
    color: "#000",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    transition: "opacity 0.2s",
  },
  switchText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    margin: 0,
  },
  switchBtn: {
    background: "none",
    border: "none",
    color: "#34d399",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
  },
  guestNote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
    margin: 0,
    marginTop: -8,
  },
};