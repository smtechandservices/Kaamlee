"""Shared helpers for the JobSpy scripts (not a script itself).

Each site script (indeed.py, linkedin.py, bayt.py) has a search() that calls
run(); combined.py mixes them and is what the admin JobSpy page runs.
"""
import json
import logging
import sys
import time

from jobspy import scrape_jobs

# Exact spellings JobSpy accepts for Indeed's country.
COUNTRIES = [
    "Argentina", "Australia", "Austria", "Bahrain", "Belgium", "Brazil", "Canada", "Chile",
    "China", "Colombia", "Costa Rica", "Czech Republic", "Denmark", "Ecuador", "Egypt",
    "Finland", "France", "Germany", "Greece", "Hong Kong", "Hungary", "India", "Indonesia",
    "Ireland", "Israel", "Italy", "Japan", "Kuwait", "Luxembourg", "Malaysia", "Mexico",
    "Morocco", "Netherlands", "New Zealand", "Nigeria", "Norway", "Oman", "Pakistan", "Panama",
    "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Saudi Arabia",
    "Singapore", "South Africa", "South Korea", "Spain", "Sweden", "Switzerland", "Taiwan",
    "Thailand", "Turkey", "Ukraine", "United Arab Emirates", "UK", "USA", "Uruguay",
    "Venezuela", "Vietnam",
]


JOB_TYPES = ["fulltime", "parttime", "internship", "contract"]
MAX_HOURS_OLD = 168  # jobs are never older than a week


class SearchError(ValueError):
    """Bad input for a search — the message is safe to show an admin."""


def check_country(country):
    if country not in COUNTRIES:
        raise SearchError(f"{country!r} isn't an Indeed country. Use one of: {', '.join(COUNTRIES)}")


def check_hours_old(hours_old):
    if hours_old is not None and not 1 <= hours_old <= MAX_HOURS_OLD:
        raise SearchError(f"Posted within must be 1–{MAX_HOURS_OLD} hours (at most a week).")


class _Collector(logging.Handler):
    """Captures JobSpy's warnings/errors for one site during a search, so the
    caller can see *why* nothing came back (e.g. a 403) instead of just 0 jobs."""

    def __init__(self):
        super().__init__(level=logging.WARNING)
        self.messages = []

    def emit(self, record):
        self.messages.append(record.getMessage())


def run(site, logger_name, **kwargs):
    """Scrape one site. None-valued arguments aren't passed, so JobSpy's own
    defaults apply. Returns {"site", "jobs", "errors", "seconds"}."""
    kwargs = {k: v for k, v in kwargs.items() if v is not None}
    logger = logging.getLogger(f"JobSpy:{logger_name}")
    collector = _Collector()
    logger.addHandler(collector)
    started = time.monotonic()
    try:
        # verbose=1 = warnings + errors. With 0 JobSpy raises its loggers to
        # ERROR, so warnings like Google's "initial cursor not found" (the only
        # hint of why a search came back empty) never reach the collector.
        frame = scrape_jobs(site_name=site, description_format="markdown", verbose=1, **kwargs)
    finally:
        logger.removeHandler(collector)
    # to_json handles NaN -> null and dates -> ISO strings.
    jobs = json.loads(frame.to_json(orient="records", date_format="iso")) if not frame.empty else []
    return {"site": site, "jobs": jobs, "errors": collector.messages,
            "seconds": round(time.monotonic() - started, 1)}


def cli(search, **inputs):
    """Entry point for running a site script directly: prints the jobs as JSON
    on stdout; problems go to stderr."""
    try:
        result = search(**inputs)
    except SearchError as e:
        sys.exit(str(e))
    for message in result["errors"]:
        print(f"[{result['site']}] {message}", file=sys.stderr)
    print(json.dumps(result["jobs"], indent=2))
