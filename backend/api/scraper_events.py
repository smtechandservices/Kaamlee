"""Publishes scraper run events (start/log/finish/stop) to any admin
currently connected to the live-status WebSocket (see api/consumers.py).

_RunRegistry (api/views.py) is the single choke point both the
admin-triggered run path (RunScraperScriptView) and the 5-minute
auto-scrape scheduler (api/scheduler.py) already go through, so wiring the
broadcast in there — rather than into scripts/jobs/*.py or scheduler.py
directly — makes every run visible over the socket for free.

Safe to call with nobody connected (group_send to an empty group is a
no-op) and safe to call before Channels is fully configured for whatever
reason (get_channel_layer() returning None).
"""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

GROUP = 'scraper_runs'


def publish_scraper_event(payload: dict):
    layer = get_channel_layer()
    if layer is None:
        return
    async_to_sync(layer.group_send)(GROUP, {'type': 'scraper.event', 'payload': payload})
