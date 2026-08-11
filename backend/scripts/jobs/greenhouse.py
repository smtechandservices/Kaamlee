"""Pull job postings from a Greenhouse job board and save them into the Job model.

Greenhouse exposes a public, unauthenticated read API per company board:

    https://api.greenhouse.io/v1/boards/{client_name}/jobs?content=true

`client_name` is the slug in the board's public URL, e.g. the "stripe" in
https://boards.greenhouse.io/stripe. The endpoint returns every listed
posting in a single response (no pagination).

Usage:
    python scripts/jobs/greenhouse.py stripe
    python scripts/jobs/greenhouse.py stripe figma
"""
import argparse
import html
import os
import re
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
from scripts.jobs import JOB_UPDATE_FIELDS, bulk_upsert_jobs, checkpoint_sqlite
from scripts.geocode_jobs import run_streaming as geocode_jobs_streaming

REQUEST_TIMEOUT = 15


# ------------------------------------------------------------------
# Greenhouse API
# ------------------------------------------------------------------
def fetch_board(client_name):
    """Fetch every listed posting for a board in one call — the public
    boards API isn't paginated. content=true is required to get each
    posting's full HTML description in the same response."""
    url = f"https://api.greenhouse.io/v1/boards/{client_name}/jobs?content=true"
    response = requests.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()


# ------------------------------------------------------------------
# Field mapping helpers — one posting (raw Greenhouse JSON) -> Job model fields
# ------------------------------------------------------------------
def _is_remote(location_name):
    return 'remote' in (location_name or '').lower()


# Some Greenhouse boards (e.g. BAYADA) embed real coordinates straight into
# the location string as "<display name> | <lat> | <lon>" — presumably from
# their own internal geocoding — sometimes with trailing junk after a ";"
# (seen as "; Select a Location" on a handful of postings). e.g.:
#   "Little River, SC 29566 | 33.875205134 | -78.649330786"
#   "King Of Prussia, PA 19406 | 40.093760586 | -75.382200595; Select a Location"
_EMBEDDED_COORDS_RE = re.compile(r'^(?P<name>.*?)\s*\|\s*(?P<lat>-?\d+\.\d+)\s*\|\s*(?P<lon>-?\d+\.\d+)\s*(?:;.*)?$')


def _parse_location(raw_location_name):
    """Splits a possibly coordinate-embedded location string into a clean
    display name plus (latitude, longitude) if present. When a board
    already hands us real coordinates there's no reason to pay for a
    Nominatim lookup later — cheaper, faster, and no less accurate. Returns
    (display_name, latitude, longitude); latitude/longitude are None when
    the string has no embedded coordinates, and the caller falls back to
    geocoding display_name as before."""
    match = _EMBEDDED_COORDS_RE.match(raw_location_name or '')
    if not match:
        return raw_location_name, None, None
    try:
        return match.group('name').strip(), float(match.group('lat')), float(match.group('lon'))
    except ValueError:
        return raw_location_name, None, None


def _date_posted(job):
    published_at = job.get('first_published')
    if not published_at:
        return None
    try:
        return datetime.fromisoformat(published_at).date()
    except ValueError:
        return None


def _plain_description(content):
    # Greenhouse's `content` is HTML, and the entities in it are
    # double-encoded (e.g. "&lt;h2&gt;" rather than "<h2>") — decode twice,
    # then strip tags, since the frontend renders description as plain text.
    if not content:
        return None
    unescaped = html.unescape(html.unescape(content))
    text = BeautifulSoup(unescaped, 'html.parser').get_text(separator='\n').strip()
    return text or None


