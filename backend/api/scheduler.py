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

Wired up once from ApiConfig.ready() (see apps.py) via start(). Under
gunicorn, ready() runs independently in every worker process, so start()
elects a single leader worker (see _become_leader) and only that worker's
process ever creates a BackgroundScheduler — the other workers' calls to
start() are no-ops. This is what keeps the auto-scrape tick, and everything
it launches, confined to one worker instead of firing once per worker.
"""
import fcntl
import logging
import os
import re
import threading

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

LEADER_LOCK_FILE = '/tmp/kaamlee_autoscrape_leader.lock'
INTERVAL_MINUTES = 5
BATCH_SIZE = 3

# Held open for the lifetime of the process if this worker wins leadership —
# closing it (or letting it get garbage-collected) would release the flock.
_leader_lock_fd = None


def _become_leader():
    """Tries to claim this process as the sole worker allowed to run the
    auto-scrape scheduler. Returns True at most once per machine at a time:
    the lock is exclusive, non-blocking, and — unlike a per-tick lock — held
    for as long as this process lives, not just for a single decide-and-
    launch moment. Losing workers get False and simply never start a
    scheduler, so there's nothing for their copy of auto_scrape_job to race
    against in the first place.
    """
    global _leader_lock_fd
    fd = open(LEADER_LOCK_FILE, 'w')
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        fd.close()
        return False
    _leader_lock_fd = fd  # keep alive so the flock isn't released
    return True

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
    ('epam', re.compile(r'(careers\.epam\.com)', re.I)),
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

    from django.utils import timezone

    from .models import Company, ScraperRun
    from .views import _run_registry

    if _run_registry.list():
        logger.info("[AutoScrape] A scraper script is already running — skipping this tick.")
        return

    script, batch = _pick_batch(Company)
    if not batch:
        logger.info("[AutoScrape] No stale companies with a recognized ATS board — nothing to do.")
        return

    # Reserve every board before launching anything — mirrors
    # RunScraperScriptView, and means a board an admin happens to be
    # running by hand right now is skipped rather than double-run. Each
    # reservation also gets a ScraperRun row (triggered_by='scheduler') so
    # these ticks show up in the dashboard's Active Runs card and leave a
    # history behind, same as an admin-triggered run.
    stop_events = {}
    reserved = []
    runs = {}
    for slug, company_name in batch:
        stop_event = _run_registry.start(slug, script)
        if stop_event is None:
            continue
        reserved.append((slug, company_name))
        stop_events[slug.lower()] = stop_event
        runs[slug.lower()] = ScraperRun.objects.create(
            script=script, board=slug, company_name=company_name, triggered_by='scheduler',
        )

    if not reserved:
        logger.info("[AutoScrape] Every candidate board is already running — skipping this tick.")
        return

    logger.info(f"[AutoScrape] Running {script} for {[name for _, name in reserved]}")
    run_many = importlib.import_module(f'scripts.jobs.{script}').run_many

    def on_result(board, result):
        run = runs.get(board.strip().lower())
        if run is None:
            return
        run.status = 'stopped' if result.get('stopped') else ('success' if result.get('ok') else 'failed')
        run.finished_at = timezone.now()
        for field in ('fetched', 'created', 'updated', 'geocoded', 'borrowed', 'removed'):
            setattr(run, field, result.get(field) or 0)
        run.error = result.get('error') or ''
        run.save()

    def _run():
        try:
            run_many(
                reserved, stop_events=stop_events, on_result=on_result,
                on_log=lambda board, message: logger.info(f"[AutoScrape][{script}:{board}] {message}"),
            )
        except Exception:
            logger.exception(f"[AutoScrape] {script} run failed")
        finally:
            for slug, _ in reserved:
                _run_registry.finish(slug)
            # Belt-and-suspenders, matching RunScraperScriptView: covers a
            # run_many failure that never reached on_result for some board.
            for run in runs.values():
                if run.status == 'running':
                    run.status = 'failed'
                    run.finished_at = timezone.now()
                    run.error = run.error or 'Run ended unexpectedly without reporting a result.'
                    run.save()

    threading.Thread(target=_run, daemon=True).start()


def _reconcile_stale_runs():
    """A ScraperRun still marked 'running' when this process boots can only
    mean the process that owned it (this worker or a previous one) died —
    crash, deploy, restart — before its thread ever reached the code that
    marks it finished. There's no thread anywhere that could still complete
    it, and a fresh process's _run_registry starts out empty, so the
    dashboard's Stop button has nothing to act on for it either — left
    alone, it haunts the Active Runs card forever. Mark it failed so it
    clears out and the board it was on is free to be picked up again.
    """
    from django.utils import timezone

    from .models import ScraperRun

    count = ScraperRun.objects.filter(status='running').update(
        status='failed', finished_at=timezone.now(),
        error='Run interrupted — server restarted while this was in progress.',
    )
    if count:
        logger.info(f"[AutoScrape] Marked {count} stale 'running' run(s) from a previous process as failed.")


def start():
    if not _become_leader():
        logger.info("[AutoScrape] Another worker already owns the scheduler — not starting one here.")
        return

    _reconcile_stale_runs()

    scheduler = BackgroundScheduler()
    scheduler.add_job(
        auto_scrape_job,
        trigger="interval",
        minutes=INTERVAL_MINUTES,
        id="auto_scrape",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"[AutoScrape] Scheduler started (leader worker, pid={os.getpid()}) — fires every {INTERVAL_MINUTES} minutes.")
