"""Pull job postings from EPAM's careers site and save them into the Job model.

Unlike Greenhouse/Lever/Ashby/Workable, EPAM isn't a multi-tenant ATS with one
board per client — it's a single company with one global, unauthenticated
search API covering every EPAM posting worldwide:

    https://careers.epam.com/api/jobs/v2/search/careers-i18n?from={offset}&locale=en-us

The endpoint always returns 20 postings per call regardless of any `limit`
value passed (verified empirically — there's no documented API), so every
posting has to be paged in via the `from` offset until it's exhausted
(~3,350 postings / 20 per page ≈ 168 requests as of writing). `from` is an
absolute result offset, not a page number or cursor — unlike Lever's `offset`
param, this one actually works.

Since there's no per-company board slug, `board_name` below is really just a
display label (kept only so this script's CLI/run_many shape matches the
other four scripts and plugs into the same admin-dashboard "run script"
picker) — the fetch itself always pulls the same global feed no matter what's
passed.

Usage:
    python scripts/jobs/epam.py EPAM
"""
import argparse
import html
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

REQUEST_TIMEOUT = 30
SEARCH_URL = "https://careers.epam.com/api/jobs/v2/search/careers-i18n"
CAREERS_BASE = "https://careers.epam.com"
# Progress is reported roughly this often while paging — purely cosmetic,
# doesn't affect how the fetch itself is chunked (that's fixed server-side).
_PROGRESS_EVERY = 500


# ------------------------------------------------------------------
# EPAM API
# ------------------------------------------------------------------
def fetch_all_jobs(stop_event=None):
    """Pages through the global search API until every posting is fetched.

    This is a generator: it yields short progress-log strings as it pages
    (so a caller streaming to an HTTP response or a terminal can show live
    output), and finally yields a dict — {'jobs': [...], 'stopped': bool} —
    as the last item. Callers that only want the end result can drain it,
    e.g.:
        *_, result = fetch_all_jobs()
    """
    jobs = []
    offset = 0
    total = None
    stopped = False
    while True:
        if stop_event is not None and stop_event.is_set():
            stopped = True
            break

        response = requests.get(
            SEARCH_URL, params={'from': offset, 'locale': 'en-us'}, timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()['data']
        total = data['total']
        page = data['jobs']
        if not page:
            break

        jobs.extend(page)
        offset += len(page)
        if len(jobs) // _PROGRESS_EVERY != (len(jobs) - len(page)) // _PROGRESS_EVERY:
            yield f"Fetched {len(jobs)}/{total} posting(s)..."
        if offset >= total:
            break

    yield {'jobs': jobs, 'stopped': stopped}


# ------------------------------------------------------------------
# Field mapping helpers — one posting (raw EPAM JSON) -> Job model fields
# ------------------------------------------------------------------
def _location_fields(job):
    """EPAM gives a structured `city` array (with nested state/country) when
    a posting has a physical base location, but leaves it null for fully
    remote postings — those only carry a top-level `country` array instead.
    Only the first entry of either is used; a posting spanning several
    cities/countries at once wasn't observed in practice."""
    cities = job.get('city') or []
    if cities:
        city_entry = cities[0]
        city = city_entry.get('name') or ''
        state = (city_entry.get('state') or {}).get('name')
        country = (city_entry.get('country') or {}).get('name') or ''
        return city, state, country

    countries = job.get('country') or []
    country = (countries[0].get('name') if countries else '') or ''
    return '', None, country


def _location_name(city, state, country, is_remote):
    parts = [p for p in (city, state, country) if p]
    if parts:
        return ', '.join(parts)
    return 'Remote' if is_remote else ''


def _date_posted(job):
    raw = job.get('created_at')
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace('Z', '+00:00')).date()
    except ValueError:
        return None


def _plain_description(content):
    if not content:
        return None
    text = BeautifulSoup(html.unescape(content), 'html.parser').get_text(separator='\n').strip()
    return text or None


def _job_url(job):
    path = (job.get('seo') or {}).get('url')
    return f"{CAREERS_BASE}{path}" if path else f"{CAREERS_BASE}#{job['uid']}"


