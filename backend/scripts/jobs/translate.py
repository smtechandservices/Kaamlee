import json
import logging
import os
import re

from groq import Groq

logger = logging.getLogger(__name__)

_groq = Groq(api_key=os.getenv('GROQ_API_KEY'))
_GROQ_MODEL = "openai/gpt-oss-120b"

# Scripts a scraped English-language posting won't contain (CJK, Kana,
# Hangul, Cyrillic, Arabic, Devanagari, Thai). A hit here is a cheap,
# no-API-call signal that a posting needs translating, so the common case
# (an already-English posting) never pays for a Groq round trip.
_NON_LATIN_RE = re.compile(
    '[一-鿿぀-ヿ가-힯Ѐ-ӿ؀-ۿऀ-ॿ฀-๿]'
)

_TRANSLATE_PROMPT = """You translate job postings to English. You will be given a JSON object with "title" and "description" fields, which may be in any language. Return ONLY a valid JSON object with the same two keys, translated to natural English. If a field is already in English, return it unchanged. Do not add commentary or markdown."""


def _looks_non_english(text):
    return bool(text) and bool(_NON_LATIN_RE.search(text))


def _translate(title, description):
    """Best-effort translation of one job's title/description via Groq.
    Falls back to the original text on any failure (bad response, rate
    limit, network error) — a translation glitch should never block a
    scrape from saving the job.
    """
    try:
        # Matches the input cap parse_resume_with_groq uses for the same
        # reason: keep the request comfortably under the model's context
        # window regardless of how long a source posting's description is.
        payload = json.dumps({"title": title or "", "description": (description or "")[:6000]})
        response = _groq.chat.completions.create(
            model=_GROQ_MODEL,
            messages=[
                {"role": "system", "content": _TRANSLATE_PROMPT},
                {"role": "user", "content": payload},
            ],
            temperature=0.1,
            max_tokens=4096,
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
        return result.get("title") or title, result.get("description") or description
    except Exception:
        logger.exception("Groq job translation error")
        return title, description


def translate_non_english_jobs(job_objs):
    """Mutates job_objs in place, translating title/description to English
    for any posting whose text contains a non-Latin script. Called from
    bulk_upsert_jobs so every scraper's output is normalized on every run,
    rather than needing a separate backfill pass for jobs scraped later.
    """
    for job in job_objs:
        if _looks_non_english(job.title) or _looks_non_english(job.description):
            job.title, job.description = _translate(job.title, job.description)
    return job_objs
