# DevPrep India

AI-powered mock interview tool for Indian developers. Practice technical interviews with real questions tailored to your role and experience level, and get instant feedback.

![DevPrep India](https://img.shields.io/badge/Built%20with-React%20%2B%20FastAPI-emerald)

## Features

- Pick your role: Frontend, Backend, or Full Stack
- Pick your experience level: Fresher, 1-3 years, or 3+ years
- 5-question AI-powered interview session
- Real-time feedback after each answer with a score out of 10
- Final results screen with overall score and detailed breakdown
- No login required, no database needed

## Tech Stack

**Frontend:** React, Tailwind CSS, shadcn/ui  
**Backend:** Python, FastAPI  
**AI:** Groq API (llama-3.3-70b-versatile)

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- Groq API key (free at [console.groq.com](https://console.groq.com))

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
echo "GROQ_API_KEY=your_groq_api_key_here" > .env

# Start the server
uvicorn server:app --reload --port 8001
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env

# Start the app
npm start
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## Project Structure

```
devprep/
├── backend/
│   ├── server.py          # FastAPI backend with Groq integration
│   ├── requirements.txt   # Python dependencies
│   └── .env               # GROQ_API_KEY (not committed)
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── LandingPage.jsx    # Role and experience selection
    │   │   ├── InterviewPage.jsx  # Chat-style interview interface
    │   │   └── ResultsPage.jsx    # Score and feedback breakdown
    │   └── components/ui/        # shadcn/ui components
    └── .env                      # REACT_APP_BACKEND_URL (not committed)
```

## How It Works

1. User selects their role and experience level on the landing page
2. Backend calls Groq API to generate the first question
3. User types their answer in the chat interface
4. Backend evaluates the answer and generates the next question
5. After 5 questions, user is redirected to the results page
6. Results show overall score, per-question feedback, and an AI-generated summary

## License

MIT