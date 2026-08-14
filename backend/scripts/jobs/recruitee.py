"""Pull job postings from a Recruitee job board and save them into the Job model.

Recruitee exposes a public, unauthenticated read API per company board:

    https://{client_name}.recruitee.com/api/offers/

`client_name` is the subdomain in the board's public URL, e.g. the "asvz" in
https://asvz.recruitee.com. The endpoint returns every published posting in
a single response (no pagination).

Usage:
    python scripts/jobs/recruitee.py asvz
    python scripts/jobs/recruitee.py asvz otherclient
"""
import argparse
import os
import sys
import threading
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ------------------------------------------------------------------
# Django bootstrap — this file runs as a standalone script (not a
# management command), so the project needs to be put on sys.path and
# django.setup() called manually before any `api.models` import works.
# ------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from django.db import connections
from django.utils import timezone

from api.models import Company, Job
from scripts.job_categorizer import categorize_job
from scripts.jobs import bulk_upsert_jobs, checkpoint_sqlite, remove_old_jobs, remove_stale_jobs
from scripts.geocode_jobs import run_streaming as geocode_jobs_streaming

REQUEST_TIMEOUT = 15

# Recruitee's employment_type_code enum -> the human-readable label the
# frontend displays. Anything not in this map (should not normally happen)
# passes through as-is.
_EMPLOYMENT_TYPE_LABELS = {
    'fulltime_permanent': 'Full-time',
    'parttime_permanent': 'Part-time',
    'fulltime_fixed_term': 'Full-time (Fixed-term)',
    'parttime_fixed_term': 'Part-time (Fixed-term)',
    'contract': 'Contract',
    'internship': 'Internship',
    'temporary': 'Temporary',
}

_CURRENCY_SYMBOLS = {'EUR': '€', 'USD': '$', 'GBP': '£'}


# ------------------------------------------------------------------
# Recruitee API
# ------------------------------------------------------------------
def fetch_board(client_name):
    """Fetch every published posting for a board in one call — the public
    offers API isn't paginated, and only ever returns status="published"
    postings."""
    url = f"https://{client_name}.recruitee.com/api/offers/"
    response = requests.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()


# ------------------------------------------------------------------
# Field mapping helpers — one posting (raw Recruitee JSON) -> Job model fields
# ------------------------------------------------------------------
def _plain_description(html_content):
    if not html_content:
        return None
    text = BeautifulSoup(html_content, 'html.parser').get_text(separator='\n').strip()
    return text or None


def _date_posted(job):
    published_at = job.get('published_at')
    if not published_at:
        return None
    try:
        # e.g. "2026-07-29 08:58:47 UTC" — always UTC, so the zone name can
        # just be stripped rather than parsed.
        return datetime.strptime(published_at.replace(' UTC', ''), '%Y-%m-%d %H:%M:%S').date()
    except ValueError:
        return None


def _salary(job):
    salary = job.get('salary') or {}
    lo, hi, currency, period = salary.get('min'), salary.get('max'), salary.get('currency'), salary.get('period')
    if not lo and not hi:
        return None
    symbol = _CURRENCY_SYMBOLS.get(currency, f"{currency} " if currency else '')
    text = f"{symbol}{lo} – {symbol}{hi}" if lo and hi and lo != hi else f"{symbol}{lo or hi}"
    if period:
        text += f" / {period}"
    return text[:100]  # Job.salary is a 100-char CharField


