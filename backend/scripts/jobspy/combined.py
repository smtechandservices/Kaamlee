"""Mixed job search across the three working JobSpy sites -> JSON.

Searches Indeed, LinkedIn and Bayt at the same time, pools everything they
return (duplicates removed) and returns TOTAL_RESULTS (10) jobs picked at
random from that pool — a different mix on every run. You only set role,
location, country and job type:
  - remote and on-site jobs are both included (no remote filter is sent)
  - easy-apply and regular jobs are both included (no easy-apply filter is sent)
  - LinkedIn jobs come with the full description
  - only jobs posted in the last week (MAX_HOURS_OLD = 168h). LinkedIn and
    Indeed filter that themselves — except Indeed when a job type is set, as it
    can't combine the two — and anything older is dropped after fetching
  - Bayt only runs for Gulf / Middle East countries: it has no location filter,
    so anywhere else it would return unrelated jobs. The city is added to its
    keyword instead (e.g. "python developer Dubai"). Bayt can't filter by job
    type either.

Each job has a "site" field saying where it came from.

Edit the inputs below, then run from the backend folder (venv active):
    python scripts/jobspy/combined.py > jobs.json
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
import json
import random
import sys
import time

try:
    from . import bayt, indeed, linkedin
    from ._common import JOB_TYPES, MAX_HOURS_OLD, SearchError, check_country
except ImportError:  # run directly as a script
    import bayt
    import indeed
    import linkedin
    from _common import JOB_TYPES, MAX_HOURS_OLD, SearchError, check_country

# ---- inputs -------------------------------------------------------------------
ROLE = ""                          # e.g. "python developer"
LOCATION = ""                      # city, e.g. "Dubai" ("" = whole country)
COUNTRY = "United Arab Emirates"   # exact name from COUNTRIES in _common.py, e.g. "India", "USA", "UK"
JOB_TYPE = None                    # None (any), "fulltime", "parttime", "internship" or "contract"
# -------------------------------------------------------------------------------

TOTAL_RESULTS = 14  # jobs returned per search, picked at random from all sites' results
PER_SITE = 10       # asked from each site, so the pool still fills up if one site has few

# Countries Bayt covers (of the ones JobSpy/Indeed accept).
BAYT_COUNTRIES = {"United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Oman", "Bahrain", "Egypt", "Morocco"}


def search(role=None, location=None, country="USA", job_type=None, per_site=None, total=None):
    """Returns {"jobs": [...], "errors": {site: [...]}, "counts": {site: n}, "seconds": n}.
    per_site / total override PER_SITE / TOTAL_RESULTS — the admin JobSpy
    feeder (api/jobspy_feed.py) asks for more and keeps everything."""
    per_site = per_site or PER_SITE
    total = total or TOTAL_RESULTS
    if not role:
        raise SearchError("Enter a role / keywords.")
    check_country(country)
    if job_type and job_type not in JOB_TYPES:
        raise SearchError(f"Job type must be one of: {', '.join(JOB_TYPES)} (or None for any).")
    location = (location or "").strip() or None

    # Only role / location / country / job type (+ the one-week limit) are sent,
    # so remote + on-site and easy-apply + regular jobs all come back.
    # Indeed can't combine an age limit with a job type, so with a job type set
    # its results are age-filtered after fetching instead (like Bayt's).
    indeed_hours = None if job_type else MAX_HOURS_OLD
    searches = {
        "linkedin": lambda: linkedin.search(
            role=role,
            location=", ".join(p for p in (location, country) if p),
            job_type=job_type,
            hours_old=MAX_HOURS_OLD,
            results=per_site,
            fetch_description=True,
        ),
        "indeed": lambda: indeed.search(
            role=role, location=location, country=country, job_type=job_type, hours_old=indeed_hours,
            results=per_site,
        ),
    }
    if country in BAYT_COUNTRIES:
        searches["bayt"] = lambda: bayt.search(role=f"{role} {location}" if location else role, results=per_site)
    # Sites whose own search already applied the age limit.
    age_filtered_by_site = {"linkedin": True, "indeed": indeed_hours is not None, "bayt": False}

    started = time.monotonic()
    results, errors = {}, {}
    with ThreadPoolExecutor(max_workers=len(searches)) as pool:
        futures = {site: pool.submit(fn) for site, fn in searches.items()}
        for site, future in futures.items():
            try:
                result = future.result()
                results[site] = result["jobs"]
                if result["errors"]:
                    errors[site] = result["errors"]
            except Exception as e:  # one site failing shouldn't sink the others
                results[site] = []
                errors[site] = [str(e)]

    # Nothing older than a week. Dates are day-precision, so compare days. A job
    # with no date is kept only if its site already applied the limit itself.
    cutoff = datetime.now(timezone.utc).date() - timedelta(hours=MAX_HOURS_OLD)

    def recent(job, site):
        posted = job.get("date_posted")
        if not posted:
            return age_filtered_by_site.get(site, False)
        try:
            return date.fromisoformat(str(posted)[:10]) >= cutoff
        except ValueError:
            return age_filtered_by_site.get(site, False)

    # Pool every site's recent jobs (skipping duplicate URLs), then pick
    # TOTAL_RESULTS at random — or all of them if the pool is smaller.
    pool, seen = [], set()
    for site in searches:
        for job in results[site]:
            key = job.get("job_url") or job.get("id")
            if key not in seen and recent(job, site):
                seen.add(key)
                pool.append(job)
    mixed = random.sample(pool, min(total, len(pool)))

    return {
        "jobs": mixed,
        "errors": errors,
        "counts": {site: sum(1 for j in mixed if j.get("site") == site) for site in searches},
        "seconds": round(time.monotonic() - started, 1),
    }


def main():
    try:
        result = search(role=ROLE, location=LOCATION, country=COUNTRY, job_type=JOB_TYPE)
    except SearchError as e:
        sys.exit(str(e))
    for site, messages in result["errors"].items():
        for message in messages:
            print(f"[{site}] {message}", file=sys.stderr)
    mix = ", ".join(f"{site} {n}" for site, n in result["counts"].items())
    print(f"{len(result['jobs'])} jobs in {result['seconds']}s ({mix})", file=sys.stderr)
    print(json.dumps(result["jobs"], indent=2))


if __name__ == "__main__":
    main()
