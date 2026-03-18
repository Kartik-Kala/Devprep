from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from groq import Groq

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Groq client
groq_client = Groq(api_key=os.environ.get('GROQ_API_KEY'))

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class StartInterviewRequest(BaseModel):
    role: str  # Frontend, Backend, Full Stack
    experience: str  # Fresher, 1-3 years, 3+ years

class StartInterviewResponse(BaseModel):
    session_id: str
    role: str
    experience: str
    first_question: str

class AnswerRequest(BaseModel):
    session_id: str
    answer: str

class AnswerResponse(BaseModel):
    feedback: str
    next_question: Optional[str] = None
    is_complete: bool
    current_question_number: int
    total_questions: int

class ResultsResponse(BaseModel):
    session_id: str
    role: str
    experience: str
    overall_score: int
    questions: List[dict]
    summary: str

# Helper functions
def get_system_prompt(role: str, experience: str) -> str:
    return f"""You are an expert technical interviewer for Indian software companies. You are conducting a mock interview for a {role} developer with {experience} experience level.

Your responsibilities:
1. Ask relevant technical questions appropriate for the role and experience level
2. Evaluate answers fairly and provide constructive feedback
3. Be encouraging but honest about areas for improvement
4. Focus on practical knowledge that Indian tech companies look for

For {experience} level:
- Fresher: Focus on fundamentals, basic concepts, and problem-solving approach
- 1-3 years: Include practical scenarios, debugging skills, and some system design basics
- 3+ years: Deep technical questions, architecture decisions, leadership scenarios

Keep questions concise and clear. Evaluate based on accuracy, clarity, and depth of understanding."""

def get_question_prompt(role: str, experience: str, question_number: int, previous_qa: List[dict]) -> str:
    context = ""
    if previous_qa:
        context = "\n\nPrevious questions and answers in this interview:\n"
        for qa in previous_qa:
            context += f"Q: {qa['question']}\nA: {qa['answer']}\n\n"
    
    return f"""Generate question #{question_number} for a {role} developer interview ({experience} level).
{context}
Rules:
- Ask a different topic than previous questions
- Make it relevant to {role} development
- Appropriate difficulty for {experience}
- Just provide the question, no preamble

Question:"""

def get_evaluation_prompt(question: str, answer: str, role: str, experience: str) -> str:
    return f"""Evaluate this interview answer for a {role} developer position ({experience} level).

Question: {question}

Candidate's Answer: {answer}

Provide a brief evaluation (2-3 sentences) covering:
1. What was good about the answer
2. What could be improved
3. A score from 1-10

Format your response as:
Feedback: [your feedback]
Score: [number 1-10]"""

# Routes
@api_router.get("/")
async def root():
    return {"message": "DevPrep India API"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks

@api_router.post("/interview/start", response_model=StartInterviewResponse)
async def start_interview(request: StartInterviewRequest):
    session_id = str(uuid.uuid4())
    
    # Generate first question using Groq
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": get_system_prompt(request.role, request.experience)},
                {"role": "user", "content": get_question_prompt(request.role, request.experience, 1, [])}
            ],
            temperature=0.7,
            max_tokens=500
        )
        first_question = completion.choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Groq API error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate question")
    
    # Store session in database
    session_doc = {
        "session_id": session_id,
        "role": request.role,
        "experience": request.experience,
        "questions": [{"question": first_question, "answer": None, "feedback": None, "score": None}],
        "current_question": 1,
        "total_questions": 5,
        "is_complete": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.interview_sessions.insert_one(session_doc)
    
    return StartInterviewResponse(
        session_id=session_id,
        role=request.role,
        experience=request.experience,
        first_question=first_question
    )

@api_router.post("/interview/answer", response_model=AnswerResponse)
async def submit_answer(request: AnswerRequest):
    # Get session from database
    session = await db.interview_sessions.find_one(
        {"session_id": request.session_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["is_complete"]:
        raise HTTPException(status_code=400, detail="Interview already complete")
    
    current_q_index = session["current_question"] - 1
    current_question = session["questions"][current_q_index]["question"]
    
    # Evaluate answer using Groq
    try:
        eval_completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": get_system_prompt(session["role"], session["experience"])},
                {"role": "user", "content": get_evaluation_prompt(current_question, request.answer, session["role"], session["experience"])}
            ],
            temperature=0.5,
            max_tokens=300
        )
        eval_response = eval_completion.choices[0].message.content.strip()
        
        # Parse feedback and score
        feedback = eval_response
        score = 5  # default
        if "Score:" in eval_response:
            parts = eval_response.split("Score:")
            feedback = parts[0].replace("Feedback:", "").strip()
            try:
                score = int(parts[1].strip().split()[0])
            except:
                score = 5
    except Exception as e:
        logging.error(f"Groq API error: {e}")
        feedback = "Unable to evaluate answer at this time."
        score = 5
    
    # Update current question with answer and feedback
    session["questions"][current_q_index]["answer"] = request.answer
    session["questions"][current_q_index]["feedback"] = feedback
    session["questions"][current_q_index]["score"] = score
    
    next_question = None
    is_complete = session["current_question"] >= session["total_questions"]
    
    if not is_complete:
        # Generate next question
        try:
            previous_qa = [q for q in session["questions"] if q["answer"] is not None]
            completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": get_system_prompt(session["role"], session["experience"])},
                    {"role": "user", "content": get_question_prompt(
                        session["role"], 
                        session["experience"], 
                        session["current_question"] + 1,
                        previous_qa
                    )}
                ],
                temperature=0.7,
                max_tokens=500
            )
            next_question = completion.choices[0].message.content.strip()
            session["questions"].append({"question": next_question, "answer": None, "feedback": None, "score": None})
        except Exception as e:
            logging.error(f"Groq API error: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate next question")
    
    # Update session
    session["current_question"] += 1
    session["is_complete"] = is_complete
    
    await db.interview_sessions.update_one(
        {"session_id": request.session_id},
        {"$set": {
            "questions": session["questions"],
            "current_question": session["current_question"],
            "is_complete": is_complete
        }}
    )
    
    return AnswerResponse(
        feedback=feedback,
        next_question=next_question,
        is_complete=is_complete,
        current_question_number=session["current_question"],
        total_questions=session["total_questions"]
    )

@api_router.get("/interview/results/{session_id}", response_model=ResultsResponse)
async def get_results(session_id: str):
    session = await db.interview_sessions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Calculate overall score
    scores = [q["score"] for q in session["questions"] if q["score"] is not None]
    overall_score = round(sum(scores) / len(scores)) if scores else 0
    
    # Generate summary using Groq
    try:
        qa_summary = "\n".join([
            f"Q{i+1}: {q['question']}\nAnswer: {q['answer']}\nScore: {q['score']}/10"
            for i, q in enumerate(session["questions"]) if q["answer"]
        ])
        
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a career coach providing interview feedback."},
                {"role": "user", "content": f"""Based on this {session['role']} developer interview ({session['experience']} level), provide a brief 2-3 sentence overall summary and recommendation for the candidate.

{qa_summary}

Overall Score: {overall_score}/10

Summary:"""}
            ],
            temperature=0.6,
            max_tokens=200
        )
        summary = completion.choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Groq API error: {e}")
        summary = f"You scored {overall_score}/10 overall. Keep practicing to improve your interview skills!"
    
    return ResultsResponse(
        session_id=session_id,
        role=session["role"],
        experience=session["experience"],
        overall_score=overall_score,
        questions=session["questions"],
        summary=summary
    )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
