"""JobSpy feeder — keeps the Job table (the candidate map) stocked from live
JobSpy searches, on top of the company-ATS scrapers.

Each run (api.models.JobSpyScrapeRun):
  1. picks a random active JobSpyRole and a random JobSpy country,
  2. searches LinkedIn + Indeed (+ Bayt in the Gulf) via
     scripts/jobspy/combined.py — jobs from the last week only,
  3. geocodes every job's city and keeps it only if that lands on a real
     city/town inside the searched country (see _classify), and
  4. saves the keepers as Job rows (skipping ones already saved).

Started by the scheduler every JOBSPY_FEED_INTERVAL_MINUTES (api/scheduler.py,
unless scraping is paused or auto-run is off) or by an admin's "Run now".
One run at a time across all workers (start_run locks the feeder-state row);
each runs in a background thread. A run that never reports back is marked
failed after STALE_RUN_MINUTES so it can't block the feeder.
"""
import hashlib
import logging
import random
import re
import threading
from collections import Counter
from datetime import date, timedelta

from django.db import connection, transaction
from django.db.models import F
from django.utils import timezone

logger = logging.getLogger(__name__)

PER_SITE = 15         # jobs asked from each site per run
# Nominatim `addresstype`s that count as a real city/area. Judged by type, not
# place_rank: big cities that are also administrative areas rank like states
# (London 9, Berlin 8, New York 10) but are still addresstype 'city', while
# 'state' (Maharashtra, Sharjah Emirate), 'county', 'region'… are too broad.
CITY_LEVEL_TYPES = {
    'city', 'town', 'village', 'hamlet', 'municipality', 'suburb', 'borough',
    'city_district', 'district', 'quarter', 'neighbourhood', 'locality',
}
MIN_PLACE_RANK = 13   # fallback when no addresstype: 13+ = city and finer
# City-states: a job that only says "Singapore" / "Hong Kong" is already at city level.
CITY_STATES = {'sg', 'hk'}
# Territories Nominatim files under another country: code -> (subdivision code, name to save).
# e.g. Hong Kong comes back as country_code 'cn' with ISO3166-2 'CN-HK'.
TERRITORIES = {'hk': ('CN-HK', 'Hong Kong')}
_PLACEHOLDERS = {'remote', 'anywhere', 'worldwide', 'global', 'work from home', 'wfh', 'hybrid'}
_JOB_TYPE_LABELS = {'fulltime': 'Full-time', 'parttime': 'Part-time', 'internship': 'Internship',
                    'contract': 'Contract', 'temporary': 'Temporary'}

# Runs take ~1–3 minutes; one still 'running' after this died with its worker.
STALE_RUN_MINUTES = 20

_geo_cache = {}                 # (city, country code) -> (reason, place), for this process's lifetime
_GEO_CACHE_MAX = 5000
_locator = None


# ---- countries -------------------------------------------------------------
def _country_info(country):
    """(country code, name for the geocoder, spellings that mean "just the
    country") for a JobSpy country name like 'UK' or 'United Arab Emirates'."""
    from jobspy.model import Country
    names, code = Country.from_string(country).value[:2]
    code = code.split(':')[-1].lower()           # 'uk:gb' -> 'gb', 'www:us' -> 'us'
    spellings = {n.strip().lower() for n in names.split(',')} | {country.lower(), code}
    if code == 'ae':
        spellings.add('uae')
    return code, names.split(',')[-1].strip(), spellings


# LinkedIn often names metro areas rather than cities ("Pune Division",
# "Greater Bengaluru Area", "Mumbai Metropolitan Region"), which the geocoder
# can't find — reduce them to the city first. Tried in order.
_METRO_PATTERNS = [
    re.compile(r'^greater\s+(.+?)(?:\s+area)?$', re.I),
    re.compile(r'^(.+?)\s+(?:bay\s+area|metropolitan\s+(?:area|region)|metro\s+area)$', re.I),
    re.compile(r'^(.+?)\s+(?:division|area|region)$', re.I),
]


