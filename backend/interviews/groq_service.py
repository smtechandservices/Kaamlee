import json
import logging

from django.conf import settings
from groq import Groq

logger = logging.getLogger(__name__)
_groq = Groq(api_key=settings.GROQ_API_KEY)
_MODEL = "llama-3.3-70b-versatile"


def _chat_json(system_prompt: str, user_content: str, temperature: float = 0.4, max_tokens: int = 1024) -> dict:
    response = _groq.chat.completions.create(
        model=_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


_MCQ_PROMPT = """You are an interview panel setting a timed multiple-choice question for a placement drive, in the "{round_label}" round, for a candidate targeting the role "{target_role}".

Return ONLY a valid JSON object with this exact structure:
{{
  "question": "the question text",
  "options": ["option A", "option B", "option C", "option D"],
  "correct_index": 0,
  "explanation": "one sentence explaining why the correct option is right"
}}

Rules:
- Exactly 4 options, exactly one correct answer, correct_index is 0-based.
- Keep the question solvable in under 90 seconds without external tools.
- Do not repeat any of these already-asked questions: {asked_so_far}
"""


def generate_mcq_question(round_name: str, round_label: str, target_role: str, asked_so_far: list) -> dict:
    try:
        return _chat_json(
            _MCQ_PROMPT.format(
                round_label=round_label,
                target_role=target_role,
                asked_so_far=json.dumps(asked_so_far[-10:]),
            ),
            f"Generate one {round_name} question now.",
        )
    except Exception:
        logger.exception("Groq MCQ generation error (round=%s)", round_name)
        return {
            "question": f"(Fallback question) Which of these is most relevant to {round_label}?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_index": 0,
            "explanation": "This is a fallback question — the AI question generator was temporarily unavailable.",
        }


_CODING_PROBLEM_PROMPT = """You are an interviewer setting a coding round problem for a candidate targeting the role "{target_role}".

Return ONLY a valid JSON object with this exact structure:
{{
  "title": "short problem title",
  "statement": "2-4 sentence problem statement including constraints",
  "example_input": "a sample input",
  "example_output": "the expected output for that input"
}}

Rules:
- The problem should be solvable in under 8 minutes by a competent candidate, in any language.
- Do not repeat any of these already-asked problems: {asked_so_far}
"""


def generate_coding_problem(target_role: str, asked_so_far: list) -> dict:
    try:
        return _chat_json(
            _CODING_PROBLEM_PROMPT.format(target_role=target_role, asked_so_far=json.dumps(asked_so_far[-5:])),
            "Generate one coding problem now.",
        )
    except Exception:
        logger.exception("Groq coding problem generation error")
        return {
            "title": "(Fallback) Two Sum",
            "statement": "Given an array of integers and a target value, return the indices of the two numbers that add up to the target.",
            "example_input": "nums = [2,7,11,15], target = 9",
            "example_output": "[0, 1]",
        }


_CODING_EVAL_PROMPT = """You are grading a candidate's submitted solution to this coding problem:
Title: {title}
Statement: {statement}
Example: input={example_input} -> output={example_output}

Return ONLY a valid JSON object with this exact structure:
{{
  "score": 0,
  "is_correct": false,
  "feedback": "2-3 sentences of specific, constructive feedback on correctness and code quality"
}}

Rules:
- score is 0-10 (10 = fully correct and well-written, 0 = blank/irrelevant).
- Judge the code as written even though you cannot execute it — reason through it step by step.
"""


def evaluate_coding_answer(problem: dict, user_code: str) -> dict:
    try:
        return _chat_json(
            _CODING_EVAL_PROMPT.format(
                title=problem.get("title", ""),
                statement=problem.get("statement", ""),
                example_input=problem.get("example_input", ""),
                example_output=problem.get("example_output", ""),
            ),
            user_code[:6000] or "(no answer submitted)",
            temperature=0.2,
        )
    except Exception:
        logger.exception("Groq coding evaluation error")
        return {"score": 0, "is_correct": False, "feedback": "Could not evaluate this answer automatically — scored as 0."}


_HR_TURN_PROMPT = """You are a warm but rigorous HR interviewer conducting a behavioral/HR round for a candidate targeting the role "{target_role}".

Conversation so far (JSON list of {{question, answer}} pairs, oldest first): {conversation_history}

{latest_answer_instruction}

Return ONLY a valid JSON object with this exact structure:
{{
  "score": 0,
  "feedback": "1-2 sentences of feedback on the answer just given (omit meaningfully if this is the very first question)",
  "next_question": "the next interview question to ask, or an empty string if `is_final` is true"
}}

Rules:
- score is 0-10 for the answer just given (0 if this is the first question with no prior answer).
- next_question should follow naturally from the conversation (a real follow-up), not a generic bank question, unless this is the first turn.
- Cover a mix of motivation, teamwork, conflict-handling, and career-goals questions across the conversation.
"""


def generate_hr_turn(target_role: str, conversation_history: list, latest_answer: str, is_final: bool) -> dict:
    latest_answer_instruction = (
        f'The candidate just answered the most recent question with: "{latest_answer}". Score and give feedback on that answer.'
        if latest_answer
        else "This is the first question of the round — there is no prior answer to score."
    )
    if is_final:
        latest_answer_instruction += " This is the LAST turn of the round — set next_question to an empty string."

    try:
        return _chat_json(
            _HR_TURN_PROMPT.format(
                target_role=target_role,
                conversation_history=json.dumps(conversation_history[-10:]),
                latest_answer_instruction=latest_answer_instruction,
            ),
            "Continue the interview now.",
        )
    except Exception:
        logger.exception("Groq HR turn generation error")
        return {
            "score": 5,
            "feedback": "Could not generate AI feedback for this answer.",
            "next_question": "" if is_final else "Tell me about a time you had to work under a tight deadline.",
        }


_FINAL_REPORT_PROMPT = """You are compiling a final placement-readiness report for a candidate who just completed a full mock interview (Aptitude, Reasoning, Verbal, Coding, HR rounds) targeting the role "{target_role}".

Here is the full transcript with per-turn scores as JSON: {transcript}

Return ONLY a valid JSON object with this exact structure:
{{
  "overall_score": 0,
  "round_scores": {{"aptitude": 0, "reasoning": 0, "verbal": 0, "coding": 0, "hr": 0}},
  "strengths": ["short bullet", "short bullet"],
  "weaknesses": ["short bullet", "short bullet"],
  "summary": "2-3 sentence overall summary",
  "recommendation": "one sentence, direct and actionable placement-readiness verdict"
}}

Rules:
- All scores are 0-100.
- Base round_scores on the actual per-turn results in the transcript, not a guess.
- Be honest and specific — this is meant to genuinely help the candidate improve, not just be encouraging.
"""


def generate_final_report(target_role: str, transcript: list) -> dict:
    try:
        return _chat_json(
            _FINAL_REPORT_PROMPT.format(target_role=target_role, transcript=json.dumps(transcript)),
            "Generate the final report now.",
            temperature=0.3,
            max_tokens=1500,
        )
    except Exception:
        logger.exception("Groq final report generation error")
        return {
            "overall_score": 0,
            "round_scores": {"aptitude": 0, "reasoning": 0, "verbal": 0, "coding": 0, "hr": 0},
            "strengths": [],
            "weaknesses": [],
            "summary": "Could not generate an AI report for this session.",
            "recommendation": "Please retake the interview to get a full report.",
        }
