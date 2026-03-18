import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { SendHorizontal, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function InterviewPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [totalQuestions] = useState(5);
  const [isComplete, setIsComplete] = useState(false);

  const role = location.state?.role || "Developer";
  const experience = location.state?.experience || "Fresher";

  useEffect(() => {
    // Initialize with first question from navigation state
    if (location.state?.firstQuestion) {
      setMessages([
        {
          type: "question",
          content: location.state.firstQuestion,
          questionNumber: 1,
        },
      ]);
    }
  }, [location.state]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) {
      toast.error("Please enter your answer");
      return;
    }

    setIsSubmitting(true);
    
    // Add user answer to messages
    setMessages((prev) => [
      ...prev,
      { type: "answer", content: answer.trim() },
    ]);
    setAnswer("");

    try {
      const response = await axios.post(`${API}/interview/answer`, {
        session_id: sessionId,
        answer: answer.trim(),
      });

      // Add feedback
      setMessages((prev) => [
        ...prev,
        { type: "feedback", content: response.data.feedback },
      ]);

      if (response.data.is_complete) {
        setIsComplete(true);
        setTimeout(() => {
          navigate(`/results/${sessionId}`);
        }, 2000);
      } else {
        // Add next question
        setCurrentQuestion(response.data.current_question_number);
        setMessages((prev) => [
          ...prev,
          {
            type: "question",
            content: response.data.next_question,
            questionNumber: response.data.current_question_number,
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to submit answer:", error);
      toast.error("Failed to submit answer. Please try again.");
      // Remove the last added answer since it failed
      setMessages((prev) => prev.slice(0, -1));
      setAnswer(answer.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  const handleEndSession = () => {
    navigate("/");
  };

  return (
    <div data-testid="interview-page" className="h-screen flex flex-col max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-slate-800">
        <div>
          <p className="font-mono text-sm text-emerald-500">{role} Developer</p>
          <p className="text-xs text-slate-500">{experience}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">
            Question {currentQuestion}/{totalQuestions}
          </span>
          <Button
            data-testid="end-session-btn"
            variant="ghost"
            onClick={handleEndSession}
            className="btn-ghost"
          >
            <LogOut className="w-4 h-4 mr-2" />
            End Session
          </Button>
        </div>
      </header>

      {/* Chat Area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4" data-testid="chat-area">
        <div className="space-y-4 pb-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`animate-slide-up ${
                message.type === "answer" ? "flex justify-end" : ""
              }`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {message.type === "question" && (
                <div className="chat-bubble-ai" data-testid={`question-${message.questionNumber}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                      Q{message.questionNumber}
                    </span>
                  </div>
                  <p className="text-slate-200 whitespace-pre-wrap">{message.content}</p>
                </div>
              )}
              {message.type === "answer" && (
                <div className="chat-bubble-user" data-testid={`answer-${index}`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              )}
              {message.type === "feedback" && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 max-w-[85%]" data-testid={`feedback-${index}`}>
                  <p className="text-xs font-mono text-slate-400 mb-2">Feedback</p>
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              )}
            </div>
          ))}

          {isSubmitting && (
            <div className="chat-bubble-ai animate-fade-in">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          {isComplete && (
            <div className="text-center py-8 animate-fade-in">
              <p className="text-emerald-400 font-mono text-lg mb-2">Interview Complete!</p>
              <p className="text-slate-400 text-sm">Redirecting to results...</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      {!isComplete && (
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex gap-3 items-end">
            <Textarea
              ref={textareaRef}
              data-testid="answer-input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer... (Press Enter to submit, Shift+Enter for new line)"
              disabled={isSubmitting}
              className="flex-1 bg-slate-950 border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none min-h-[60px] max-h-[200px] text-slate-200 placeholder:text-slate-500"
              rows={2}
            />
            <Button
              data-testid="submit-answer-btn"
              onClick={handleSubmitAnswer}
              disabled={isSubmitting || !answer.trim()}
              className="btn-primary h-[60px] px-6"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <SendHorizontal className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