def _clean_city(name):
    for pattern in _METRO_PATTERNS:
        match = pattern.match(name)
        if match:
            return match.group(1).strip()
    return name


# ---- geocoding -------------------------------------------------------------
def _is_city_level(raw):
    kind = raw.get('addresstype')
    if kind:
        return kind in CITY_LEVEL_TYPES
    return int(raw.get('place_rank') or 0) >= MIN_PLACE_RANK


def _in_country(address, code):
    if (address.get('country_code') or '').lower() == code:
        return True
    territory = TERRITORIES.get(code)
    return bool(territory) and any(
        (address.get(k) or '').upper() == territory[0] for k in ('ISO3166-2-lvl3', 'ISO3166-2-lvl4', 'ISO3166-2-lvl5')
    )


def _geocode_city(city, geocoder_country, code):
    """('ok', place) when `city, country` resolves to a city-level place in
    that country; otherwise (reason, None) — see _classify for the reasons."""
    global _locator
    key = (city.lower(), code)
    if key in _geo_cache:
        return _geo_cache[key]

    from geopy.geocoders import Nominatim
    import scripts.geocode_jobs as geo  # paced, rate-limit-aware Nominatim helper (shared lock)

    if _locator is None:
        _locator = Nominatim(user_agent='kaamlee_locations', ssl_context=geo._SSL_CONTEXT)
    result, rate_limited = geo._geocode_one(
        _locator, f'{city}, {geocoder_country}',
        addressdetails=True, language='en', featuretype='settlement',
    )
    if rate_limited:
        return ('unresolved', None)  # not cached — worth retrying next run
    if not result:
        outcome = ('unresolved', None)
    else:
        address = result.raw.get('address') or {}
        if not _in_country(address, code):
            outcome = ('wrong_country', None)
        elif not _is_city_level(result.raw):
            outcome = ('country_only', None)  # matched a state/region, not a city
        else:
            outcome = ('ok', {
                'latitude': result.latitude,
                'longitude': result.longitude,
                # The job's own name for it ("London", not "Greater London").
                'city': city,
                'state': address.get('state'),
                'country': TERRITORIES[code][1] if code in TERRITORIES else address.get('country'),
            })
    if len(_geo_cache) >= _GEO_CACHE_MAX:
        _geo_cache.clear()
    _geo_cache[key] = outcome
    return outcome


def _classify(job, geocoder_country, code, spellings):
    """Where a fetched job lands: ('ok', place) to save it, or a reason to
    drop it — 'remote' (no place of its own), 'country_only' (just the
    country or a region), 'wrong_country' or 'unresolved'."""
    parts = [p.strip() for p in str(job.get('location') or '').split(',') if p.strip()]
    places = [p for p in parts if p.lower() not in spellings]
    if not places and parts and code in CITY_STATES:
        places = [geocoder_country.title()]  # "Singapore" is the city
    if not places:
        return ('remote', None) if job.get('is_remote') else ('country_only', None)
    if places[0].lower() in _PLACEHOLDERS:
        return ('remote', None)
    return _geocode_city(_clean_city(places[0]), geocoder_country, code)


# ---- saving ----------------------------------------------------------------
def _job_key(job):
    raw = job.get('id') or hashlib.md5(str(job.get('job_url') or '').encode()).hexdigest()
    return f'jobspy:{raw}'[:255]


def _salary(job):
    low, high = job.get('min_amount'), job.get('max_amount')
    if low is None and high is None:
        return None
    fmt = lambda n: f'{int(n):,}'
    amount = f'{fmt(low)} – {fmt(high)}' if low is not None and high is not None and low != high else fmt(low if low is not None else high)
    text = ' '.join(p for p in (job.get('currency'), amount) if p)
    return (f"{text} / {job['interval']}" if job.get('interval') else text)[:100]


