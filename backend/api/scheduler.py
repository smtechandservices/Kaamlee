import fcntl
import threading
import time

from apscheduler.schedulers.background import BackgroundScheduler
from django.utils import timezone

LOCK_FILE = '/tmp/kaamlee_autoscrape.lock'

def auto_scrape_job():
    from .models import ScrapeSession
    from django.core.cache import cache
    from scripts.job_scraper import run_random_companies_scraping, log_to_db

    # OS-level file lock — only one process across all workers proceeds per tick
    lock_fd = open(LOCK_FILE, 'w')
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("[AutoScrape] Another worker already handling this tick — skipping.")
        lock_fd.close()
        return

    try:
        if ScrapeSession.objects.filter(status='running').exists():
            print("[AutoScrape] Already running — skipping.")
            return

        print("[AutoScrape] Triggering career-page scrape for 10 random companies")
        session = ScrapeSession.objects.create(status='running', search_term='company_career_pages:auto', results_limit=0)

        def _run():
            log_to_db(session, "Auto-scrape: starting career-page scrape for 10 random companies", "success")
            try:
                run_random_companies_scraping(count=10, session=session)
                session.status = 'completed'
            except Exception as e:
                session.status = 'failed'
                session.error_message = str(e)
            session.current_location = None
            session.end_time = timezone.now()
            try:
                session.save()
            except Exception:
                # A stuck 'running' session blocks every future scrape attempt,
                # so retry once after a beat rather than leaving it wedged on a
                # transient DB lock (SQLite has only one writer at a time).
                time.sleep(2)
                session.save()
            cache.delete('api_stats')
            cache.delete('api_countries')

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()


def start():
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        auto_scrape_job,
        trigger="interval",
        minutes=5,
        id="auto_scrape",
        replace_existing=True,
    )
    scheduler.start()
    print("[AutoScrape] Scheduler started — fires every 5 minutes.")
