"""Translate every non-English Job title/description in the database to English.

Self-contained backfill script — checks every job already in the database
and translates it, one-off/rerunnable. Uses deep-translator's unofficial
(free, no API key) Google Translate endpoint; only text langdetect flags as
non-English is sent for translation — most postings are already English, so
this keeps network calls limited to the minority that actually need it. Any
translation failure (detection, network, rate limit) falls back to the
original text rather than raising, so one bad call never breaks the run.

Runs translations concurrently (this is network-bound work, not CPU-bound)
to get through the table fast — DB writes still happen one at a time from
the main thread, so there's no concurrent-write risk.

Usage:
    python scripts/translate_jobs.py
    python scripts/translate_jobs.py --company "OpenAI"
    python scripts/translate_jobs.py --limit 200
    python scripts/translate_jobs.py --workers 16
"""
import argparse
import logging
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from deep_translator import GoogleTranslator
from langdetect import DetectorFactory, LangDetectException, detect

# langdetect's classifier is non-deterministic by default (no fixed seed) —
# the exact same short string like a job title can come back 'en', 'fr', or
# 'ca' on different calls. Pinning the seed makes it at least consistent;
# see _job_is_non_english below for how the remaining unreliability on
# short text is handled.
DetectorFactory.seed = 0

# ------------------------------------------------------------------
# Django bootstrap — standalone script, not a management command, so the
# project needs to be put on sys.path and django.setup() called manually
# before any `api.models` import works.
# ------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from api.models import Job

logger = logging.getLogger(__name__)

TARGET_LANG = 'en'

# Below this length, langdetect is unreliable (e.g. a two-word title) and
# not worth the network round-trip either way.
_MIN_DETECT_CHARS = 20

# GoogleTranslator's free endpoint rejects anything over 5000 chars outright
# ("Text length need to be between 0 and 5000 characters") — plenty of job
# descriptions run longer than that, so without trimming, every one of them
# raised and silently fell back to the untranslated original.
_MAX_TRANSLATE_CHARS = 4999

DEFAULT_WORKERS = 8

# The free/unofficial endpoint throws RequestError under sustained load or
# once an IP's reputation trips its abuse detection — almost always
# transient, so a failing call retries through this escalating backoff
# before giving up on it. If a call still fails after the full schedule,
# that's treated as a persistent block for the rest of THIS run (see
# _rate_limited below) rather than repeating the same futile backoff on
# every remaining job — mirrors scripts/geocode_jobs.py's handling of
# Nominatim rate limits.
_RETRY_BACKOFFS = [5, 15, 30, 60]  # seconds

# Set once a call exhausts _RETRY_BACKOFFS — every worker thread checks this
# and skips straight to "keep original" without attempting more network
# calls, since the endpoint has already shown itself blocked this run.
_rate_limited = threading.Event()


def _is_non_english(text):
    if not text or len(text.strip()) < _MIN_DETECT_CHARS:
        return False
    try:
        return detect(text) != TARGET_LANG
    except LangDetectException:
        return False


def _job_is_non_english(job):
    """A job's title and description are virtually always in the same
    language, and langdetect is far more reliable on a full paragraph than
    on a handful of title words (short strings like "Sales Development
    Representative" get confidently misclassified as French/Catalan/etc.
    even with the seed pinned above) — so the description, when long enough
    to be usable, is the source of truth for whether a job needs
    translation at all. Falls back to the title only when there's no
    usable description."""
    if job.description and len(job.description.strip()) >= _MIN_DETECT_CHARS:
        return _is_non_english(job.description)
    return _is_non_english(job.title)


def _translate_text(text):
    if not text:
        return text
    if _rate_limited.is_set():
        return text

    text = text[:_MAX_TRANSLATE_CHARS]
    last_error = None
    for backoff in [0, *_RETRY_BACKOFFS]:
        if backoff:
            time.sleep(backoff)
        try:
            translated = GoogleTranslator(source='auto', target=TARGET_LANG).translate(text)
            return translated or text
        except Exception as e:
            last_error = e

    logger.warning(
        "Translation still failing after %ds of retries — treating the endpoint as "
        "blocked for the rest of this run: %s", sum(_RETRY_BACKOFFS), last_error,
    )
    _rate_limited.set()
    return text


def _translate_job(job):
    """Runs in a worker thread — pure string/network work, no DB access, so
    it's safe to run many of these concurrently. Returns (job, changed);
    the caller is responsible for saving."""
    if not _job_is_non_english(job):
        return job, False
    new_title = _translate_text(job.title)
    new_description = _translate_text(job.description)
    changed = new_title != job.title or new_description != job.description
    if changed:
        job.title = new_title
        job.description = new_description
    return job, changed


def run(company=None, limit=None, workers=DEFAULT_WORKERS):
    """Returns (checked, translated, rate_limited). rate_limited means the
    translation endpoint stopped responding partway through — jobs after
    that point were left untranslated rather than retried forever, and a
    later rerun should pick them up once the block clears."""
    _rate_limited.clear()

    queryset = Job.objects.all()
    if company:
        queryset = queryset.filter(company__iexact=company)

    total = queryset.count()
    if limit:
        queryset = queryset[:limit]
        total = min(limit, total)

    jobs = list(queryset)
    checked = translated = 0

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_translate_job, job) for job in jobs]
        for future in as_completed(futures):
            job, changed = future.result()
            checked += 1
            if changed:
                job.save(update_fields=['title', 'description'])
                translated += 1
            if checked % 25 == 0 or checked == total:
                print(f"{checked}/{total} job(s) checked, {translated} translated so far")

    return checked, translated, _rate_limited.is_set()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--company', help='Limit to jobs at this company (case-insensitive)')
    parser.add_argument('--limit', type=int, help='Limit number of jobs processed')
    parser.add_argument(
        '--workers', type=int, default=DEFAULT_WORKERS,
        help='Concurrent translation workers (default: %(default)s)',
    )
    args = parser.parse_args()

    checked, translated, rate_limited = run(company=args.company, limit=args.limit, workers=args.workers)
    print(f"Checked {checked} job(s), translated {translated}.")
    if rate_limited:
        print(
            "Translation endpoint stopped responding partway through this run — "
            "some jobs were left untranslated. Wait a bit and rerun to pick them up."
        )
