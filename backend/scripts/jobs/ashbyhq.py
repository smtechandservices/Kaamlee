import argparse
import os
import sys
import threading
from datetime import datetime
from pathlib import Path

import requests

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
from scripts.jobs import bulk_upsert_jobs, checkpoint_sqlite
from scripts.geocode_jobs import run_streaming as geocode_jobs_streaming

REQUEST_TIMEOUT = 15

# Ashby's employmentType enum -> the human-readable label the frontend displays.
# Anything not in this map (should not normally happen) passes through as-is.
_EMPLOYMENT_TYPE_LABELS = {
    'FullTime': 'Full-time',
    'PartTime': 'Part-time',
    'Intern': 'Internship',
    'Contract': 'Contract',
    'Temporary': 'Temporary',
    'Apprenticeship': 'Apprenticeship',
    'Freelance': 'Freelance',
}


# ------------------------------------------------------------------
# Ashby API
# ------------------------------------------------------------------
def fetch_board(board_name):
    """Fetch every listed posting for a board in one call — the public posting-api endpoint isn't paginated."""
    url = f"https://api.ashbyhq.com/posting-api/job-board/{board_name}?includeCompensation=true"
    response = requests.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()


# ------------------------------------------------------------------
# Field mapping helpers — one posting (raw Ashby JSON) -> Job model fields
# ------------------------------------------------------------------
def _location_fields(job):
    postal_address = (job.get('address') or {}).get('postalAddress') or {}
    return (
        postal_address.get('addressLocality') or '',
        postal_address.get('addressRegion') or None,
        postal_address.get('addressCountry') or '',
    )


def _is_remote(job):
    # isRemote is the authoritative flag when Ashby sets it; some boards leave
    # it null and only populate workplaceType instead, so fall back to that.
    if job.get('isRemote') is not None:
        return bool(job['isRemote'])
    return (job.get('workplaceType') or '').lower() == 'remote'


def _date_posted(job):
    published_at = job.get('publishedAt')
    if not published_at:
        return None
    try:
        return datetime.fromisoformat(published_at).date()
    except ValueError:
        return None


def _salary(job):
    # Only present when includeCompensation=true and the board opts in to
    # displaying it. compensationTierSummary is the friendliest human string
    # (e.g. "$257K – $335K • Offers Equity"); fall back to the plainer one.
    compensation = job.get('compensation') or {}
    summary = compensation.get('compensationTierSummary') or compensation.get('scrapeableCompensationSalarySummary')
    return summary[:100] if summary else None  # Job.salary is a 100-char CharField


