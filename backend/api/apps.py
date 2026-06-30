import os
from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        import sys

        # Skip during management commands that don't serve HTTP
        no_scheduler_cmds = {
            'migrate', 'makemigrations', 'shell', 'test',
            'collectstatic', 'check', 'createsuperuser',
            'dbshell', 'dumpdata', 'loaddata', 'flush',
        }
        if sys.argv[1:2] and sys.argv[1] in no_scheduler_cmds:
            return

        # Dev server calls ready() twice (reloader + worker).
        # Only start in the actual worker process where RUN_MAIN=true.
        if 'runserver' in sys.argv and os.environ.get('RUN_MAIN') != 'true':
            return

        from . import scheduler
        scheduler.start()



