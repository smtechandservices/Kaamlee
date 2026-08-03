"""Fill in missing Job coordinates (latitude/longitude).

Two-pass strategy:
1. Real locations: distinct (city, state, country) combos across jobs missing
   coordinates are geocoded once each via Nominatim and applied to every job
   sharing that combo — so a city shared by many postings is only queried once.
2. Remote jobs with no location of their own: coordinates are borrowed from
   another job at the same company that already has real coordinates (e.g. a
   hybrid/office posting), since a fully-remote listing has no single point of
   its own to plot but showing the company's other office is more useful than
   nothing.

Usage:
    python scripts/geocode_jobs.py
    python scripts/geocode_jobs.py --company "OpenAI"
"""
import argparse
import os
import ssl
import sys
import threading
import time
from pathlib import Path

import certifi
from geopy.exc import GeocoderRateLimited
from geopy.geocoders import Nominatim

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

from django.db.models import Q

from api.models import Job

# geopy's default geocoder talks SSL directly via urllib rather than requests
# (which bundles certifi automatically) — on hosts without a properly
# configured system CA store (common with python.org installers on macOS)
# every geocode call fails silently with a cert-verification error. Pin it to
# certifi's bundle instead.
_SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())

GEOCODE_DELAY = 2  # seconds between calls — Nominatim's usage policy caps at ~1 req/sec
_PLACEHOLDER_CITIES = {'', 'unspecified'}
# A blocked/rate-limited IP gets a 429 on every call, not just an occasional
# one — but the block is almost always transient, so a single combo retries
# through this escalating backoff (seconds) before we treat it as a real,
# persistent block and give up for the run. Worst case ~= sum(_RATE_LIMIT_BACKOFFS)
# added to the run, paid at most once (on whichever combo first exhausts it).
_RATE_LIMIT_BACKOFFS = [15, 30, 60, 120]

# ashbyhq.py/greenhouse.py may now sync several companies concurrently in
# separate threads, each calling into this module for its own company. This
# lock serializes the actual outbound Nominatim requests (and their pacing
# delay) across all of them, so running N companies at once still respects
# Nominatim's ~1 req/sec policy overall instead of multiplying it by N.
_NOMINATIM_LOCK = threading.Lock()


# ------------------------------------------------------------------
# Pass 1 — geocode real (city, state, country) locations
# ------------------------------------------------------------------
def _location_query(city, state, country):
    parts = [p for p in (city, state, country) if p and p.strip().lower() not in _PLACEHOLDER_CITIES]
    return ', '.join(parts)


def _geocode_one(geolocator, query):
    """Geocode a single query, retrying through _RATE_LIMIT_BACKOFFS on a 429
    instead of giving up on the first one. Returns (result, rate_limited);
    rate_limited is only True once the whole backoff schedule is exhausted
    and Nominatim is still rejecting us."""
    for backoff in [0, *_RATE_LIMIT_BACKOFFS]:
        with _NOMINATIM_LOCK:
            if backoff:
                time.sleep(backoff)
            try:
                time.sleep(GEOCODE_DELAY)
                return geolocator.geocode(query, timeout=10), False
            except GeocoderRateLimited:
                continue
            except Exception:
                return None, False
    return None, True


def geocode_real_locations(queryset, stop_event=None):
    """Generator: resolves lat/lng for every distinct (city, state, country)
    combo in queryset that's missing coordinates, one geocode call per
    distinct combo, yielding a short progress string every so often.

    stop_event, if given, is checked before each combo — lets an admin
    cooperatively cancel a run in progress (see api.views._RunRegistry).
    Nothing already resolved is undone; it just stops resolving more.

    Finally yields (resolved_count, rate_limited, stopped) as the last item
    — rate_limited is True if Nominatim was still rejecting us with 429s
    after the full retry backoff, and stopped is True if stop_event was
    set. Either way the caller knows any still-missing coordinates may just
    be an unlucky timing / an admin's choice, not a genuine geocoding
    failure. Callers that only want the end result can drain it, e.g.:
        *_, (resolved, rate_limited, stopped) = geocode_real_locations(qs)
    """
    combos = list(
        queryset.filter(latitude__isnull=True)
        .exclude(city='')
        .values('city', 'state', 'country')
        .distinct()
    )
    if not combos:
        yield (0, False, False)
        return

    geolocator = Nominatim(user_agent='kaamlee_locations', ssl_context=_SSL_CONTEXT)
    resolved = 0
    for i, combo in enumerate(combos, start=1):
        if stop_event is not None and stop_event.is_set():
            yield f"Stopped by admin request — checked {i - 1}/{len(combos)} before stopping"
            yield (resolved, False, True)
            return

        query = _location_query(combo['city'], combo['state'], combo['country'])
        if not query:
            continue

        # Another job anywhere in the table (any company, any prior run)
        # may already have resolved this exact (city, state, country) —
        # reuse it instead of spending a Nominatim call on a query we
        # already know the answer to. Cuts real API calls significantly for
        # common cities shared across companies, which means fewer requests
        # overall and less exposure to rate limiting.
        cached = (
            Job.objects.filter(
                city=combo['city'], state=combo['state'], country=combo['country'], latitude__isnull=False,
            )
            .values('latitude', 'longitude')
            .first()
        )
        if cached:
            resolved += queryset.filter(
                city=combo['city'], state=combo['state'], country=combo['country'], latitude__isnull=True,
            ).update(latitude=cached['latitude'], longitude=cached['longitude'])
            continue

        result, rate_limited = _geocode_one(geolocator, query)
        if rate_limited:
            yield (
                f"Nominatim is still rate-limiting requests after "
                f"{sum(_RATE_LIMIT_BACKOFFS)}s of retries — stopping early after {i}/{len(combos)} checked"
            )
            yield (resolved, True, False)
            return
        if not result:
            continue
        resolved += queryset.filter(
            city=combo['city'], state=combo['state'], country=combo['country'], latitude__isnull=True,
        ).update(latitude=result.latitude, longitude=result.longitude)
        if i % 25 == 0 or i == len(combos):
            yield f"{i}/{len(combos)} location(s) checked, {resolved} geocoded so far"
    yield (resolved, False, False)


