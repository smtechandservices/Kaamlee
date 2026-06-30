import fcntl
import json
import os
import random
import threading

from apscheduler.schedulers.background import BackgroundScheduler
from django.conf import settings

LOCK_FILE = '/tmp/kaamlee_autoscrape.lock'


def auto_scrape_job():
    from .models import ScrapeSession
    from .scraper_utils import run_parallel_role_scraping

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

        roles_path = os.path.join(settings.BASE_DIR, 'api', 'roles.json')
        try:
            with open(roles_path) as f:
                roles = json.load(f)
        except Exception as e:
            print(f"[AutoScrape] Could not load roles.json: {e}")
            return

        if not roles:
            return

        random.shuffle(roles)
        terms = roles[:3]

        print(f"[AutoScrape] Triggering scrape for: {terms}")
        thread = threading.Thread(
            target=run_parallel_role_scraping,
            args=(terms, 5, None),
            daemon=True,
        )
        thread.start()
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()


def start():
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        auto_scrape_job,
        trigger="interval",
        minutes=15,
        id="auto_scrape",
        replace_existing=True,
    )
    scheduler.start()
    print("[AutoScrape] Scheduler started — fires every 15 minutes.")
