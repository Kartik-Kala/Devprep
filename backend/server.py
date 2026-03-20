import re
import json
import os
from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from groq import Groq

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

groq_client = Groq(api_key=os.environ.get('GROQ_API_KEY'))

app = FastAPI()
api_router = APIRouter(prefix="/api")

SESSIONS_FILE = ROOT_DIR / "sessions.json"

def load_sessions() -> dict:
    try:
        if SESSIONS_FILE.exists():
            with open(SESSIONS_FILE, "r") as f:
                return json.load(f)
    except Exception as e:
        logging.error(f"Failed to load sessions: {e}")
    return {}

def save_sessions(sessions: dict):
    try:
        with open(SESSIONS_FILE, "w") as f:
            json.dump(sessions, f)
    except Exception as e:
        logging.error(f"Failed to save sessions: {e}")

def get_session(session_id: str) -> Optional[dict]:
    sessions = load_sessions()
    return sessions.get(session_id)

def set_session(session_id: str, data: dict):
    sessions = load_sessions()
    sessions[session_id] = data
    save_sessions(sessions)

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

MODE_CONFIG = {
    "technical": {
        "label": "Technical",
        "description": "Core technical concepts, frameworks, and practical coding knowledge",
        "question_focus": "Ask practical technical questions — debugging scenarios, architecture decisions, how specific technologies work under the hood, trade-offs between approaches. Questions should feel like things a senior engineer would actually ask, not textbook definitions.",
        "total_questions": 5,
    },
    "dsa": {
        "label": "DSA",
        "description": "Data structures, algorithms, and problem-solving",
        "question_focus": "Ask about data structures and algorithms verbally — how would you approach this problem, what data structure would you use and why, what is the time and space complexity. Cover a range: arrays, trees, graphs, hashmaps, sorting, searching, dynamic programming.",
        "total_questions": 5,
    },
    "system_design": {
        "label": "System Design",
        "description": "Designing scalable systems and architecture",
        "question_focus": "Ask to design real systems Indian developers would know — payment systems like UPI, food delivery like Zomato, ride sharing, social media feeds, URL shorteners. Focus on scale, databases, caching, APIs, failure handling.",
        "total_questions": 4,
    },
    "hr": {
        "label": "HR Round",
        "description": "HR and culture fit questions",
        "question_focus": "Ask genuine HR questions that reveal character and fit — motivation, conflict handling, career goals, salary expectations, notice period, how they work in teams. Make it feel like a real HR conversation, not a checklist.",
        "total_questions": 5,
    },
    "behavioral": {
        "label": "Behavioral",
        "description": "Situation-based behavioral questions",
        "question_focus": "Ask STAR-format behavioral questions about real situations — a time you failed, a conflict with a teammate, a time you had to learn something fast, a time you showed ownership. Push for specific examples, not generic answers.",
        "total_questions": 5,
    },
    "pitch": {
        "label": "Investor Pitch",
        "description": "Simulating a real investor meeting — VC or angel",
        "question_focus": "Ask the questions investors actually ask: what problem are you solving and why does it matter, how big is the market, why now, why are you the right team, what is your business model and unit economics, who are your competitors and why will you win, what is your traction so far, how will you use the funding. Push back hard on vague answers. Reference Indian VC context — Peak XV, Blume, Elevation, Y Combinator.",
        "total_questions": 6,
    },
}

def clean_response(text: str) -> str:
    text = re.sub(r'NEXT_QUESTION:.*', '', text, flags=re.DOTALL)
    text = re.sub(r'SCORE:\s*\d+.*', '', text, flags=re.DOTALL)
    text = re.sub(r'\bDONE\b.*', '', text, flags=re.DOTALL)
    text = re.sub(r'RESPONSE:', '', text)
    return text.strip()

def clean_question(text: str) -> str:
    text = re.sub(r'SCORE:\s*\d+.*', '', text, flags=re.DOTALL)
    text = re.sub(r'RESPONSE:.*', '', text, flags=re.DOTALL)
    text = re.sub(r'\bDONE\b.*', '', text, flags=re.DOTALL)
    return text.strip()