# ------------------------------------------------------------------
# Sync
# ------------------------------------------------------------------
def sync_board(board_name, company_name=None, stop_event=None):
    """Fetches every EPAM posting worldwide, upserts each into the Job
    table, then geocodes them (EPAM postings carry no coordinates of their
    own — just city/state/country strings, same as the other ATSes). Any job
    that still has no coordinates afterwards is dropped, since a job with no
    coordinates can't be plotted on the map.

    board_name is accepted only so this matches the other scripts' CLI/
    run_many shape — EPAM has no per-company boards to select between, so it
    isn't used to build the request. company_name (defaulting to board_name)
    is still used for company_logo lookup, last_scraped_at, and the Job.company
    value written to every row, exactly like the other scripts.

    id_from_site is namespaced as "epam:{job uid}" so re-running this updates
    existing rows instead of duplicating them, and so IDs can't collide with
    jobs pulled in from a different ATS.

    stop_event, if given, is checked periodically during both the fetch and
    the upsert loop, and passed through to the geocode pass — lets an admin
    cooperatively cancel a run in progress (see api.views._RunRegistry).
    Whatever's already been saved/geocoded up to that point stays as-is; it
    just stops doing more.

    This is a generator: it yields short progress-log strings as it goes
    (so a caller streaming to an HTTP response or a terminal can show live
    output), and finally yields a dict of the run's stats as the last item.
    Callers that only want the end result can drain it, e.g.:
        *_, stats = sync_board(name)
    """
    company_name = company_name or board_name
    # Job.company is a plain string, not an FK — best-effort match against the
    # Company table just to reuse its logo_url if one's already on file.
    company_logo = (
        Company.objects.filter(name__iexact=company_name).values_list('logo_url', flat=True).first()
    )

    yield f"Fetching {SEARCH_URL} ..."
    fetch_result = None
    for item in fetch_all_jobs(stop_event=stop_event):
        if isinstance(item, dict):
            fetch_result = item
        else:
            yield item
    jobs, stopped = fetch_result['jobs'], fetch_result['stopped']
    if stopped:
        yield f"Stopped by admin request — fetched {len(jobs)} posting(s) before stopping"
    else:
        yield f"{len(jobs)} posting(s) received"

    job_objs = []
    fetched_ids = set()
    for i, job in enumerate(jobs, start=1):
        if stop_event is not None and i % 200 == 0 and stop_event.is_set():
            yield f"Stopped by admin request — prepared {i - 1}/{len(jobs)} before stopping"
            stopped = True
            break

        city, state, country = _location_fields(job)
        is_remote = job.get('vacancy_type') == 'Remote'
        specializations = job.get('job_specialization') or []

        obj = Job(
            id_from_site=f"epam:{job['uid']}",
            title=job.get('name') or '',
            company=company_name,
            location_name=_location_name(city, state, country, is_remote),
            city=city[:100],  # Job.city is a 100-char CharField
            state=state,
            country=country,
            is_remote=is_remote,
            job_type=job.get('vacancy_type'),
            job_url=_job_url(job),
            description=_plain_description(job.get('description')),
            site=CAREERS_BASE,
            company_logo=company_logo or None,
            date_posted=_date_posted(job),
            salary=None,
            category=categorize_job(job.get('name'), department_hint=specializations[0] if specializations else None),
        )
        fetched_ids.add(obj.id_from_site)
        job_objs.append(obj)

    created, updated = bulk_upsert_jobs(job_objs)
    yield f"{created} created, {updated} updated"

    geocoded = borrowed = 0
    rate_limited = False
    if not stopped:
        # EPAM gives no coordinates directly — geocode every job just
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
    # company name so it can't touch another company's jobs sharing the same
    # name. Skipped when Nominatim was rate-limiting us or the admin stopped
    # the run: a job with no coordinates in either case just means we didn't
    # get to try, not that it's ungeocodable, so deleting it now would lose
    # it for no good reason.
    removed = 0
    if stopped:
        yield "Stopped by admin request — skipping cleanup of uncoordinated jobs this run"
    elif rate_limited:
        yield "Nominatim is rate-limiting geocode requests — skipping cleanup of uncoordinated jobs this run"
    else:
        removed = Job.objects.filter(
            id_from_site__startswith='epam:', latitude__isnull=True,
        ).delete()[0]
        if removed:
            yield f"Removed {removed} job(s) left with no coordinates"

    # Postings that used to be listed but weren't in this run's fetch at all
    # (closed, removed, ...) are gone for good, not just uncoordinated — same
    # stopped/empty-fetch guards as above, since either case means we don't
    # actually know EPAM's full current listing. Scoped globally ('epam:'
    # rather than a per-company prefix) since this run's fetch always covers
    # every EPAM posting worldwide regardless of what company label it's
    # saved under.
    if stopped:
        yield "Stopped by admin request — skipping cleanup of no-longer-listed postings this run"
    elif not jobs:
        yield "No postings received — skipping cleanup of no-longer-listed postings this run"
    else:
        removed_stale = remove_stale_jobs('epam:', fetched_ids)
        removed += removed_stale
        if removed_stale:
            yield f"Removed {removed_stale} job(s) no longer listed on the board"

    # Postings older than a month are pruned too, regardless of whether
    # they're still listed — unlike the two cleanups above, this doesn't
    # depend on the run being complete, so it always runs.
    removed_old = remove_old_jobs('epam:')
    removed += removed_old
    if removed_old:
        yield f"Removed {removed_old} job(s) older than a month"

    # Only updates an existing Company row — this script doesn't create one,
    # so a run with no matching Company entry just has no last_scraped_at.
    Company.objects.filter(name__iexact=company_name).update(last_scraped_at=timezone.now())

    yield {
        'fetched': len(jobs), 'created': created, 'updated': updated, 'skipped': 0,
        'geocoded': geocoded, 'borrowed': borrowed, 'removed': removed, 'stopped': stopped,
    }