def _job_type(job):
    raw = job.get('job_type')
    if not raw:
        return None
    return ', '.join(_JOB_TYPE_LABELS.get(t.strip().lower(), t.strip()) for t in str(raw).split(','))[:100]


def _date(value):
    try:
        return date.fromisoformat(str(value)[:10]) if value else None
    except ValueError:
        return None


def _job_row(job, place):
    from api.models import Job
    from scripts.job_categorizer import categorize_job

    title = (job.get('title') or '').strip()[:255]
    return Job(
        id_from_site=_job_key(job),
        title=title,
        company=(job.get('company') or 'Company not listed').strip()[:255],
        location_name=(job.get('location') or ', '.join(p for p in (place['city'], place['country']) if p))[:255],
        city=(place['city'] or '')[:100],
        state=(place['state'] or None) and place['state'][:100],
        country=(place['country'] or '')[:100],
        is_remote=bool(job.get('is_remote')),
        job_type=_job_type(job),
        job_url=(job.get('job_url_direct') or job.get('job_url'))[:1000],
        description=job.get('description') or None,
        site=job.get('site') or 'jobspy',
        company_logo=(job.get('company_logo') or None) and job['company_logo'][:1000],
        date_posted=_date(job.get('date_posted')),
        latitude=place['latitude'],
        longitude=place['longitude'],
        salary=_salary(job),
        category=categorize_job(title),
    )


# ---- a run -----------------------------------------------------------------
def _execute(run):
    from api.models import Job
    from scripts.jobspy import combined

    try:
        result = combined.search(role=run.role, country=run.country, per_site=PER_SITE, total=PER_SITE * 3)
        jobs = result['jobs']
        run.fetched = len(jobs)
        run.site_counts = dict(Counter(j.get('site') for j in jobs if j.get('site')))
        run.error = '\n'.join(f'{site}: {m}' for site, messages in result['errors'].items() for m in messages)

        code, geocoder_country, spellings = _country_info(run.country)
        existing = set(Job.objects.filter(id_from_site__in=[_job_key(j) for j in jobs])
                       .values_list('id_from_site', flat=True))
        counts, rows, seen = Counter(), [], set()
        for job in jobs:
            key = _job_key(job)
            if key in existing or key in seen or not job.get('title') or not (job.get('job_url_direct') or job.get('job_url')):
                counts['duplicates'] += 1
                continue
            seen.add(key)
            reason, place = _classify(job, geocoder_country, code, spellings)
            if reason != 'ok':
                counts[reason] += 1
                continue
            rows.append(_job_row(job, place))

        Job.objects.bulk_create(rows, ignore_conflicts=True)
        run.saved = len(rows)
        run.duplicates = counts['duplicates']
        run.dropped_remote = counts['remote']
        run.dropped_country_only = counts['country_only']
        run.dropped_wrong_country = counts['wrong_country']
        run.dropped_unresolved = counts['unresolved']
        run.status = 'success'
    except Exception as e:
        logger.exception('JobSpy feeder run %s failed', run.pk)
        run.status = 'failed'
        run.error = f'{run.error}\n{e}'.strip()
    finally:
        # After saving, and even if the search failed: it only looks at jobs
        # already in the database. Its own failure mustn't fail the run.
        try:
            run.removed_old = _remove_old_jobs()
        except Exception:
            logger.exception('JobSpy feeder run %s: removing old jobs failed', run.pk)
        if run.saved or run.removed_old:
            from django.core.cache import cache
            from api.views import _STATS_CACHE_KEY
            cache.delete(_STATS_CACHE_KEY)  # admin dashboard counts
        run.finished_at = timezone.now()
        run.save()
        logger.info(f'[JobSpyFeed] {run.role} / {run.country}: fetched {run.fetched}, saved {run.saved}, '
                    f'removed {run.removed_old} over a month old ({run.status})')


