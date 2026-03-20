# DevPrep India

AI-powered mock interviews for Indian developers and founders. Hop in, practice, get real feedback. No signup, no payment, instant start.

![Live](https://img.shields.io/badge/Live-devprepindia-emerald) ![Built with](https://img.shields.io/badge/Built%20with-React%20%2B%20FastAPI-blue) ![AI](https://img.shields.io/badge/AI-Groq%20%2B%20Llama%203.3-orange)

---

## What it does

DevPrep India runs a real voice interview with an AI interviewer. It asks questions out loud, listens to your spoken answers, responds conversationally, and gives you a score and detailed feedback at the end.

Six interview modes:

| Mode | What it covers |
|---|---|
| **Technical** | Core concepts, debugging, architecture, frameworks |
| **DSA** | Data structures, algorithms, complexity — explained verbally |
| **System Design** | Real-world systems at Indian startup scale |
| **HR Round** | Culture fit, salary, career goals, notice period |
| **Behavioral** | STAR-format situational questions |
| **Investor Pitch** | Practice your startup pitch with an AI VC |

---

## Tech Stack

**Frontend:** React, Tailwind CSS, shadcn/ui, Web Speech API  
**Backend:** Python, FastAPI  
**AI:** Groq API (llama-3.3-70b-versatile)  
**Voice:** Browser TTS (Web Speech Synthesis)  
**Analytics:** PostHog  
**Deploy:** Vercel (frontend) + Render (backend)

---

## Running locally

### Prerequisites

- Node.js 18+
- Python 3.9+
- Groq API key — free at [console.groq.com](https://console.groq.com)

### Backend

```bash
cd backend
pip3 install -r requirements.txt
echo "GROQ_API_KEY=your_key_here" > .env
python3 -m uvicorn server:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env
npm start
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** Voice features work best on Safari. Chrome requires a user interaction before speech synthesis activates.

---

## How it works

```
User speaks answer
      ↓
Web Speech API transcribes to text
      ↓
FastAPI backend sends to Groq (llama-3.3-70b)
      ↓
AI generates conversational response + next question + score
      ↓
Browser TTS speaks the response out loud
      ↓
Repeat for 5-6 questions
      ↓
Results page with score breakdown, feedback, and shareable score card
```

Sessions are persisted to disk so they survive server restarts.

---

## Project structure

```
devprep/
├── backend/
│   ├── server.py          # FastAPI — sessions, Groq integration, all routes
│   ├── requirements.txt
│   ├── sessions.json      # Auto-generated, not committed
│   └── .env               # GROQ_API_KEY
└── frontend/
    ├── public/
    │   └── index.html     # PostHog analytics
    ├── src/
    │   └── pages/
    │       ├── LandingPage.jsx    # Mode, role, experience selection
    │       ├── InterviewPage.jsx  # Google Meet style interview UI
    │       └── ResultsPage.jsx    # Score, feedback, share card
    └── .env               # REACT_APP_BACKEND_URL
```

---

## License

MIT