def run_many(board_names, on_log=None, on_result=None, stop_events=None):
    """Runs sync_board once per entry in board_names, concurrently — one
    thread per entry, matching the other scripts' run_many shape so this
    plugs into the same admin dashboard "run script" picker and CLI. Since
    EPAM has only one real feed, every entry pulls the same global set of
    postings (just labeled/upserted under whatever company name was typed)
    rather than each hitting a distinct board — passing more than one name
    here just repeats the same fetch under different labels, so there's
    normally no reason to.

    on_log(board_name, message), if given, is called with each progress
    line sync_board() yields — e.g. to stream it to an HTTP response.
    on_result(board_name, result), if given, is called once per entry as
    soon as it finishes (success or failure) — lets a caller stream results
    live instead of waiting for every entry to finish. Every result is also
    included in the returned list regardless.
    stop_events, if given, is a {lowercased board name: threading.Event}
    map — each worker checks its own event so an admin can cooperatively
    cancel one run without affecting the others in the same batch.

    Each entry in board_names is normally just a display label (used as both
    the CLI arg and, by default, the Company match for company_logo /
    last_scraped_at) — but can instead be a (board_name, company_name) pair
    when the caller already knows the two differ (e.g. api.scheduler, which
    derives board_name from a Company's career_url and shouldn't assume it's
    spelled the same as Company.name).
    """
    results = []
    results_lock = threading.Lock()

    def worker(entry):
        board_name, company_name = entry if isinstance(entry, tuple) else (entry, None)
        board_name = (board_name or '').strip()
        if not board_name:
            return
        stop_event = (stop_events or {}).get(board_name.lower())
        try:
            stats = None
            for item in sync_board(board_name, company_name=company_name, stop_event=stop_event):
                if isinstance(item, dict):
                    stats = item
                elif on_log:
                    on_log(board_name, item)
            result = {'board': board_name, 'ok': True, **stats}
        except requests.HTTPError as e:
            status = e.response.status_code if e.response is not None else 'unknown'
            result = {'board': board_name, 'ok': False, 'error': f"EPAM careers API unavailable (HTTP {status})"}
        except Exception as e:
            result = {'board': board_name, 'ok': False, 'error': str(e)}
        finally:
            # Each thread gets its own DB connection outside Django's usual
            # request/response cycle — close it explicitly so a run doesn't
            # leak idle connections.
            connections.close_all()

        with results_lock:
            results.append(result)
        if on_result:
            on_result(board_name, result)

    threads = [threading.Thread(target=worker, args=(name,)) for name in board_names]
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
        help='Company label(s) to upsert jobs under, e.g. "EPAM" — EPAM has no per-company boards, '
             'so every value pulls the same global feed.',
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
            f"Total across {len(results)} run(s): {totals['fetched']} fetched, {totals['created']} created, "
            f"{totals['updated']} updated, {totals['geocoded']} geocoded, "
            f"{totals['borrowed']} borrowed, {totals['removed']} removed."
        )
