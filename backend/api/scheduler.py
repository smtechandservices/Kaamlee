import json
import os
import random
import threading

from apscheduler.schedulers.background import BackgroundScheduler
from django.conf import settings


def auto_scrape_job():
    from .models import ScrapeSession
    from .scraper_utils import run_parallel_role_scraping

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
    terms = roles[:random.randint(1, 3)]

    print(f"[AutoScrape] Triggering scrape for: {terms}")
    thread = threading.Thread(
        target=run_parallel_role_scraping,
        args=(terms, 5, None),
        daemon=True,
    )
    thread.start()


def start():
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        auto_scrape_job,
        trigger="interval",
        minutes=2,
        id="auto_scrape",
        replace_existing=True,
    )
    scheduler.start()
    print("[AutoScrape] Scheduler started — fires every 2 minutes.")