# ------------------------------------------------------------------
# Pass 2 — remote jobs with no location of their own borrow from a sibling
# ------------------------------------------------------------------
def fill_remote_from_company(queryset):
    """For jobs still missing coordinates *because they have no location of
    their own* (fully-remote postings, or a blank/placeholder city), copy
    lat/lng from another job at the same company that already has real
    coordinates. Anchors are restricted to jobs with a genuine city so
    coordinates don't chain through a previously borrowed placeholder.

    Deliberately excludes jobs that have a real city but just haven't been
    geocoded yet (e.g. pass 1 got rate-limited before reaching them) —
    borrowing an unrelated sibling's coordinates for those would silently
    overwrite a real, resolvable location with a wrong one. They're left
    missing so a later run can geocode them properly.
    """
    no_location_of_own = queryset.filter(latitude__isnull=True).filter(
        Q(is_remote=True) | Q(city='') | Q(city__iexact='unspecified')
    )
    companies = no_location_of_own.values_list('company', flat=True).distinct()
    filled = 0
    for company in companies:
        anchor = (
            Job.objects.filter(company=company, latitude__isnull=False)
            .exclude(city='')
            .values('latitude', 'longitude')
            .first()
        )
        if not anchor:
            continue
        filled += no_location_of_own.filter(company=company).update(
            latitude=anchor['latitude'], longitude=anchor['longitude'],
        )
    return filled


# ------------------------------------------------------------------
# Entry point
# ------------------------------------------------------------------
def run(company=None, stop_event=None):
    """Returns (resolved, borrowed, remaining, rate_limited, stopped).
    rate_limited means Nominatim started rejecting requests with 429s
    partway through; stopped means stop_event was set. Either way,
    `remaining` may include jobs that would resolve fine on a later retry —
    callers should not treat them as permanently ungeocodable."""
    queryset = Job.objects.all()
    if company:
        queryset = queryset.filter(company__iexact=company)

    resolved = rate_limited = stopped = None
    for item in geocode_real_locations(queryset, stop_event=stop_event):
        if isinstance(item, tuple):
            resolved, rate_limited, stopped = item
    # Borrowing from a company sibling is a pure DB operation (no Nominatim
    # call), so it's safe to run even when the real-location pass got rate
    # limited or stopped.
    borrowed = fill_remote_from_company(queryset)
    remaining = queryset.filter(latitude__isnull=True).count()
    return resolved, borrowed, remaining, rate_limited, stopped


def run_streaming(company=None, stop_event=None):
    """Generator version of run(), for the admin dashboard's "Run Geocode"
    action and the scraper scripts' sync_board() — yields short progress
    strings as it goes (see geocode_real_locations), then finally yields a
    dict of the run's stats as the last item, mirroring the sync_board()
    generators in scripts/jobs/*.py. Callers that only want the end result
    can drain it, e.g.: *_, stats = run_streaming(company)
    """
    queryset = Job.objects.all()
    if company:
        queryset = queryset.filter(company__iexact=company)

    resolved = rate_limited = stopped = None
    for item in geocode_real_locations(queryset, stop_event=stop_event):
        if isinstance(item, tuple):
            resolved, rate_limited, stopped = item
        else:
            yield item

    borrowed = fill_remote_from_company(queryset)
    if borrowed:
        yield f"Borrowed coordinates for {borrowed} remote job(s) from a company sibling"

    remaining = queryset.filter(latitude__isnull=True).count()
    yield {
        'geocoded': resolved, 'borrowed': borrowed, 'remaining': remaining,
        'rate_limited': rate_limited, 'stopped': stopped,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--company', help='Limit to jobs at this company (case-insensitive)')
    args = parser.parse_args()

    resolved, borrowed, remaining, rate_limited, stopped = run(company=args.company)
    print(
        f"Geocoded {resolved} job(s) by location, borrowed coordinates for "
        f"{borrowed} remote job(s) from a company sibling; {remaining} still missing."
    )
    if rate_limited:
        print("Nominatim started rate-limiting (HTTP 429) partway through — stopped early. Retry later.")
