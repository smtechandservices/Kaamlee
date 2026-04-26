from celery import shared_task
from .scraper import run_dynamic_scrape
from .models import Job, SearchQuery
from datetime import timedelta
from django.utils import timezone

@shared_task
def trigger_scrape_for_query(query):
    return run_dynamic_scrape(query, results_wanted=10)

@shared_task
def scrape_jobs_daily():
    recent_queries = SearchQuery.objects.filter(last_scraped_at__gte=timezone.now() - timedelta(days=7))
    total_saved = sum([run_dynamic_scrape(sq.query, 5) for sq in recent_queries])
    return f"Daily Scrape finished: Added {total_saved} total jobs"

@shared_task
def clean_expired_jobs():
    active_jobs = Job.objects.filter(is_expired=False)
    expired_count = 0
    for job in active_jobs:
        if (timezone.now() - job.created_at) > timedelta(days=30):
            job.is_expired = True
            job.save()
            expired_count += 1
    return f"Cleaned {expired_count} expired jobs."