# ------------------------------------------------------------------
# Sync
# ------------------------------------------------------------------
def sync_board(board_name, company_name=None, stop_event=None):
    """Fetch a board's postings, upsert each into the Job table, then geocode
    them (Ashby postings carry no coordinates of their own). Any job that
    still has no coordinates afterwards — its own location couldn't be
    geocoded and no company sibling had one to borrow — is dropped, since a
    job with no coordinates can't be plotted on the map.

    id_from_site is namespaced as "ashby:{board}:{job id}" so re-running this
    for the same board updates existing rows instead of duplicating them, and
    so IDs can't collide with jobs pulled in from a different ATS. Ashby's
    API is case-insensitive about the board slug, so the id_from_site key is
    built from a lowercased board name — otherwise "OpenAI" (typed via the
    admin dashboard, matching Company.name) and "openai" (typed via the CLI)
    would silently create two separate copies of every job.

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
    company_name = company_name or board_name
    board_key = board_name.strip().lower()
    # Job.company is a plain string, not an FK — best-effort match against the
    # Company table just to reuse its logo_url if one's already on file.
    company_logo = (
        Company.objects.filter(name__iexact=company_name).values_list('logo_url', flat=True).first()
    )
    board_url = f"https://jobs.ashbyhq.com/{board_name}"

    yield f"Fetching {board_url} ..."
    data = fetch_board(board_name)
    jobs = data.get('jobs', [])
    yield f"{len(jobs)} posting(s) received"

    job_objs = []
    skipped = 0
    stopped = False
    for i, job in enumerate(jobs, start=1):
        if stop_event is not None and i % 200 == 0 and stop_event.is_set():
            yield f"Stopped by admin request — prepared {i - 1}/{len(jobs)} before stopping"
            stopped = True
            break

        # isListed=False means the posting is closed/hidden but Ashby still
        # returns it in the feed for a while — don't save those.
        if not job.get('isListed', True):
            skipped += 1
            continue

        city, state, country = _location_fields(job)
        job_objs.append(Job(
            id_from_site=f"ashby:{board_key}:{job['id']}",
            title=job.get('title') or '',
            company=company_name,
            location_name=job.get('location') or '',
            city=city,
            state=state,
            country=country,
            is_remote=_is_remote(job),
            job_type=_EMPLOYMENT_TYPE_LABELS.get(job.get('employmentType'), job.get('employmentType')),
            job_url=job.get('jobUrl') or f"{board_url}/{job['id']}",
            description=job.get('descriptionPlain') or None,  # plain text; frontend renders it unescaped
            site=board_url,
            company_logo=company_logo or None,
            date_posted=_date_posted(job),
            salary=_salary(job),
            category=categorize_job(job.get('title'), department_hint=job.get('department') or job.get('team')),
        ))

    created, updated = bulk_upsert_jobs(job_objs)
    yield f"{created} created, {updated} updated, {skipped} unlisted/skipped"

    geocoded = borrowed = 0
    rate_limited = False
    if not stopped:
        # Ashby gives no coordinates directly — geocode every job just
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
            id_from_site__startswith=f"ashby:{board_key}:", latitude__isnull=True,
        ).delete()[0]
        if removed:
            yield f"Removed {removed} job(s) left with no coordinates"

    # Only updates an existing Company row — this script doesn't create one,
    # so a board with no matching Company entry just has no last_scraped_at.
    Company.objects.filter(name__iexact=company_name).update(last_scraped_at=timezone.now())

    yield {
        'fetched': len(jobs), 'created': created, 'updated': updated, 'skipped': skipped,
        'geocoded': geocoded, 'borrowed': borrowed, 'removed': removed, 'stopped': stopped,
    }


def run_many(board_names, on_log=None, on_result=None, stop_events=None):
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

    Each entry in board_names is normally just the board slug (used as both
    the API lookup and, by default, the Company match for company_logo /
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
            result = {'board': board_name, 'ok': False, 'error': f"Ashby board not found or unavailable (HTTP {status})"}
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
        help='One or more Ashby board slugs, e.g. "OpenAI" from jobs.ashbyhq.com/OpenAI',
    )
    args = parser.parse_args()

    results = run_many(args.board_names, on_log=lambda board, message: print(f"[{board}] {message}"))
    totals = {'fetched': 0, 'created': 0, 'updated': 0, 'skipped': 0, 'geocoded': 0, 'borrowed': 0, 'removed': 0}
    for r in results:
        if not r['ok']:
            print(f"{r['board']}: ERROR — {r['error']}")
            continue
        print(
            f"{r['board']}: {r['fetched']} posting(s) fetched — {r['created']} created, {r['updated']} updated, "
            f"{r['skipped']} unlisted/skipped. Geocoded {r['geocoded']} job(s), borrowed coordinates for {r['borrowed']}, "
            f"removed {r['removed']} with no coordinates."
        )
        for key in totals:
            totals[key] += r.get(key, 0)

    if len(results) > 1:
        print(
            f"Total across {len(results)} board(s): {totals['fetched']} fetched, {totals['created']} created, "
            f"{totals['updated']} updated, {totals['skipped']} skipped, {totals['geocoded']} geocoded, "
            f"{totals['borrowed']} borrowed, {totals['removed']} removed."
        )
