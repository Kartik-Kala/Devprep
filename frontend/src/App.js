import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import LandingPage from "@/pages/LandingPage";
import InterviewPage from "@/pages/InterviewPage";
import ResultsPage from "@/pages/ResultsPage";

function App() {
  return (
    <div className="App min-h-screen bg-slate-950">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/interview/:sessionId" element={<InterviewPage />} />
          <Route path="/results/:sessionId" element={<ResultsPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;