# ------------------------------------------------------------------
# Sync
# ------------------------------------------------------------------
def sync_board(client_name, company_name=None, stop_event=None):
    """Fetch a board's postings, upsert each into the Job table, then geocode
    them (Recruitee gives structured city/state/country but no coordinates
    of its own). Any job that still has no coordinates afterwards — its own
    location couldn't be geocoded and no company sibling had one to borrow
    — is dropped, since a job with no coordinates can't be plotted on the
    map.

    id_from_site is namespaced as "recruitee:{client}:{job id}" so
    re-running this for the same board updates existing rows instead of
    duplicating them, and so IDs can't collide with jobs pulled in from a
    different ATS. Recruitee's subdomain is case-insensitive, so the
    id_from_site key is built from a lowercased client name — otherwise
    "ASVZ" (typed via the admin dashboard, matching Company.name) and
    "asvz" (typed via the CLI) would silently create two separate copies of
    every job.

    stop_event, if given, is checked periodically during the upsert loop
    and passed through to the geocode pass — lets an admin cooperatively
    cancel a run in progress (see api.views._RunRegistry). Whatever's
    already been saved/geocoded up to that point stays as-is; it just stops
    doing more.

    This is a generator: it yields short progress-log strings as it goes
    (so a caller streaming to an HTTP response or a terminal can show live
    output), and finally yields a dict of the run's stats as the last item.
    Callers that only want the end result can drain it, e.g.:
        *_, stats = sync_board(name)
    """
    company_name = company_name or client_name
    client_key = client_name.strip().lower()
    # Job.company is a plain string, not an FK — best-effort match against the
    # Company table just to reuse its logo_url if one's already on file.
    company_logo = (
        Company.objects.filter(name__iexact=company_name).values_list('logo_url', flat=True).first()
    )
    board_url = f"https://{client_name}.recruitee.com"

    yield f"Fetching {board_url}/api/offers/ ..."
    data = fetch_board(client_name)
    jobs = data.get('offers', [])
    yield f"{len(jobs)} posting(s) received"

    job_objs = []
    fetched_ids = set()
    stopped = False
    for i, job in enumerate(jobs, start=1):
        if stop_event is not None and i % 200 == 0 and stop_event.is_set():
            yield f"Stopped by admin request — prepared {i - 1}/{len(jobs)} before stopping"
            stopped = True
            break

        location_name = (job.get('location') or job.get('city') or '').strip()

        obj = Job(
            id_from_site=f"recruitee:{client_key}:{job['id']}",
            title=job.get('title') or '',
            company=company_name,
            location_name=location_name,
            city=job.get('city') or '',
            state=job.get('state_name') or None,
            country=job.get('country') or '',
            is_remote=bool(job.get('remote')),
            job_type=_EMPLOYMENT_TYPE_LABELS.get(job.get('employment_type_code'), job.get('employment_type_code')),
            job_url=job.get('careers_url') or f"{board_url}#{job['id']}",
            description=_plain_description(job.get('description')),
            site=board_url,
            company_logo=company_logo or None,
            date_posted=_date_posted(job),
            salary=_salary(job),
            category=categorize_job(job.get('title'), department_hint=job.get('department')),
        )
        fetched_ids.add(obj.id_from_site)
        job_objs.append(obj)

    created, updated = bulk_upsert_jobs(job_objs)
    yield f"{created} created, {updated} updated"

    geocoded = borrowed = 0
    rate_limited = False
    if not stopped:
        # Recruitee gives no coordinates directly — geocode every job just
        # synced for this company (scoped, so a re-sync doesn't re-geocode
        # the whole table).
        yield "Geocoding locations..."
        geocode_stats = None
        for item in geocode_jobs_streaming(company=company_name, stop_event=stop_event):
            if isinstance(item, dict):
                geocode_stats = item
            else:
                yield item  # forward live progress instead of going silent for minutes
        geocoded, borrowed = geocode_stats['geocoded'], geocode_stats['borrowed']
        rate_limited, stopped = geocode_stats['rate_limited'], geocode_stats['stopped']
        yield f"{geocoded} geocoded, {borrowed} borrowed from a company sibling"

    # Jobs from this run that still have no coordinates after both geocoding
    # passes aren't worth keeping — scoped by id_from_site prefix rather than
    # company name so it can't touch another board's jobs at the same company.
    # Skipped when Nominatim was rate-limiting us or the admin stopped the
    # run: a job with no coordinates in either case just means we didn't get
    # to try, not that it's ungeocodable, so deleting it now would lose it
    # for no good reason.
    removed = 0
    if stopped:
        yield "Stopped by admin request — skipping cleanup of uncoordinated jobs this run"
    elif rate_limited:
        yield "Nominatim is rate-limiting geocode requests — skipping cleanup of uncoordinated jobs this run"
    else:
        removed = Job.objects.filter(
            id_from_site__startswith=f"recruitee:{client_key}:", latitude__isnull=True,
        ).delete()[0]
        if removed:
            yield f"Removed {removed} job(s) left with no coordinates"

    # Postings that used to be on this board but weren't in this run's fetch
    # at all (closed, removed, ...) are gone for good, not just uncoordinated
    # — same stopped/empty-fetch guards as above, since either case means we
    # don't actually know the board's full current listing.
    if stopped:
        yield "Stopped by admin request — skipping cleanup of no-longer-listed postings this run"
    elif not jobs:
        yield "No postings received — skipping cleanup of no-longer-listed postings this run"
    else:
        removed_stale = remove_stale_jobs(f"recruitee:{client_key}:", fetched_ids)
        removed += removed_stale
        if removed_stale:
            yield f"Removed {removed_stale} job(s) no longer listed on the board"

    # Postings older than a month are pruned too, regardless of whether
    # they're still listed — unlike the two cleanups above, this doesn't
    # depend on the run being complete, so it always runs.
    removed_old = remove_old_jobs(f"recruitee:{client_key}:")
    removed += removed_old
    if removed_old:
        yield f"Removed {removed_old} job(s) older than a month"

    # Only updates an existing Company row — this script doesn't create one,
    # so a board with no matching Company entry just has no last_scraped_at.
    Company.objects.filter(name__iexact=company_name).update(last_scraped_at=timezone.now())

    yield {
        'fetched': len(jobs), 'created': created, 'updated': updated, 'skipped': 0,
        'geocoded': geocoded, 'borrowed': borrowed, 'removed': removed, 'stopped': stopped,
    }