def get_system_prompt(role: str, experience: str, mode: str) -> str:
    config = MODE_CONFIG.get(mode, MODE_CONFIG["technical"])

    if mode == "pitch":
        return """You are Rahul, a partner at a top Indian VC fund who has evaluated thousands of pitches. You are meeting a founder for the first time in a 30-minute pitch meeting.

Your style:
- Direct and skeptical — you have heard every pitch before and your default is no
- You push hard on weak answers: "That's interesting but the market seems small — walk me through how you get to 100 crore ARR"
- You acknowledge strong answers genuinely: "That's a sharp insight, most founders miss that"
- You ask follow-up questions when answers are vague or feel rehearsed
- You think in terms of returns, market size, defensibility, team quality, and timing
- You reference the Indian startup ecosystem naturally — Zepto, CRED, Razorpay, Meesho as examples

You are evaluating: clarity of thinking, market understanding, business model viability, founder conviction, self-awareness, and traction.

Scoring — be honest:
- 1-2: Vague, unprepared, or the founder doesn't understand their own business
- 3-4: Some good points but major gaps — wouldn't pass the first filter
- 5-6: Decent answer but not compelling enough to move forward
- 7-8: Strong and clear — this founder has thought deeply about their business
- 9-10: Exceptional — this is how you get a term sheet"""

    return f"""You are Alex, a senior engineer at a top Indian tech company conducting a {config['label']} interview for a {role} developer with {experience} experience.

About this round: {config['description']}

How you interview:
- Ask sharp, practical questions that test real understanding — not definitions you can Google
- When an answer is vague, probe: "Can you give me a specific example?" or "How would that work at scale?"
- When an answer is good, acknowledge it genuinely and specifically — mention what impressed you
- When an answer is wrong or incomplete, be honest but constructive — tell them exactly what was missing and why it matters
- Sound like a real person having a conversation, not a bot reading a script
- Keep your responses concise — 2-3 sentences max before asking the next question

Question style: {config['question_focus']}

Scoring — be honest and accurate:
- 1-2: Wrong answer, "I don't know", or completely off track
- 3-4: Partial answer, got some things right but missed key concepts
- 5-6: Decent answer, covered the basics but lacked depth or examples
- 7-8: Strong answer, clear understanding with good reasoning
- 9-10: Excellent answer, could teach this to others

Do not default to 5. Score based on what they actually said."""

def get_first_question_prompt(role: str, experience: str, mode: str) -> str:
    config = MODE_CONFIG.get(mode, MODE_CONFIG["technical"])

    if mode == "pitch":
        return """You are starting a pitch meeting with a founder. Greet them briefly and naturally — like a VC who has back-to-back meetings. Then ask your opening question to kick off the pitch.

Format exactly like this:
INTRO: [one natural, direct sentence — like "Thanks for coming in, let's dive right in."]
QUESTION: [Your opening question — typically "Tell me about what you're building and the problem you're solving." but make it feel natural and specific]"""

    return f"""You are starting a {config['label']} interview for a {role} developer ({experience} level).

Greet them warmly in one sentence, then ask your first question. The question should be practical and immediately test real knowledge — not "tell me about yourself."

Format your response exactly like this:
INTRO: [one warm, natural sentence]
QUESTION: [your first interview question]"""

def get_conversational_response_prompt(
    role: str, experience: str, mode: str,
    question: str, answer: str,
    question_number: int, total: int,
    previous_qa: List[dict]
) -> str:
    config = MODE_CONFIG.get(mode, MODE_CONFIG["technical"])
    history = ""
    if previous_qa:
        history = "\nConversation so far:\n"
        for qa in previous_qa:
            history += f"Q: {qa['question']}\nA: {qa['answer']}\n\n"

    is_last = question_number >= total

    if mode == "pitch":
        return f"""You are Rahul, a VC partner, in a pitch meeting with a founder.
{history}
You just asked: {question}
The founder answered: {answer}

{"This was your last question. Respond to their answer, then close the meeting naturally — tell them you'll be in touch or share a brief honest reaction to the overall pitch." if is_last else f"This is question {question_number} of {total} in the pitch meeting."}

Respond like a real VC:

RESPONSE: [2-3 sentences. React specifically to what they said. If it was strong, acknowledge it and say why. If it was weak or vague, push back directly — "That's a bit hand-wavy, can you give me specifics?" or "Most investors would want to see traction before that conversation." Don't be gentle if the answer doesn't hold up.]

{"DONE" if is_last else "NEXT_QUESTION: [Ask your next investor question. Make it feel like a natural follow-up in a real pitch meeting — probe deeper on something they said, or move to the next important area: market, competition, team, traction, business model, funding plan.]"}

SCORE: [1-10 based strictly on the quality and clarity of their answer. Score 1-3 if vague or unprepared, 4-6 if decent but not compelling, 7-10 only if genuinely strong.]"""

    return f"""You are Alex, mid-interview with a {role} developer ({experience} level) in a {config['label']} round.
{history}
You just asked: {question}
They answered: {answer}

{"This was the last question. Respond to their answer, then close the interview warmly in one sentence." if is_last else f"This is question {question_number} of {total}."}

Now respond like a real interviewer:

RESPONSE: [2-3 sentences. Be specific — mention something they actually said. If it was good, say exactly why. If it was weak or wrong, tell them clearly what was missing and why it matters in real projects. Don't be vague. Don't say "great answer" if it wasn't.]

{"DONE" if is_last else f"NEXT_QUESTION: [Ask your next {config['label']} question. Make it feel like a natural continuation of a real interview — practical, specific, something that would come up at Zomato, Razorpay, CRED, or a funded Indian startup.]"}

SCORE: [Give an honest score from 1-10 based strictly on the quality of their answer. If they said they don't know or got it wrong, score 1-3. Don't default to 5.]"""

