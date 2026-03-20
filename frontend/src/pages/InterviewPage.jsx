import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Video, VideoOff, AlertCircle } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATE = {
  CONNECTING: "connecting",
  SPEAKING: "speaking",
  LISTENING: "listening",
  PROCESSING: "processing",
  ERROR: "error",
  COMPLETE: "complete",
};

const MODE_TOTAL_QUESTIONS = {
  technical: 5,
  dsa: 5,
  system_design: 4,
  hr: 5,
  behavioral: 5,
};

const truncate = (text, maxLen = 120) => {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
};

export default function InterviewPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const mode = location.state?.mode || "technical";
  const totalQuestions = MODE_TOTAL_QUESTIONS[mode] || 5;
  const role = location.state?.role || "Developer";
  const experience = location.state?.experience || "Fresher";

  const [state, setState] = useState(STATE.CONNECTING);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [transcript, setTranscript] = useState("");
  const [statusText, setStatusText] = useState("Connecting...");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [subtitleText, setSubtitleText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const recognitionRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const pendingAnswerRef = useRef("");

  // start camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera error:", err);
        setCamOn(false);
      }
    };
    startCamera();

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // browser TTS
  const speakText = (text) => {
    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);

      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v =>
        v.name.includes("Samantha") ||
        v.name.includes("Karen") ||
        v.name.includes("Daniel") ||
        (v.lang.startsWith("en") && !v.name.includes("Google"))
      );
      if (preferred) utterance.voice = preferred;

      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        setState(STATE.SPEAKING);
        setIsSpeaking(true);
        setSubtitleText(truncate(text));
        setStatusText("Alex is speaking...");
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setSubtitleText("");
        resolve();
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setSubtitleText("");
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  };

  // start mic
  const startListening = () => {
    // stop any existing recognition first
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusText("Speech recognition not supported. Use Safari or Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onstart = () => {
      setState(STATE.LISTENING);
      setStatusText("Listening... speak your answer");
      setTranscript("");
      pendingAnswerRef.current = "";
      setErrorMsg("");
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) {
        pendingAnswerRef.current = (pendingAnswerRef.current + " " + final).trim();
      }
      setTranscript(pendingAnswerRef.current || interim);
    };

    recognition.onerror = (e) => {
      if (e.error !== "no-speech") console.error("Speech error:", e.error);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // submit answer
  const stopAndSubmit = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const answer = pendingAnswerRef.current.trim() || transcript.trim();
    if (!answer) {
      setStatusText("No answer detected. Please try again.");
      setTimeout(() => startListening(), 1000);
      return;
    }

    pendingAnswerRef.current = "";
    setTranscript("");
    setState(STATE.PROCESSING);
    setStatusText("Processing your answer...");
    setErrorMsg("");

    try {
      const response = await axios.post(`${API}/interview/answer`, {
        session_id: sessionId,
        answer,
      }, { timeout: 30000 });

      const { conversational_response, next_question, is_complete, current_question_number } = response.data;

      await speakText(conversational_response);

      if (is_complete) {
        setState(STATE.COMPLETE);
        setStatusText("Interview complete!");
        setTimeout(() => navigate(`/results/${sessionId}`), 1500);
     } else {
  setCurrentQuestion(current_question_number);
  setStatusText("Alex is speaking...");
  if (next_question && next_question !== "null") {
    await speakText(next_question);
  }
  startListening();
}
    } catch (err) {
      console.error("Submit error:", err);

      let msg = "Something went wrong. Please try again.";
      if (err.response?.status === 404) {
        msg = "Session expired. Please start a new interview.";
        setState(STATE.ERROR);
        setErrorMsg(msg);
        setStatusText(msg);
        return;
      } else if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        msg = "Request timed out. The server may be waking up — please try again.";
      }

      setErrorMsg(msg);
      setStatusText(msg);
      setState(STATE.LISTENING);
      setTimeout(() => startListening(), 2000);
    }
  };

  // kick off interview
  useEffect(() => {
    const firstQuestion = location.state?.firstQuestion;
    if (!firstQuestion) return;

    const go = async () => {
      await new Promise(r => setTimeout(r, 800));
      if (window.speechSynthesis.getVoices().length === 0) {
        await new Promise(r => {
          window.speechSynthesis.onvoiceschanged = r;
          setTimeout(r, 2000);
        });
      }
      await speakText(firstQuestion);
      startListening();
    };

    go();
  }, []);

  const toggleCam = () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setCamOn(track.enabled);
      }
    }
  };

  const handleEndCall = () => {
    window.speechSynthesis.cancel();
    if (recognitionRef.current) recognitionRef.current.stop();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    navigate("/");
  };

  const isListening = state === STATE.LISTENING;
  const isError = state === STATE.ERROR;

  return (
    <div style={styles.root}>

      {/* Video grid */}
      <div style={styles.grid}>

        {/* AI tile */}
        <div style={styles.tile}>
          <div style={{
            ...styles.aiAvatar,
            boxShadow: isSpeaking
              ? "0 0 0 3px #fff, 0 0 40px rgba(255,255,255,0.2)"
              : "0 0 0 1px rgba(255,255,255,0.1)"
          }}>
            <svg
              width="52" height="52" viewBox="0 0 24 24"
              fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"
              style={{ animation: isSpeaking ? "pulse 1.2s ease-in-out infinite" : "none" }}
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>

          {subtitleText && (
            <div style={styles.subtitle}>
              <p style={styles.subtitleText}>"{subtitleText}"</p>
            </div>
          )}

          <div style={styles.tileName}>AI Interviewer · Alex</div>
          <div style={styles.tileStatus}>{statusText}</div>
        </div>

        {/* User tile */}
        <div style={{
          ...styles.tile,
          outline: isListening ? "3px solid #22c55e" : isError ? "3px solid #ef4444" : "none",
          outlineOffset: "-3px",
        }}>
          {camOn ? (
            <video ref={videoRef} autoPlay muted playsInline style={styles.video} />
          ) : (
            <div style={styles.camOff}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          )}
          <div style={styles.tileName}>You</div>
          {isListening && (
            <div style={styles.listeningBadge}>
              <span style={styles.micDot} />
              Listening
            </div>
          )}
          {transcript && (
            <div style={styles.userSubtitle}>
              <p style={styles.subtitleText}>{truncate(transcript, 100)}</p>
            </div>
          )}
        </div>

      </div>

      {/* Error banner */}
      {errorMsg && (
        <div style={styles.errorBanner}>
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
          {isError && (
            <button style={styles.errorBtn} onClick={() => navigate("/")}>
              Start New Interview
            </button>
          )}
        </div>
      )}

      {/* Progress dots */}
      <div style={styles.progress}>
        {Array.from({ length: totalQuestions }).map((_, i) => (
          <div key={i} style={{
            ...styles.progressDot,
            background: i < currentQuestion - 1
              ? "#22c55e"
              : i === currentQuestion - 1
                ? "#fff"
                : "rgba(255,255,255,0.2)"
          }} />
        ))}
        <span style={styles.progressLabel}>Question {currentQuestion} of {totalQuestions}</span>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <button style={styles.ctrlBtn} onClick={toggleCam}>
          {camOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        {isListening ? (
          <button style={{ ...styles.ctrlBtn, ...styles.submitBtn }} onClick={stopAndSubmit}>
            <MicOff size={20} />
            <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 600 }}>Done Speaking</span>
          </button>
        ) : (
          <button style={{ ...styles.ctrlBtn, opacity: 0.4, cursor: "not-allowed" }} disabled>
            <Mic size={20} />
            <span style={{ marginLeft: 8, fontSize: 13 }}>
              {state === STATE.SPEAKING ? "Alex is speaking..." :
               state === STATE.PROCESSING ? "Processing..." :
               state === STATE.ERROR ? "Session expired" : "Please wait..."}
            </span>
          </button>
        )}

        <button style={{ ...styles.ctrlBtn, ...styles.endBtn }} onClick={handleEndCall}>
          <PhoneOff size={20} />
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  root: {
    height: "100vh",
    background: "#111",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 20px 16px",
    fontFamily: "system-ui, sans-serif",
    color: "#fff",
    overflow: "hidden",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    width: "100%",
    maxWidth: 920,
    flex: 1,
    maxHeight: "calc(100vh - 160px)",
  },
  tile: {
    position: "relative",
    background: "#1e1e1e",
    borderRadius: 14,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
  },
  aiAvatar: {
    width: 110,
    height: 110,
    borderRadius: "50%",
    background: "#2a2a2a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "box-shadow 0.3s ease",
  },
  camOff: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: "scaleX(-1)",
    borderRadius: 14,
  },
  tileName: {
    position: "absolute",
    bottom: 12,
    left: 12,
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.8)",
    background: "rgba(0,0,0,0.55)",
    padding: "3px 10px",
    borderRadius: 20,
  },
  tileStatus: {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    background: "rgba(0,0,0,0.5)",
    padding: "3px 12px",
    borderRadius: 20,
    whiteSpace: "nowrap",
  },
  subtitle: {
    position: "absolute",
    bottom: 44,
    left: 12,
    right: 12,
    background: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    padding: "8px 12px",
  },
  userSubtitle: {
    position: "absolute",
    bottom: 44,
    left: 12,
    right: 12,
    background: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    padding: "8px 12px",
  },
  subtitleText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 1.5,
    margin: 0,
  },
  listeningBadge: {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    color: "#22c55e",
    background: "rgba(0,0,0,0.6)",
    padding: "3px 12px",
    borderRadius: 20,
    whiteSpace: "nowrap",
  },
  micDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#22c55e",
    display: "inline-block",
    animation: "pulse 1s infinite",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 12,
    color: "#f87171",
    maxWidth: 920,
    width: "100%",
  },
  errorBtn: {
    marginLeft: "auto",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "4px 12px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  },
  progress: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: "8px 0",
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    transition: "background 0.3s ease",
  },
  progressLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    marginLeft: 4,
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  ctrlBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 20px",
    borderRadius: 50,
    border: "none",
    cursor: "pointer",
    background: "rgba(255,255,255,0.1)",
    color: "#fff",
    transition: "all 0.2s ease",
  },
  submitBtn: {
    background: "#fff",
    color: "#000",
    padding: "12px 28px",
  },
  endBtn: {
    background: "rgba(220,38,38,0.2)",
    color: "#f87171",
    border: "1px solid rgba(220,38,38,0.3)",
  },
};