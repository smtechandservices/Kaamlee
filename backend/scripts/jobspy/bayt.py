"""Bayt jobs via JobSpy -> JSON.

Coverage: Middle East & Gulf (UAE, Saudi Arabia, Qatar, Kuwait, Oman, Bahrain,
Egypt, Jordan, …). JobSpy's Bayt scraper only takes a keyword — no location
filter — so put the place in the role itself (e.g. "python developer dubai").

Edit the inputs below, then run from the backend folder (venv active):
    python scripts/jobspy/bayt.py > bayt.json
"""
import time
from datetime import datetime, timezone

import jobspy.bayt
import requests
from jobspy.model import JobPost, Location
from jobspy.util import create_session

try:
    from ._common import SearchError, cli, run
except ImportError:  # run directly as a script
    from _common import SearchError, cli, run

SITE = "bayt"

# ---- inputs (used when you run this file directly) ---------------------------
ROLE = ""                  # e.g. "python developer" or "python developer dubai"
RESULTS = 5
# ------------------------------------------------------------------------------


def search(role=None, results=5):
    if not role:
        raise SearchError("Enter a role / keywords.")
    return run(SITE, "Bayt", search_term=role, results_wanted=results)


# --- Bayt fix -----------------------------------------------------------------
# JobSpy's Bayt scraper gets 403 from Bayt's bot protection (plain requests
# session, no headers) and parses Bayt's old page layout. Swap in a Chrome-like
# TLS session + headers, retry a 403 on a fresh connection, and read the current layout.
# Only affects the Bayt scraper; JobSpy itself is untouched.
_HEADERS = {
    # Chrome 120 to match tls_client's chrome_120 fingerprint (mismatches get blocked more).
    "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


_ATTEMPTS = 5  # per page; at ~1-in-3 blocked connections, all 5 failing is ~0.4%


def _new_session(kwargs):
    session = create_session(**{**kwargs, "is_tls": True})
    session.headers.update(_HEADERS)
    return session


def _browser_like_session(**kwargs):
    session = _new_session(kwargs)
    current = {"get": session.get}  # plain get of the connection in use

    def get(*args, **kw):
        for _ in range(_ATTEMPTS):
            response = current["get"](*args, **kw)
            if response.status_code != 403:
                break
            # Bayt judges each new connection's TLS fingerprint, which tls_client
            # randomises per session: about 1 in 3 new connections gets 403,
            # and a blocked one stays blocked. So retry on a fresh connection
            # rather than the same one. (A fixed fingerprint is blocked every time.)
            current["get"] = _new_session(kwargs).get
            time.sleep(1)
        if not hasattr(response, "raise_for_status"):  # tls_client responses lack it
            def raise_for_status():
                if response.status_code >= 400:
                    raise requests.HTTPError(f"{response.status_code} Error for url: {response.url}")
            response.raise_for_status = raise_for_status
        return response

    session.get = get
    return session


def _extract_job_info(self, job):
    heading = job.find("h2")
    link = heading.find("a", href=True) if heading else None
    if not link:
        return None
    job_url = self.base_url + link["href"].strip()

    company_tag = job.select_one(".job-company-location-wrapper > div")
    place_tag = job.select_one("dt.jb-label-location")
    parts = [s.get_text(strip=True) for s in place_tag.find_all("span")] if place_tag else []

    summary_tag = job.select_one(".jb-descr")
    if summary_tag and summary_tag.find("span"):
        summary_tag.find("span").extract()  # drop the "Summary:" label

    # "Yesterday" / "3 days ago" on the card; the exact time is a Unix timestamp
    # in data-automation-jobactivedate.
    date_posted = None
    date_tag = job.select_one('[data-automation-id="job-active-date"]')
    if date_tag and date_tag.get("data-automation-jobactivedate", "").isdigit():
        date_posted = datetime.fromtimestamp(int(date_tag["data-automation-jobactivedate"]), tz=timezone.utc).date()

    return JobPost(
        id=f"bayt-{job.get('data-job-id') or abs(hash(job_url))}",
        title=heading.get_text(strip=True),
        company_name=company_tag.get_text(strip=True) if company_tag else None,
        location=Location(city=parts[0] if len(parts) > 1 else None, country=parts[-1] if parts else None),
        job_url=job_url,
        date_posted=date_posted,
        description=summary_tag.get_text(" ", strip=True) if summary_tag else None,
    )


jobspy.bayt.create_session = _browser_like_session
jobspy.bayt.BaytScraper._extract_job_info = _extract_job_info
# ------------------------------------------------------------------------------


if __name__ == "__main__":
    cli(search, role=ROLE, results=RESULTS)