def get_summary_prompt(role: str, experience: str, mode: str, qa_list: List[dict], overall_score: int) -> str:
    config = MODE_CONFIG.get(mode, MODE_CONFIG["technical"])
    qa_text = "\n".join([
        f"Q{i+1}: {q['question']}\nAnswer: {q['answer']}\nScore: {q['score']}/10"
        for i, q in enumerate(qa_list) if q.get('answer')
    ])

    if mode == "pitch":
        return f"""You just finished a pitch meeting with a founder. Here is the full conversation:

{qa_text}

Overall Score: {overall_score}/10

Write a 3-4 sentence post-meeting debrief like a VC writing internal notes after a founder leaves:
- What was the strongest part of their pitch (reference something specific they said)
- What was the biggest concern or gap that would stop you from moving forward
- One specific thing they should sharpen before their next investor meeting
Be direct and honest. This is internal feedback, not a rejection letter."""

    return f"""You just finished a {config['label']} interview with a {role} developer ({experience} level).

Here is the full interview:
{qa_text}

Overall Score: {overall_score}/10

Write a post-interview debrief in 3-4 sentences. Be direct and honest like a real interviewer giving feedback after the candidate leaves the room:
- Mention one or two specific things they got right (reference actual answers)
- Mention the biggest gap or weakness you noticed
- Give one concrete, actionable recommendation — something specific to study or practice
Don't be generic. Reference what they actually said."""

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

    session_data = {
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

    set_session(session_id, session_data)

    return StartInterviewResponse(
        session_id=session_id,
        role=request.role,
        experience=request.experience,
        mode=request.mode,
        first_question=full_opening
    )

@api_router.post("/interview/answer", response_model=AnswerResponse)
async def submit_answer(request: AnswerRequest):
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["is_complete"]:
        raise HTTPException(status_code=400, detail="Interview already complete")

    current_q_index = session["current_question"] - 1
    current_question = session["questions"][current_q_index]["question"]
    previous_qa = [q for q in session["questions"][:current_q_index] if q.get("answer")]
    is_complete = session["current_question"] >= session["total_questions"]

    conversational_response = ""
    next_question = None
    score = 5

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

        if not is_complete and not next_question:
            try:
                fallback = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": get_system_prompt(session["role"], session["experience"], session["mode"])},
                        {"role": "user", "content": f"Ask a single practical {session['mode']} question. Just the question, nothing else."}
                    ],
                    temperature=0.7,
                    max_tokens=200
                )
                next_question = fallback.choices[0].message.content.strip()
            except:
                next_question = "Can you walk me through how you would debug a performance issue in a production application?"

    except Exception as e:
        logging.error(f"Groq error: {e}")
        conversational_response = "Thanks for that answer."
        next_question = None
        score = 5

    session["questions"][current_q_index]["answer"] = request.answer
    session["questions"][current_q_index]["feedback"] = conversational_response
    session["questions"][current_q_index]["score"] = score

    if not is_complete and next_question:
        session["questions"].append({
            "question": next_question,
            "answer": None,
            "feedback": None,
            "score": None
        })

    session["current_question"] += 1
    session["is_complete"] = is_complete

    set_session(request.session_id, session)

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
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    scores = [q["score"] for q in session["questions"] if q.get("score") is not None]
    overall_score = round(sum(scores) / len(scores)) if scores else 0

    try:
        summary = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are giving direct, honest feedback."},
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