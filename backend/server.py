import re
from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from groq import Groq

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

sessions = {}
groq_client = Groq(api_key=os.environ.get('GROQ_API_KEY'))

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ─── Models ───────────────────────────────────────────────────────────────────

class StartInterviewRequest(BaseModel):
    role: str
    experience: str
    mode: str

class StartInterviewResponse(BaseModel):
    session_id: str
    role: str
    experience: str
    mode: str
    first_question: str

class AnswerRequest(BaseModel):
    session_id: str
    answer: str

class AnswerResponse(BaseModel):
    conversational_response: str
    next_question: Optional[str] = None
    is_complete: bool
    current_question_number: int
    total_questions: int
    score: int

class ResultsResponse(BaseModel):
    session_id: str
    role: str
    experience: str
    mode: str
    overall_score: int
    questions: List[dict]
    summary: str

# ─── Mode configs ─────────────────────────────────────────────────────────────

MODE_CONFIG = {
    "technical": {
        "label": "Technical",
        "description": "Core technical concepts, frameworks, and practical coding knowledge",
        "question_focus": "Ask about technical concepts, debugging, architecture decisions, and practical implementation knowledge relevant to their role",
        "total_questions": 5,
    },
    "dsa": {
        "label": "DSA",
        "description": "Data structures, algorithms, and problem-solving",
        "question_focus": "Ask about data structures (arrays, linked lists, trees, graphs, hashmaps), algorithms (sorting, searching, dynamic programming), time/space complexity, and problem-solving approaches. Ask them to explain their approach verbally.",
        "total_questions": 5,
    },
    "system_design": {
        "label": "System Design",
        "description": "Designing scalable systems and architecture",
        "question_focus": "Ask about designing real-world systems (URL shortener, chat app, ride sharing, etc.), scalability, databases, caching, load balancing, microservices.",
        "total_questions": 4,
    },
    "hr": {
        "label": "HR Round",
        "description": "HR and culture fit questions",
        "question_focus": "Ask standard HR questions: why do you want to join, where do you see yourself in 5 years, salary expectations, notice period, strengths and weaknesses.",
        "total_questions": 5,
    },
    "behavioral": {
        "label": "Behavioral",
        "description": "Situation-based behavioral questions",
        "question_focus": "Ask STAR-format behavioral questions about conflict, failure, pressure, leadership, and learning quickly.",
        "total_questions": 5,
    },
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def clean_response(text: str) -> str:
    """Remove any leaked format tags from AI response."""
    text = re.sub(r'NEXT_QUESTION:.*', '', text, flags=re.DOTALL)
    text = re.sub(r'SCORE:\s*\d+.*', '', text, flags=re.DOTALL)
    text = re.sub(r'\bDONE\b.*', '', text, flags=re.DOTALL)
    text = re.sub(r'RESPONSE:', '', text)
    return text.strip()

def clean_question(text: str) -> str:
    """Remove any leaked format tags from question."""
    text = re.sub(r'SCORE:\s*\d+.*', '', text, flags=re.DOTALL)
    text = re.sub(r'RESPONSE:.*', '', text, flags=re.DOTALL)
    text = re.sub(r'\bDONE\b.*', '', text, flags=re.DOTALL)
    return text.strip()

def get_system_prompt(role: str, experience: str, mode: str) -> str:
    config = MODE_CONFIG.get(mode, MODE_CONFIG["technical"])
    return f"""You are Alex, a friendly but rigorous interviewer conducting a {config['label']} interview for a {role} developer with {experience} experience.

This round focuses on: {config['description']}

Your personality:
- Warm and professional, like a real interviewer
- You acknowledge good answers genuinely and specifically
- You gently push back on vague or incomplete answers
- You speak naturally and conversationally

Question focus: {config['question_focus']}"""

def get_first_question_prompt(role: str, experience: str, mode: str) -> str:
    config = MODE_CONFIG.get(mode, MODE_CONFIG["technical"])
    return f"""Start a {config['label']} interview for a {role} developer ({experience} level).

Give a brief warm welcome then ask your first question.

Format:
INTRO: [one warm sentence welcoming them]
QUESTION: [your first question]"""

def get_conversational_response_prompt(
    role: str, experience: str, mode: str,
    question: str, answer: str,
    question_number: int, total: int,
    previous_qa: List[dict]
) -> str:
    config = MODE_CONFIG.get(mode, MODE_CONFIG["technical"])
    history = ""
    if previous_qa:
        history = "\nPrevious Q&A:\n"
        for qa in previous_qa:
            history += f"Q: {qa['question']}\nA: {qa['answer']}\n\n"

    is_last = question_number >= total

    return f"""You are Alex conducting a {config['label']} interview for a {role} developer ({experience} level).
{history}
Current question: {question}
Candidate's answer: {answer}

{"This is the LAST question. After responding, wrap up warmly." if is_last else f"This is question {question_number} of {total}."}

RESPONSE: [2-3 sentences acknowledging their answer specifically. Reference what they said. If good, say what you liked. If incomplete, gently note what was missing.]

{"DONE" if is_last else f"NEXT_QUESTION: [Ask a new {config['label']} question on a different topic]"}

SCORE: [1-10]"""

def get_summary_prompt(role: str, experience: str, mode: str, qa_list: List[dict], overall_score: int) -> str:
    config = MODE_CONFIG.get(mode, MODE_CONFIG["technical"])
    qa_text = "\n".join([
        f"Q{i+1}: {q['question']}\nAnswer: {q['answer']}\nScore: {q['score']}/10"
        for i, q in enumerate(qa_list) if q.get('answer')
    ])
    return f"""You interviewed a {role} developer ({experience} level) for a {config['label']} round.

{qa_text}

Overall Score: {overall_score}/10

Write a 3-4 sentence honest summary: what they did well, what needs improvement, and one specific recommendation."""

# ─── Routes ───────────────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "DevPrep India API"}

@api_router.post("/interview/start", response_model=StartInterviewResponse)
async def start_interview(request: StartInterviewRequest):
    session_id = str(uuid.uuid4())
    config = MODE_CONFIG.get(request.mode, MODE_CONFIG["technical"])

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": get_system_prompt(request.role, request.experience, request.mode)},
                {"role": "user", "content": get_first_question_prompt(request.role, request.experience, request.mode)}
            ],
            temperature=0.7,
            max_tokens=400
        )
        raw = completion.choices[0].message.content.strip()

        intro = ""
        first_question = raw
        if "INTRO:" in raw and "QUESTION:" in raw:
            intro = raw.split("QUESTION:")[0].replace("INTRO:", "").strip()
            first_question = raw.split("QUESTION:")[-1].strip()
        elif "QUESTION:" in raw:
            first_question = raw.split("QUESTION:")[-1].strip()

        first_question = clean_question(first_question)
        full_opening = f"{intro} {first_question}".strip() if intro else first_question

    except Exception as e:
        logging.error(f"Groq error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate question")

    sessions[session_id] = {
        "session_id": session_id,
        "role": request.role,
        "experience": request.experience,
        "mode": request.mode,
        "questions": [{"question": first_question, "answer": None, "feedback": None, "score": None}],
        "current_question": 1,
        "total_questions": config["total_questions"],
        "is_complete": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    return StartInterviewResponse(
        session_id=session_id,
        role=request.role,
        experience=request.experience,
        mode=request.mode,
        first_question=full_opening
    )

@api_router.post("/interview/answer", response_model=AnswerResponse)
async def submit_answer(request: AnswerRequest):
    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["is_complete"]:
        raise HTTPException(status_code=400, detail="Interview already complete")

    current_q_index = session["current_question"] - 1
    current_question = session["questions"][current_q_index]["question"]
    previous_qa = [q for q in session["questions"][:current_q_index] if q.get("answer")]

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": get_system_prompt(session["role"], session["experience"], session["mode"])},
                {"role": "user", "content": get_conversational_response_prompt(
                    session["role"], session["experience"], session["mode"],
                    current_question, request.answer,
                    session["current_question"], session["total_questions"],
                    previous_qa
                )}
            ],
            temperature=0.7,
            max_tokens=400
        )
        raw = completion.choices[0].message.content.strip()

        conversational_response = ""
        next_question = None
        score = 5

        if "RESPONSE:" in raw:
            after = raw.split("RESPONSE:")[1]
            if "NEXT_QUESTION:" in after:
                parts = after.split("NEXT_QUESTION:")
                conversational_response = clean_response(parts[0])
                rest = parts[1]
                if "SCORE:" in rest:
                    q_parts = rest.split("SCORE:")
                    next_question = clean_question(q_parts[0])
                    try:
                        score = int(re.search(r'\d+', q_parts[1]).group())
                    except:
                        score = 5
                else:
                    next_question = clean_question(rest)
            elif "DONE" in after:
                if "SCORE:" in after:
                    parts = after.split("SCORE:")
                    conversational_response = clean_response(parts[0])
                    try:
                        score = int(re.search(r'\d+', parts[1]).group())
                    except:
                        score = 5
                else:
                    conversational_response = clean_response(after)
            else:
                conversational_response = clean_response(after)
        else:
            conversational_response = clean_response(raw)

        if not conversational_response:
            conversational_response = "Thanks for that answer. Let's continue."

    except Exception as e:
        logging.error(f"Groq error: {e}")
        conversational_response = "Thanks for that answer."
        next_question = None
        score = 5

    session["questions"][current_q_index]["answer"] = request.answer
    session["questions"][current_q_index]["feedback"] = conversational_response
    session["questions"][current_q_index]["score"] = score

    is_complete = session["current_question"] >= session["total_questions"]

    if not is_complete and next_question:
        session["questions"].append({
            "question": next_question,
            "answer": None,
            "feedback": None,
            "score": None
        })

    session["current_question"] += 1
    session["is_complete"] = is_complete

    return AnswerResponse(
        conversational_response=conversational_response,
        next_question=next_question if not is_complete else None,
        is_complete=is_complete,
        current_question_number=session["current_question"],
        total_questions=session["total_questions"],
        score=score
    )

@api_router.get("/interview/results/{session_id}", response_model=ResultsResponse)
async def get_results(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    scores = [q["score"] for q in session["questions"] if q.get("score") is not None]
    overall_score = round(sum(scores) / len(scores)) if scores else 0

    try:
        summary = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a career coach giving honest interview feedback."},
                {"role": "user", "content": get_summary_prompt(
                    session["role"], session["experience"], session["mode"],
                    session["questions"], overall_score
                )}
            ],
            temperature=0.6,
            max_tokens=220
        ).choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Groq error: {e}")
        summary = f"You scored {overall_score}/10. Keep practicing!"

    return ResultsResponse(
        session_id=session_id,
        role=session["role"],
        experience=session["experience"],
        mode=session.get("mode", "technical"),
        overall_score=overall_score,
        questions=session["questions"],
        summary=summary
    )

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)