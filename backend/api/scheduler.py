from apscheduler.schedulers.background import BackgroundScheduler
from django_apscheduler.jobstores import DjangoJobStore, register_events
from .scraper_utils import run_background_scraping
import logging

logger = logging.getLogger(__name__)

def start():
    scheduler = BackgroundScheduler()
    scheduler.add_jobstore(DjangoJobStore(), "default")

    # Run scraping every 6 hours
    scheduler.add_job(
        run_background_scraping,
        trigger="interval",
        hours=6,
        id="run_background_scraping_job",
        max_instances=1,
        replace_existing=True,
    )
    
    # Also run once on startup (optional, maybe too heavy if many places)
    # scheduler.add_job(run_background_scraping, id="startup_scrape", replace_existing=True)

    register_events(scheduler)
    scheduler.start()
    logger.info("Scheduler started...")
