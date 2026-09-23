from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework.authtoken.models import Token

GROUP = 'scraper_runs'


class ScraperConsumer(AsyncJsonWebsocketConsumer):
    """Live feed for the admin's scraper page — every event _RunRegistry
    (api/views.py) records (run start/stop, log lines, results) for both an
    admin-triggered run and the 5-minute auto-scrape scheduler tick
    (api/scheduler.py), pushed as it happens instead of the old
    RunScriptStatusView polling.

    Auth: the admin frontend authenticates via DRF TokenAuthentication (an
    Authorization header), which a browser WebSocket handshake can't send —
    so the token travels as a query param instead (`?token=...`) and is
    checked here against the same Token model AdminLoginView issues from,
    restricted the same way (superusers only, matching AdminLoginView).
    """

    async def connect(self):
        query = parse_qs(self.scope['query_string'].decode())
        token_key = (query.get('token') or [None])[0]
        user = await self._authenticate(token_key)
        if user is None:
            await self.close(code=4401)
            return

        self.group_name = GROUP
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # A fresh connection (page load, or a reconnect after a network
        # blip) should see runs already in flight — including their logs
        # so far, not just board/script/started_at — and the current pause
        # state, not just events from this point forward.
        from .views import _run_registry
        paused = await self._is_paused()
        await self.send_json({'type': 'snapshot', 'runs': _run_registry.snapshot(), 'paused': paused})

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Dispatched by Channels for every {'type': 'scraper.event', ...} message
    # sent to this group (see api/scraper_events.py) — the dot in 'type'
    # maps to this underscored method name by Channels' own convention.
    async def scraper_event(self, event):
        await self.send_json(event['payload'])

    @database_sync_to_async
    def _authenticate(self, token_key):
        if not token_key:
            return None
        try:
            token = Token.objects.select_related('user').get(key=token_key)
        except Token.DoesNotExist:
            return None
        return token.user if token.user.is_superuser else None

    @database_sync_to_async
    def _is_paused(self):
        from .models import ScraperPauseState
        return ScraperPauseState.get_solo().is_paused
