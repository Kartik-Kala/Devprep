import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import LandingPage from "@/pages/LandingPage";
import InterviewPage from "@/pages/InterviewPage";
import ResultsPage from "@/pages/ResultsPage";
import AuthPage from "@/pages/AuthPage";

function App() {
  return (
    <AuthProvider>
      <div className="App min-h-screen bg-slate-950">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/interview/:sessionId" element={<InterviewPage />} />
            <Route path="/results/:sessionId" element={<ResultsPage />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </div>
    </AuthProvider>
  );
}

export default App;