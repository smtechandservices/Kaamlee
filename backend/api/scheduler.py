"""Background scheduler that keeps company job boards from going stale
without an admin having to trigger scripts/jobs/*.py by hand.

Every tick (see auto_scrape_job):
  1. Skip if a scraper script is already running — either an admin-triggered
     run from the dashboard (RunScraperScriptView) or a previous tick that's
     still going. api.views._run_registry is the single source of truth for
     "what's running" for both.
  2. Otherwise, look at every active Company whose career_url matches one of
     the five ATSes scripts/jobs/*.py knows how to scrape, and find the one
     that's gone longest without a sync (oldest last_scraped_at, never-
     scraped first). Its ATS becomes this tick's script.
  3. Run that script for the 3 most-overdue companies on the same ATS —
     not just the single stalest one, so one tick makes a dent in that
     ATS's backlog instead of trickling one company at a time.

Wired up once from ApiConfig.ready() (see apps.py) via start().
"""
import fcntl
import logging
import re
import threading

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

LOCK_FILE = '/tmp/kaamlee_autoscrape.lock'
INTERVAL_MINUTES = 30
BATCH_SIZE = 3

# Maps a Company's career_url to (script, board slug) for one of the
# scripts/jobs/*.py scrapers — the same five RunScraperScriptView.SCRIPTS
# exposes on the admin dashboard, so a company only ever gets auto-scraped
# if an admin could also have targeted it by hand. Anything else (a bespoke
# careers page, a dead link, an ATS not in this list, ...) is left alone.
_ATS_PATTERNS = [
    ('greenhouse', re.compile(r'(?:boards|job-boards)\.greenhouse\.io/([^/?#]+)', re.I)),
    ('lever', re.compile(r'jobs\.lever\.co/([^/?#]+)', re.I)),
    ('ashbyhq', re.compile(r'jobs\.ashbyhq\.com/([^/?#]+)', re.I)),
    ('workable', re.compile(r'apply\.workable\.com/([^/?#]+)', re.I)),
    ('recruitee', re.compile(r'([a-z0-9-]+)\.recruitee\.com', re.I)),
]


def _detect_ats(career_url):
    for script, pattern in _ATS_PATTERNS:
        match = pattern.search(career_url or '')
        if match:
            return script, match.group(1)
    return None


def _pick_batch(Company):
    """Returns (script, [(board_slug, company_name), ...]) for the most
    overdue ATS, or (None, []) if there's nothing recognizable to scrape.

    The board slug (from the URL) and Company.name usually match, but not
    always — e.g. a career_url of asvz.recruitee.com next to a Company.name
    of "ASVZ Sports Association" — so both travel together as a pair rather
    than assuming run_many() can derive one from the other.
    """
    candidates = []
    for company in Company.objects.filter(is_active=True).exclude(career_url=''):
        detected = _detect_ats(company.career_url)
        if detected:
            script, slug = detected
            candidates.append((script, slug, company))

    if not candidates:
        return None, []

    # Never-scraped (None) sorts before any real timestamp; ties break by
    # whichever this loop happened to see first, which is fine — there's no
    # meaningful tiebreaker between two companies with the same timestamp.
    candidates.sort(key=lambda c: (c[2].last_scraped_at is not None, c[2].last_scraped_at))
    script = candidates[0][0]
    batch = [(slug, company.name) for s, slug, company in candidates if s == script][:BATCH_SIZE]
    return script, batch


def auto_scrape_job():
    import importlib

    from .models import Company
    from .views import _run_registry

    # OS-level file lock — guards against multiple worker processes (e.g. a
    # multi-worker gunicorn deployment) each running their own copy of this
    # scheduler and firing the same tick concurrently. Held only long enough
    # to decide-and-launch, not for the run's duration — same as the actual
    # "is something running" guard below, which is what stays true for as
    # long as the run itself takes.
    lock_fd = open(LOCK_FILE, 'w')
    try:
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            logger.info("[AutoScrape] Another worker already handling this tick — skipping.")
            return

        if _run_registry.list():
            logger.info("[AutoScrape] A scraper script is already running — skipping this tick.")
            return

        script, batch = _pick_batch(Company)
        if not batch:
            logger.info("[AutoScrape] No stale companies with a recognized ATS board — nothing to do.")
            return

        # Reserve every board before launching anything — mirrors
        # RunScraperScriptView, and means a board an admin happens to be
        # running by hand right now is skipped rather than double-run.
        stop_events = {}
        reserved = []
        for slug, company_name in batch:
            stop_event = _run_registry.start(slug, script)
            if stop_event is None:
                continue
            reserved.append((slug, company_name))
            stop_events[slug.lower()] = stop_event

        if not reserved:
            logger.info("[AutoScrape] Every candidate board is already running — skipping this tick.")
            return

        logger.info(f"[AutoScrape] Running {script} for {[name for _, name in reserved]}")
        run_many = importlib.import_module(f'scripts.jobs.{script}').run_many

        def _run():
            try:
                run_many(
                    reserved, stop_events=stop_events,
                    on_log=lambda board, message: logger.info(f"[AutoScrape][{script}:{board}] {message}"),
                )
            except Exception:
                logger.exception(f"[AutoScrape] {script} run failed")
            finally:
                for slug, _ in reserved:
                    _run_registry.finish(slug)

        threading.Thread(target=_run, daemon=True).start()
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()


def start():
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        auto_scrape_job,
        trigger="interval",
        minutes=INTERVAL_MINUTES,
        id="auto_scrape",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"[AutoScrape] Scheduler started — fires every {INTERVAL_MINUTES} minutes.")
