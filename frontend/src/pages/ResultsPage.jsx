import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trophy, RefreshCcw, Home, AlertCircle, Loader2, Share2, Download, CheckCircle2 } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MODE_LABELS = {
  technical: "Technical Round",
  dsa: "DSA Round",
  system_design: "System Design Round",
  hr: "HR Round",
  behavioral: "Behavioral Round",
};

const getScoreColor = (score) => {
  if (score >= 8) return "#22c55e";
  if (score >= 6) return "#f59e0b";
  return "#ef4444";
};

const getScoreLabel = (score) => {
  if (score >= 8) return "Excellent";
  if (score >= 6) return "Good";
  if (score >= 4) return "Average";
  return "Needs Work";
};

export default function ResultsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchResults();
  }, [sessionId]);

  const fetchResults = async () => {
    try {
      const response = await axios.get(`${API}/interview/results/${sessionId}`);
      setResults(response.data);

      // PostHog tracking
      if (window.posthog) {
        window.posthog.capture("interview_completed", {
          role: response.data.role,
          experience: response.data.experience,
          mode: response.data.mode,
          score: response.data.overall_score,
        });
      }
    } catch (err) {
      console.error("Failed to fetch results:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // generate share image on canvas
  const generateShareCard = () => {
    const canvas = canvasRef.current;
    if (!canvas || !results) return null;

    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");

    // background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, 1200, 630);

    // subtle grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < 1200; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 630); ctx.stroke();
    }
    for (let y = 0; y < 630; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke();
    }

    const scoreColor = getScoreColor(results.overall_score);

    // score circle
    ctx.beginPath();
    ctx.arc(200, 315, 120, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 12;
    ctx.stroke();

    const progress = (results.overall_score / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(200, 315, 120, -Math.PI / 2, -Math.PI / 2 + progress);
    ctx.strokeStyle = scoreColor;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.stroke();

    // score number
    ctx.fillStyle = scoreColor;
    ctx.font = "bold 72px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`${results.overall_score}`, 200, 330);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "24px system-ui";
    ctx.fillText("/10", 200, 368);

    // score label
    ctx.fillStyle = scoreColor;
    ctx.font = "bold 20px system-ui";
    ctx.fillText(getScoreLabel(results.overall_score), 200, 410);

    // right content
    ctx.textAlign = "left";

    // brand
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "16px system-ui";
    ctx.fillText("devprepindia.com", 380, 80);

    // title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px system-ui";
    ctx.fillText("Interview Complete", 380, 200);

    // meta
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "22px system-ui";
    ctx.fillText(`${results.role} · ${results.experience} · ${MODE_LABELS[results.mode] || results.mode}`, 380, 250);

    // summary (wrapped)
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "18px system-ui";
    const words = results.summary.split(" ");
    let line = "";
    let y = 320;
    for (const word of words) {
      const testLine = line + word + " ";
      if (ctx.measureText(testLine).width > 720 && line) {
        ctx.fillText(line, 380, y);
        line = word + " ";
        y += 28;
        if (y > 500) break;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 380, y);

    // cta
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px system-ui";
    ctx.fillText("Practice free at devprepindia.com →", 380, 570);

    return canvas.toDataURL("image/png");
  };

  const handleDownloadCard = () => {
    const dataUrl = generateShareCard();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.download = "devprep-score.png";
    a.href = dataUrl;
    a.click();

    if (window.posthog) {
      window.posthog.capture("score_card_downloaded", {
        score: results.overall_score,
        mode: results.mode,
      });
    }
  };

  const handleCopyLink = () => {
    const text = `I just completed a ${MODE_LABELS[results?.mode]} on DevPrep India and scored ${results?.overall_score}/10!\n\nPractice free AI mock interviews at devprepindia.com 🚀`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    if (window.posthog) {
      window.posthog.capture("score_shared", { score: results?.overall_score });
    }
  };

  if (isLoading) {
    return (
      <div style={s.center}>
        <Loader2 size={32} style={{ color: "#fff", animation: "spin 1s linear infinite" }} />
        <p style={{ color: "rgba(255,255,255,0.4)", marginTop: 16, fontSize: 14 }}>Generating your results...</p>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  if (!results) {
    return (
      <div style={s.center}>
        <AlertCircle size={40} style={{ color: "#ef4444" }} />
        <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 12 }}>Could not load results</p>
        <button style={s.ghostBtn} onClick={() => navigate("/")}>Go Home</button>
      </div>
    );
  }

  const scoreColor = getScoreColor(results.overall_score);

  return (
    <div style={s.root}>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>DP</div>
        <span style={s.logoText}>DevPrep India</span>
      </div>

      {/* Score card */}
      <div style={s.scoreCard}>
        <div style={s.scoreLeft}>
          <div style={{ position: "relative", width: 120, height: 120 }}>
            <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="50"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(results.overall_score / 10) * 314} 314`}
              />
            </svg>
            <div style={s.scoreInner}>
              <span style={{ ...s.scoreNum, color: scoreColor }}>{results.overall_score}</span>
              <span style={s.scoreDenom}>/10</span>
            </div>
          </div>
          <span style={{ ...s.scoreLabel, color: scoreColor }}>
            <Trophy size={14} style={{ marginRight: 4 }} />
            {getScoreLabel(results.overall_score)}
          </span>
        </div>

        <div style={s.scoreRight}>
          <p style={s.scoreMeta}>{results.role} · {results.experience} · {MODE_LABELS[results.mode] || results.mode}</p>
          <p style={s.summary}>{results.summary}</p>

          {/* Share buttons */}
          <div style={s.shareRow}>
            <button style={s.shareBtn} onClick={handleDownloadCard}>
              <Download size={15} />
              Download Score Card
            </button>
            <button style={s.shareBtn} onClick={handleCopyLink}>
              {copied ? <CheckCircle2 size={15} /> : <Share2 size={15} />}
              {copied ? "Copied!" : "Copy to Share"}
            </button>
          </div>
        </div>
      </div>

      {/* Detailed feedback */}
      <div style={s.section}>
        <p style={s.sectionTitle}>Detailed Feedback</p>
        {results.questions.map((q, i) => (
          <div key={i} style={s.questionCard}>
            <button
              style={s.questionHeader}
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            >
              <span style={s.qBadge}>Q{i + 1}</span>
              <span style={s.qText}>{q.question}</span>
              <span style={{ ...s.qScore, color: getScoreColor(q.score) }}>{q.score}/10</span>
              <span style={s.chevron}>{expandedIndex === i ? "▲" : "▼"}</span>
            </button>

            {expandedIndex === i && (
              <div style={s.questionBody}>
                <div style={s.qSection}>
                  <p style={s.qSectionLabel}>Your Answer</p>
                  <p style={s.qSectionText}>{q.answer || "No answer provided"}</p>
                </div>
                <div style={s.qSection}>
                  <p style={s.qSectionLabel}>Feedback</p>
                  <p style={s.qSectionText}>{q.feedback || "No feedback available"}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={s.actions}>
        <button style={s.primaryBtn} onClick={() => navigate("/")}>
          <RefreshCcw size={16} />
          Try Another Round
        </button>
        <button style={s.ghostBtn} onClick={() => navigate("/")}>
          <Home size={16} />
          Home
        </button>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  );
}

const s = {
  root: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#fff",
    fontFamily: "system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px 16px 60px",
    gap: 24,
  },
  center: {
    minHeight: "100vh",
    background: "#0a0a0a",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    fontFamily: "system-ui, sans-serif",
    color: "#fff",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    maxWidth: 700,
    marginBottom: 8,
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
  },
  scoreCard: {
    width: "100%",
    maxWidth: 700,
    background: "#111",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 28,
    display: "flex",
    gap: 28,
    alignItems: "flex-start",
  },
  scoreLeft: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },
  scoreInner: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
  },
  scoreNum: {
    fontSize: 36,
    fontWeight: 800,
    lineHeight: 1,
  },
  scoreDenom: {
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
  },
  scoreRight: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  scoreMeta: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: "0.05em",
  },
  summary: {
    fontSize: 14,
    lineHeight: 1.65,
    color: "rgba(255,255,255,0.75)",
  },
  shareRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 4,
  },
  shareBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#fff",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  },
  section: {
    width: "100%",
    maxWidth: 700,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.3)",
    marginBottom: 4,
  },
  questionCard: {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    overflow: "hidden",
  },
  questionHeader: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    background: "none",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    textAlign: "left",
  },
  qBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.4)",
    background: "rgba(255,255,255,0.06)",
    padding: "2px 8px",
    borderRadius: 20,
    flexShrink: 0,
  },
  qText: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 1.4,
  },
  qScore: {
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  chevron: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    flexShrink: 0,
  },
  questionBody: {
    padding: "0 16px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    borderTop: "1px solid rgba(255,255,255,0.05)",
    paddingTop: 14,
  },
  qSection: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  qSectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.25)",
  },
  qSectionText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 1.6,
    background: "rgba(255,255,255,0.03)",
    padding: "10px 12px",
    borderRadius: 8,
  },
  actions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 24px",
    background: "#fff",
    color: "#000",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  ghostBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 24px",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
};