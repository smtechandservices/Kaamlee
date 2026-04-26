import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

app = Celery('backend')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Celery Beat Schedule
app.conf.beat_schedule = {
    'clean-expired-jobs-daily': {
        'task': 'job_board.tasks.clean_expired_jobs',
        'schedule': crontab(minute=0, hour=0), # Midnight every day
    },
    'scrape-jobs-daily': {
        'task': 'job_board.tasks.scrape_jobs_daily',
        'schedule': crontab(minute=0, hour=2), # 2 AM every day
    },
}
