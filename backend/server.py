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

class StartInterviewRequest(BaseModel):
    role: str
    experience: str

class StartInterviewResponse(BaseModel):
    session_id: str
    role: str
    experience: str
    first_question: str

class AnswerRequest(BaseModel):
    session_id: str
    answer: str

class AnswerResponse(BaseModel):
    conversational_response: str  # what AI says in response to answer
    next_question: Optional[str] = None
    is_complete: bool
    current_question_number: int
    total_questions: int
    score: int

class ResultsResponse(BaseModel):
    session_id: str
    role: str
    experience: str
    overall_score: int
    questions: List[dict]
    summary: str

def get_system_prompt(role: str, experience: str) -> str:
    return f"""You are Alex, a friendly but rigorous technical interviewer at a top Indian tech company. You are interviewing a {role} developer with {experience} experience.

Your personality:
- Warm and professional, like a real interviewer
- You acknowledge good answers genuinely
- You gently push back on incomplete answers
- You make the candidate feel comfortable but challenged
- You speak naturally, not like a robot

Your job:
- Ask relevant technical questions for {role} development at {experience} level
- Respond conversationally to answers before moving on
- Give a score out of 10 mentally for each answer"""

def get_first_question_prompt(role: str, experience: str) -> str:
    return f"""Start the interview with a warm intro and your first technical question.

Format exactly like this:
QUESTION: [your first technical question for a {role} developer at {experience} level]

Just the question, no intro text before QUESTION:"""

def get_conversational_response_prompt(
    role: str,
    experience: str,
    question: str,
    answer: str,
    question_number: int,
    total: int,
    previous_qa: List[dict]
) -> str:
    history = ""
    if previous_qa:
        history = "\nPrevious Q&A:\n"
        for qa in previous_qa:
            history += f"Q: {qa['question']}\nA: {qa['answer']}\n\n"

    is_last = question_number >= total

    return f"""You are Alex, interviewing a {role} developer ({experience} level). 
{history}
Current question: {question}
Candidate's answer: {answer}

{"This is the LAST question. After responding, wrap up the interview warmly." if is_last else f"This is question {question_number} of {total}."}

Respond naturally like a real interviewer. Your response must have two parts:

RESPONSE: [2-3 sentences acknowledging their answer. Be specific about what they said. If good, say what you liked. If incomplete or wrong, gently point out what was missing. Sound human and conversational.]

{"DONE" if is_last else "NEXT_QUESTION: [Ask a different technical question on a new topic, appropriate for " + role + " at " + experience + " level. Just the question itself.]"}

SCORE: [number 1-10 based on their answer quality]"""

def get_summary_prompt(role: str, experience: str, qa_list: List[dict], overall_score: int) -> str:
    qa_text = "\n".join([
        f"Q{i+1}: {q['question']}\nAnswer: {q['answer']}\nScore: {q['score']}/10"
        for i, q in enumerate(qa_list) if q.get('answer')
    ])
    return f"""You interviewed a {role} developer ({experience} level). Here's the full interview:

{qa_text}

Overall Score: {overall_score}/10

Write a 3-4 sentence honest summary: what they did well, what needs improvement, and one specific recommendation for their preparation. Be direct but encouraging."""

@api_router.get("/")
async def root():
    return {"message": "DevPrep India API"}

@api_router.post("/interview/start", response_model=StartInterviewResponse)
async def start_interview(request: StartInterviewRequest):
    session_id = str(uuid.uuid4())

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": get_system_prompt(request.role, request.experience)},
                {"role": "user", "content": get_first_question_prompt(request.role, request.experience)}
            ],
            temperature=0.7,
            max_tokens=300
        )
        raw = completion.choices[0].message.content.strip()

        # extract question
        first_question = raw
        if "QUESTION:" in raw:
            first_question = raw.split("QUESTION:")[-1].strip()

    except Exception as e:
        logging.error(f"Groq error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate question")

    sessions[session_id] = {
        "session_id": session_id,
        "role": request.role,
        "experience": request.experience,
        "questions": [{"question": first_question, "answer": None, "feedback": None, "score": None}],
        "current_question": 1,
        "total_questions": 5,
        "is_complete": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    return StartInterviewResponse(
        session_id=session_id,
        role=request.role,
        experience=request.experience,
        first_question=first_question
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
                {"role": "system", "content": get_system_prompt(session["role"], session["experience"])},
                {"role": "user", "content": get_conversational_response_prompt(
                    session["role"],
                    session["experience"],
                    current_question,
                    request.answer,
                    session["current_question"],
                    session["total_questions"],
                    previous_qa
                )}
            ],
            temperature=0.7,
            max_tokens=400
        )
        raw = completion.choices[0].message.content.strip()

        # parse response
        conversational_response = ""
        next_question = None
        score = 5

        if "RESPONSE:" in raw:
            parts = raw.split("RESPONSE:")
            after_response = parts[1]

            if "NEXT_QUESTION:" in after_response:
                resp_parts = after_response.split("NEXT_QUESTION:")
                conversational_response = resp_parts[0].strip()
                rest = resp_parts[1]
                if "SCORE:" in rest:
                    q_parts = rest.split("SCORE:")
                    next_question = q_parts[0].strip()
                    try:
                        score = int(q_parts[1].strip().split()[0])
                    except:
                        score = 5
                else:
                    next_question = rest.strip()
            elif "DONE" in after_response:
                if "SCORE:" in after_response:
                    resp_parts = after_response.split("SCORE:")
                    conversational_response = resp_parts[0].replace("DONE", "").strip()
                    try:
                        score = int(resp_parts[1].strip().split()[0])
                    except:
                        score = 5
                else:
                    conversational_response = after_response.replace("DONE", "").strip()
            else:
                conversational_response = after_response.strip()
        else:
            conversational_response = raw

        if not conversational_response:
            conversational_response = "Thanks for that answer. Let me ask you the next question."

    except Exception as e:
        logging.error(f"Groq error: {e}")
        conversational_response = "Thanks for that answer."
        next_question = None
        score = 5

    # update session
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
                {"role": "system", "content": "You are a career coach."},
                {"role": "user", "content": get_summary_prompt(
                    session["role"],
                    session["experience"],
                    session["questions"],
                    overall_score
                )}
            ],
            temperature=0.6,
            max_tokens=200
        ).choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Groq error: {e}")
        summary = f"You scored {overall_score}/10 overall. Keep practicing!"

    return ResultsResponse(
        session_id=session_id,
        role=session["role"],
        experience=session["experience"],
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