# ------------------------------------------------------------------
# Sync
# ------------------------------------------------------------------
def sync_board(client_name, company_name=None, stop_event=None):
    """Fetch a board's postings, upsert each into the Job table, then geocode
    them (Greenhouse postings carry no coordinates of their own — just a
    free-text location string, so it's handed to geocode_jobs.py as-is via
    the city field). Any job that still has no coordinates afterwards is
    dropped, since a job with no coordinates can't be plotted on the map.

    id_from_site is namespaced as "greenhouse:{client}:{job id}" so
    re-running this for the same board updates existing rows instead of
    duplicating them, and so IDs can't collide with jobs pulled in from a
    different ATS. Greenhouse's API is case-insensitive about the board
    slug, so the id_from_site key is built from a lowercased client name —
    otherwise "Stripe" (typed via the admin dashboard, matching
    Company.name) and "stripe" (typed via the CLI) would silently create
    two separate copies of every job.

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
    board_url = f"https://boards.greenhouse.io/{client_name}"

    yield f"Fetching {board_url} ..."
    data = fetch_board(client_name)
    jobs = data.get('jobs', [])
    yield f"{len(jobs)} posting(s) received"

    job_objs = []
    job_objs_with_coords = []
    direct_coords = 0
    stopped = False
    for i, job in enumerate(jobs, start=1):
        if stop_event is not None and i % 200 == 0 and stop_event.is_set():
            yield f"Stopped by admin request — prepared {i - 1}/{len(jobs)} before stopping"
            stopped = True
            break

        raw_location_name = (job.get('location') or {}).get('name', '').strip()
        location_name, embedded_lat, embedded_lon = _parse_location(raw_location_name)
        department_hint = ((job.get('departments') or [{}])[0]).get('name')

        obj = Job(
            id_from_site=f"greenhouse:{client_key}:{job['id']}",
            title=job.get('title') or '',
            company=company_name,
            location_name=location_name,
            # Greenhouse gives no structured city/state/country split —
            # only this free-text string — so it goes straight into
            # `city` and geocode_jobs.py resolves (or fails and borrows
            # from a sibling) exactly like it does for messy ATS text.
            # Truncated to fit — Job.city is a 100-char CharField, and a
            # multi-region posting's combined location string (e.g. six
            # Indian cities joined with ";") can run past that. Postgres
            # enforces the column length strictly and rejects the whole
            # bulk_create batch over one oversized row, unlike SQLite,
            # which silently accepts it — this is what was silently
            # failing every board with a long-location posting, every tick.
            city=location_name[:100],
            state=None,
            country='',
            is_remote=_is_remote(location_name),
            job_type=None,
            job_url=job.get('absolute_url') or f"{board_url}#{job['id']}",
            description=_plain_description(job.get('content')),
            site=board_url,
            company_logo=company_logo or None,
            date_posted=_date_posted(job),
            salary=None,
            category=categorize_job(job.get('title'), department_hint=department_hint),
        )
        # Some boards (e.g. BAYADA) embed real coordinates in the location
        # string — use them as-is and skip geocoding this job entirely. Kept
        # in a separate batch with its own update_fields (below) that
        # includes latitude/longitude, so the other batch's upsert doesn't
        # reset an already-geocoded job's coordinates back to null on every
        # re-sync — same guarantee update_or_create's `defaults=` gave when
        # embedded-coord fields were simply omitted from it.
        if embedded_lat is not None and embedded_lon is not None:
            obj.latitude = embedded_lat
            obj.longitude = embedded_lon
            job_objs_with_coords.append(obj)
            direct_coords += 1
        else:
            job_objs.append(obj)

    created, updated = bulk_upsert_jobs(job_objs)
    created_wc, updated_wc = bulk_upsert_jobs(
        job_objs_with_coords, update_fields=JOB_UPDATE_FIELDS + ['latitude', 'longitude'],
    )
    created, updated = created + created_wc, updated + updated_wc
    yield f"{created} created, {updated} updated"
    if direct_coords:
        yield f"{direct_coords} job(s) had coordinates directly from the board — skipped geocoding those"

    geocoded = borrowed = 0
    rate_limited = False
    if not stopped:
        # Geocode whatever's left for this company (scoped, so a re-sync
        # doesn't re-geocode the whole table) — jobs that got coordinates
        # directly above are already non-null and untouched by this pass.
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
            id_from_site__startswith=f"greenhouse:{client_key}:", latitude__isnull=True,
        ).delete()[0]
        if removed:
            yield f"Removed {removed} job(s) left with no coordinates"

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
            result = {'board': client_name, 'ok': False, 'error': f"Greenhouse board not found or unavailable (HTTP {status})"}
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
        help='One or more Greenhouse board slugs, e.g. "stripe" from boards.greenhouse.io/stripe',
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