def _remove_old_jobs():
    """Delete saved JobSpy jobs posted more than MAX_JOB_AGE_DAYS (30) ago —
    the same rule the career-page scrapers apply to their own jobs
    (scripts/jobs remove_old_jobs), which never touch 'jobspy:' ones. A job
    with no posting date goes that long after it was saved instead, so it
    can't stay forever. Returns how many were deleted."""
    from django.db.models import Q
    from api.models import Job
    from scripts.jobs import MAX_JOB_AGE_DAYS

    cutoff = timezone.now() - timedelta(days=MAX_JOB_AGE_DAYS)
    return Job.objects.filter(id_from_site__startswith='jobspy:').filter(
        Q(date_posted__lt=cutoff.date()) | Q(date_posted__isnull=True, created_at__lt=cutoff),
    ).delete()[0]


def fail_stale_runs():
    """Mark runs still 'running' after STALE_RUN_MINUTES as failed. The run's
    thread lives in whichever worker started it; if that worker is killed or
    recycled mid-run the row would stay 'running' and block every later run
    until a full restart. Returns how many were marked."""
    from api.models import JobSpyScrapeRun
    now = timezone.now()
    return JobSpyScrapeRun.objects.filter(
        status='running', started_at__lt=now - timedelta(minutes=STALE_RUN_MINUTES),
    ).update(
        status='failed', finished_at=now,
        error=f'No result after {STALE_RUN_MINUTES} minutes — the server process running it probably stopped.',
    )


def start_run(triggered_by='scheduler', user=None, country=None):
    """Start one run in the background with a random active role and the given
    JobSpy country (one of COUNTRIES), or a random one when not given.
    Returns (run, None), or (None, reason) if it can't start."""
    from api.models import JobSpyFeederState, JobSpyRole, JobSpyScrapeRun
    from scripts.jobspy._common import COUNTRIES

    JobSpyFeederState.get_solo()  # make sure the row exists before locking it
    with transaction.atomic():
        # Lock first: a second start at the same moment (another worker, or
        # the scheduler and "Run now" together) waits here until this one
        # commits, then sees its run and backs off. A no-op UPDATE rather than
        # select_for_update() because SQLite ignores the latter; the write
        # takes SQLite's write lock, and the row lock on Postgres.
        JobSpyFeederState.objects.filter(pk=1).update(auto_enabled=F('auto_enabled'))
        fail_stale_runs()
        if JobSpyScrapeRun.objects.filter(status='running').exists():
            return None, 'A JobSpy run is already in progress.'
        roles = list(JobSpyRole.objects.filter(is_active=True).values_list('name', flat=True))
        if not roles:
            return None, 'Add or switch on at least one role first.'
        run = JobSpyScrapeRun.objects.create(
            role=random.choice(roles), country=country or random.choice(COUNTRIES),
            triggered_by=triggered_by, triggered_by_user=user,
        )

    def work():
        try:
            _execute(run)
        finally:
            connection.close()  # this thread's own DB connection

    threading.Thread(target=work, daemon=True, name=f'jobspy-feed-{run.pk}').start()
    return run, None


def scheduled_tick():
    """Scheduler entry point: start a run unless scraping is paused or the
    feeder's auto-run is switched off (or one is already going)."""
    from api.models import JobSpyFeederState, ScraperPauseState

    if ScraperPauseState.get_solo().is_paused:
        logger.info('[JobSpyFeed] Scraping is paused — skipping this tick.')
        return
    if not JobSpyFeederState.get_solo().auto_enabled:
        return
    run, reason = start_run('scheduler')
    if run is None:
        logger.info(f'[JobSpyFeed] Not started: {reason}')


def reconcile_stale_runs():
    """At startup: runs left 'running' by a restart will never finish."""
    from api.models import JobSpyScrapeRun
    JobSpyScrapeRun.objects.filter(status='running').update(
        status='failed', finished_at=timezone.now(), error='Server restarted during the run.',
    )
