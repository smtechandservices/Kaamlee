"""Indeed jobs via JobSpy -> JSON.

Coverage: worldwide, one country per search. The most reliable JobSpy source.
Limit: only ONE of HOURS_OLD | JOB_TYPE and/or REMOTE | EASY_APPLY per search.

Edit the inputs below, then run from the backend folder (venv active):
    python scripts/jobspy/indeed.py > indeed.json
"""
try:
    from ._common import SearchError, check_country, check_hours_old, cli, run
except ImportError:  # run directly as a script
    from _common import SearchError, check_country, check_hours_old, cli, run

SITE = "indeed"

# ---- inputs (used when you run this file directly) ---------------------------
ROLE = ""                  # e.g. "python developer"
LOCATION = ""              # city/area inside COUNTRY, e.g. "Dubai" ("" = whole country)
COUNTRY = "USA"            # exact name from COUNTRIES in _common.py, e.g. "United Arab Emirates"
DISTANCE = 50              # miles around LOCATION
JOB_TYPE = None            # None, "fulltime", "parttime", "internship", "contract"
REMOTE = False
EASY_APPLY = False         # only jobs you apply to on Indeed itself
HOURS_OLD = None           # e.g. 24 = posted in the last 24 hours (max 168 = a week)
RESULTS = 5
OFFSET = 0                 # start from the Nth result
ANNUAL_SALARY = False      # convert hourly/monthly pay to yearly
# ------------------------------------------------------------------------------


def search(role=None, location=None, country="USA", distance=50, job_type=None, remote=False,
           easy_apply=False, hours_old=None, results=5, offset=0, annual_salary=False):
    if not role:
        raise SearchError("Enter a role / keywords.")
    check_hours_old(hours_old)
    check_country(country)
    if sum([bool(hours_old), bool(job_type or remote), bool(easy_apply)]) > 1:
        raise SearchError("Indeed allows only one of: posted within, job type / remote, easy apply.")
    return run(
        SITE, "Indeed",
        search_term=role, location=location or None, country_indeed=country, distance=distance,
        job_type=job_type, is_remote=remote, easy_apply=easy_apply or None, hours_old=hours_old,
        results_wanted=results, offset=offset or None, enforce_annual_salary=annual_salary,
    )


if __name__ == "__main__":
    cli(search, role=ROLE, location=LOCATION, country=COUNTRY, distance=DISTANCE, job_type=JOB_TYPE,
        remote=REMOTE, easy_apply=EASY_APPLY, hours_old=HOURS_OLD, results=RESULTS, offset=OFFSET,
        annual_salary=ANNUAL_SALARY)
