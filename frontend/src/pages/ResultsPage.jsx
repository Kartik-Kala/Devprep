import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trophy, RefreshCcw, Home, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ResultsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [sessionId]);

  const fetchResults = async () => {
    try {
      const response = await axios.get(`${API}/interview/results/${sessionId}`);
      setResults(response.data);
    } catch (error) {
      console.error("Failed to fetch results:", error);
      toast.error("Failed to load results");
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return "text-emerald-400";
    if (score >= 6) return "text-yellow-400";
    return "text-red-400";
  };

  const getScoreLabel = (score) => {
    if (score >= 8) return "Excellent";
    if (score >= 6) return "Good";
    if (score >= 4) return "Average";
    return "Needs Improvement";
  };

  if (isLoading) {
    return (
      <div data-testid="results-loading" className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!results) {
    return (
      <div data-testid="results-error" className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-slate-400">Unable to load results</p>
        <Button onClick={() => navigate("/")} className="btn-secondary">
          Go Home
        </Button>
      </div>
    );
  }

  const scorePercentage = results.overall_score * 10;

  return (
    <main data-testid="results-page" className="min-h-screen py-12 px-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8 animate-fade-in">
        <h1 className="font-mono font-bold text-2xl sm:text-3xl text-white mb-2">
          Interview Complete
        </h1>
        <p className="text-slate-400">
          {results.role} Developer • {results.experience}
        </p>
      </div>

      {/* Score Card */}
      <div
        className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 mb-8 animate-slide-up"
        style={{ animationDelay: "0.1s" }}
        data-testid="score-card"
      >
        <div className="flex flex-col items-center">
          {/* Score Circle */}
          <div className="relative mb-6">
            <div
              className="w-36 h-36 rounded-full flex items-center justify-center"
              style={{
                background: `conic-gradient(#10b981 ${scorePercentage}%, #1e293b ${scorePercentage}%)`,
              }}
            >
              <div className="absolute w-28 h-28 rounded-full bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                  <span className={`font-mono font-bold text-4xl ${getScoreColor(results.overall_score)}`}>
                    {results.overall_score}
                  </span>
                  <span className="text-slate-400 text-lg">/10</span>
                </div>
              </div>
            </div>
          </div>

          {/* Score Label */}
          <div className="flex items-center gap-2 mb-4">
            <Trophy className={`w-5 h-5 ${getScoreColor(results.overall_score)}`} />
            <span className={`font-mono font-bold ${getScoreColor(results.overall_score)}`}>
              {getScoreLabel(results.overall_score)}
            </span>
          </div>

          {/* Summary */}
          <p className="text-slate-300 text-center max-w-md leading-relaxed" data-testid="results-summary">
            {results.summary}
          </p>
        </div>
      </div>

      {/* Questions Feedback */}
      <div
        className="mb-8 animate-slide-up"
        style={{ animationDelay: "0.2s" }}
      >
        <h2 className="font-mono font-bold text-lg text-slate-300 mb-4">
          Detailed Feedback
        </h2>
        <Accordion type="single" collapsible className="space-y-3" data-testid="feedback-accordion">
          {results.questions.map((q, index) => (
            <AccordionItem
              key={index}
              value={`question-${index}`}
              className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:bg-slate-800/50 [&[data-state=open]]:bg-slate-800/50">
                <div className="flex items-center gap-3 text-left">
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                    Q{index + 1}
                  </span>
                  <span className="text-slate-300 text-sm flex-1 line-clamp-1">
                    {q.question}
                  </span>
                  <span className={`font-mono text-sm ${getScoreColor(q.score)}`}>
                    {q.score}/10
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4 pt-2">
                  <div>
                    <p className="text-xs font-mono text-slate-500 mb-1">Your Answer</p>
                    <p className="text-slate-300 text-sm bg-slate-800/50 rounded p-3 whitespace-pre-wrap">
                      {q.answer || "No answer provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-slate-500 mb-1">Feedback</p>
                    <p className="text-slate-400 text-sm whitespace-pre-wrap">
                      {q.feedback || "No feedback available"}
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Action Buttons */}
      <div
        className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up"
        style={{ animationDelay: "0.3s" }}
      >
        <Button
          data-testid="retry-btn"
          onClick={() => navigate("/")}
          className="btn-secondary px-6 py-5"
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Try Another Interview
        </Button>
        <Button
          data-testid="home-btn"
          onClick={() => navigate("/")}
          className="btn-ghost px-6 py-5"
        >
          <Home className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
      </div>
    </main>
  );
}
