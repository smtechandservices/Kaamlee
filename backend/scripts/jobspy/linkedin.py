"""LinkedIn jobs via JobSpy -> JSON.

Coverage: worldwide. LinkedIn rate-limits quickly (around page 10 per IP), so
keep RESULTS small.
Limit: only ONE of HOURS_OLD | EASY_APPLY per search.

Edit the inputs below, then run from the backend folder (venv active):
    python scripts/jobspy/linkedin.py > linkedin.json
"""
try:
    from ._common import SearchError, check_hours_old, cli, run
except ImportError:  # run directly as a script
    from _common import SearchError, check_hours_old, cli, run

SITE = "linkedin"

# ---- inputs (used when you run this file directly) ---------------------------
ROLE = ""                  # e.g. "python developer"
LOCATION = ""              # e.g. "Dubai, United Arab Emirates" ("" = anywhere)
DISTANCE = 50              # miles around LOCATION
JOB_TYPE = None            # None, "fulltime", "parttime", "internship", "contract"
REMOTE = False
EASY_APPLY = False         # only LinkedIn Easy Apply jobs
HOURS_OLD = None           # e.g. 24 = posted in the last 24 hours (max 168 = a week)
RESULTS = 5
OFFSET = 0                 # start from the Nth result
FETCH_DESCRIPTION = False  # full description + direct apply URL (one extra request per job)
COMPANY_IDS = []           # LinkedIn numeric company IDs, e.g. [1441]
ANNUAL_SALARY = False      # convert hourly/monthly pay to yearly
# ------------------------------------------------------------------------------


def search(role=None, location=None, distance=50, job_type=None, remote=False, easy_apply=False,
           hours_old=None, results=5, offset=0, fetch_description=False, company_ids=None,
           annual_salary=False):
    if not role:
        raise SearchError("Enter a role / keywords.")
    check_hours_old(hours_old)
    if hours_old and easy_apply:
        raise SearchError("LinkedIn allows only one of: posted within, easy apply.")
    return run(
        SITE, "LinkedIn",
        search_term=role, location=location or None, distance=distance, job_type=job_type,
        is_remote=remote, easy_apply=easy_apply or None, hours_old=hours_old, results_wanted=results,
        offset=offset or None, linkedin_fetch_description=fetch_description,
        linkedin_company_ids=company_ids or None, enforce_annual_salary=annual_salary,
    )


if __name__ == "__main__":
    cli(search, role=ROLE, location=LOCATION, distance=DISTANCE, job_type=JOB_TYPE, remote=REMOTE,
        easy_apply=EASY_APPLY, hours_old=HOURS_OLD, results=RESULTS, offset=OFFSET,
        fetch_description=FETCH_DESCRIPTION, company_ids=COMPANY_IDS, annual_salary=ANNUAL_SALARY)
