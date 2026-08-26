"""One-off pass to translate already-saved Job rows that are still in a
non-English language — bulk_upsert_jobs (scripts/jobs/__init__.py) now
translates on every scrape going forward, but that only touches a posting
the next time its company is re-scraped. This script fixes what's already
in the DB from before that change, without waiting for the scheduler to
cycle back around to every company.

Usage:
    python scripts/backfill_translate_jobs.py
    python scripts/backfill_translate_jobs.py --company "EPAM"
"""
import argparse
import os
import sys
from pathlib import Path

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
from scripts.jobs.translate import _looks_non_english, _translate


def run(company=None):
    queryset = Job.objects.all()
    if company:
        queryset = queryset.filter(company__iexact=company)

    translated = checked = 0
    for job in queryset.iterator():
        checked += 1
        if not (_looks_non_english(job.title) or _looks_non_english(job.description)):
            continue
        new_title, new_description = _translate(job.title, job.description)
        if new_title != job.title or new_description != job.description:
            job.title, job.description = new_title, new_description
            job.save(update_fields=['title', 'description'])
            translated += 1
    return checked, translated


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--company', help='Limit to jobs at this company (case-insensitive)')
    args = parser.parse_args()

    checked, translated = run(company=args.company)
    print(f"Checked {checked} job(s), translated {translated} non-English posting(s).")