def run_many(client_names, on_log=None, on_result=None, stop_events=None):
    """Sync a list of board names concurrently — one thread per board, so a
    run covering several companies takes roughly as long as the slowest one
    instead of the sum of all of them. Each board's errors are caught
    independently so a single bad slug (typo, board taken down, etc.)
    doesn't stop the others. Shared by the CLI below and the admin
    dashboard's "run script" action, which lets an admin type in up to a
    few company/board names and trigger this directly rather than editing
    the script.

    Running boards concurrently doesn't multiply the outbound geocoding
    rate: scripts/geocode_jobs.py serializes its actual Nominatim requests
    across threads via its own lock, so N boards at once still geocode at
    the same overall pace as one board alone.

    on_log(board_name, message), if given, is called with each progress
    line sync_board() yields — e.g. to stream it to an HTTP response.
    on_result(board_name, result), if given, is called once per board as
    soon as it finishes (success or failure) — lets a caller stream results
    live instead of waiting for every board to finish. Every result is also
    included in the returned list regardless.
    stop_events, if given, is a {lowercased board name: threading.Event}
    map — each worker checks its own event so an admin can cooperatively
    cancel one board without affecting the others in the same batch.

    Each entry in client_names is normally just the board slug (used as both
    the API lookup and, by default, the Company match for company_logo /
    last_scraped_at) — but can instead be a (client_name, company_name) pair
    when the caller already knows the two differ (e.g. api.scheduler, which
    derives client_name from a Company's career_url and shouldn't assume
    it's spelled the same as Company.name).
    """
    results = []
    results_lock = threading.Lock()

    def worker(entry):
        client_name, company_name = entry if isinstance(entry, tuple) else (entry, None)
        client_name = (client_name or '').strip()
        if not client_name:
            return
        stop_event = (stop_events or {}).get(client_name.lower())
        try:
            stats = None
            for item in sync_board(client_name, company_name=company_name, stop_event=stop_event):
                if isinstance(item, dict):
                    stats = item
                elif on_log:
                    on_log(client_name, item)
            result = {'board': client_name, 'ok': True, **stats}
        except requests.HTTPError as e:
            status = e.response.status_code if e.response is not None else 'unknown'
            result = {'board': client_name, 'ok': False, 'error': f"Recruitee board not found or unavailable (HTTP {status})"}
        except Exception as e:
            result = {'board': client_name, 'ok': False, 'error': str(e)}
        finally:
            # Each thread gets its own DB connection outside Django's usual
            # request/response cycle — close it explicitly so a run doesn't
            # leak idle connections.
            connections.close_all()

        with results_lock:
            results.append(result)
        if on_result:
            on_result(client_name, result)

    threads = [threading.Thread(target=worker, args=(name,)) for name in client_names]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    checkpoint_sqlite()
    return results


# ------------------------------------------------------------------
# CLI entry point
# ------------------------------------------------------------------
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        'board_names', nargs='+',
        help='One or more Recruitee subdomains, e.g. "asvz" from asvz.recruitee.com',
    )
    args = parser.parse_args()

    results = run_many(args.board_names, on_log=lambda board, message: print(f"[{board}] {message}"))
    totals = {'fetched': 0, 'created': 0, 'updated': 0, 'skipped': 0, 'geocoded': 0, 'borrowed': 0, 'removed': 0}
    for r in results:
        if not r['ok']:
            print(f"{r['board']}: ERROR — {r['error']}")
            continue
        print(
            f"{r['board']}: {r['fetched']} posting(s) fetched — {r['created']} created, {r['updated']} updated. "
            f"Geocoded {r['geocoded']} job(s), borrowed coordinates for {r['borrowed']}, "
            f"removed {r['removed']} with no coordinates."
        )
        for key in totals:
            totals[key] += r.get(key, 0)

    if len(results) > 1:
        print(
            f"Total across {len(results)} board(s): {totals['fetched']} fetched, {totals['created']} created, "
            f"{totals['updated']} updated, {totals['geocoded']} geocoded, "
            f"{totals['borrowed']} borrowed, {totals['removed']} removed."
        )
