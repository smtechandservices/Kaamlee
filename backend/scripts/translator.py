"""Best-effort translation of scraped job postings to English.

Uses deep-translator's unofficial (free, no API key) Google Translate
endpoint. Deliberately fails soft everywhere: a translation hiccup should
never break a scraper run, so any error just falls back to the original
text. Only text langdetect flags as non-English is sent for translation —
most postings are already English, so this keeps network calls (and the
risk of hitting the free endpoint's rate limits) limited to the minority
that actually need it.
"""
import logging

from deep_translator import GoogleTranslator
from langdetect import LangDetectException, detect

logger = logging.getLogger(__name__)

TARGET_LANG = 'en'

# Below this length, langdetect is unreliable (e.g. a two-word title) and
# not worth the network round-trip either way.
_MIN_DETECT_CHARS = 20


def _is_non_english(text):
    if not text or len(text.strip()) < _MIN_DETECT_CHARS:
        return False
    try:
        return detect(text) != TARGET_LANG
    except LangDetectException:
        return False


def translate_text(text):
    """Returns text translated to English if it looks non-English, otherwise
    the original text unchanged. Any failure along the way (detection,
    network, rate limit, length limit) also falls back to the original text
    rather than raising — a bad translation call shouldn't break a sync."""
    if not text:
        return text
    try:
        if not _is_non_english(text):
            return text
        translated = GoogleTranslator(source='auto', target=TARGET_LANG).translate(text)
        return translated or text
    except Exception:
        logger.warning("[Translator] Failed to translate text, keeping original", exc_info=True)
        return text


def translate_job_fields(title, description):
    """Translate a job's title and description to English, best-effort."""
    return translate_text(title), translate_text(description)
