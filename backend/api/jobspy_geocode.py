"""Latitude/longitude for JobSpy search results (admin JobSpy page).

JobSpy only returns a location string ("Dubai, DU, AE", "Dubai, United Arab
Emirates", "Amman, Jordan"), so coordinates are looked up here, cheapest first:
  1. this process's cache (same place asked again),
  2. our own Job table — ~20k scraped jobs already geocoded, matched on city +
     country, so common cities resolve with no network call,
  3. Nominatim, through scripts/geocode_jobs.py's paced, rate-limit-aware
     helper (shared lock with the scrapers, ~2.5s per new place).
Each distinct location is resolved once per search. Jobs with no usable
location (e.g. fully remote) get latitude/longitude = None.
"""
import time

from django.db.models import Q

from .models import Job

_cache = {}  # location string -> (lat, lng) or None, for this process's lifetime
_PLACEHOLDERS = {"", "remote", "anywhere", "worldwide", "global"}


def _parts(location):
    return [p.strip() for p in str(location).split(",") if p.strip()]


def _from_db(city, countries):
    """Coordinates of an already-geocoded job in the same city + country."""
    country_match = Q()
    for c in countries:
        country_match |= Q(country__iexact=c)
    row = (
        Job.objects.filter(city__iexact=city, latitude__isnull=False, longitude__isnull=False)
        .filter(country_match)
        .values("latitude", "longitude")
        .first()
    )
    return (row["latitude"], row["longitude"]) if row else None


def _from_nominatim(queries):
    from geopy.geocoders import Nominatim
    import scripts.geocode_jobs as geo  # paced + retrying Nominatim helper

    locator = Nominatim(user_agent="kaamlee_locations", ssl_context=geo._SSL_CONTEXT)
    for query in queries:
        result, rate_limited = geo._geocode_one(locator, query)
        if rate_limited:
            return None
        if result:
            return (result.latitude, result.longitude)
    return None


def _resolve(location, search_country):
    parts = _parts(location)
    if not parts or parts[0].lower() in _PLACEHOLDERS:
        return None
    city = parts[0]
    # The job's own country hint (last part: "AE", "UAE", "Jordan"…) plus the
    # country that was searched — sources spell countries differently.
    countries = {c for c in (parts[-1] if len(parts) > 1 else None, search_country) if c}

    point = _from_db(city, countries)
    if point:
        return point
    queries = [location]
    if search_country and len(parts) > 1:
        queries.append(f"{city}, {search_country}")  # e.g. when "DU, AE" confuses the geocoder
    return _from_nominatim(queries)


def add_coordinates(jobs, search_country=None):
    """Sets job["latitude"] / job["longitude"] in place. Returns seconds spent."""
    started = time.monotonic()
    resolved = {}  # this search: each distinct location looked up once
    for job in jobs:
        location = (job.get("location") or "").strip()
        key = location.lower()
        if key not in resolved:
            if key in _cache:
                resolved[key] = _cache[key]
            else:
                point = _resolve(location, search_country) if location else None
                resolved[key] = point
                # Cache hits, and placeholders we'll never resolve. A miss may
                # just be Nominatim rate-limiting us, so it's retried next time.
                if point or not _parts(location) or _parts(location)[0].lower() in _PLACEHOLDERS:
                    _cache[key] = point
        point = resolved[key]
        job["latitude"], job["longitude"] = point if point else (None, None)
    return round(time.monotonic() - started, 1)
