"""
ASGI config for backend project.

Routes plain HTTP to Django as usual, and `/ws/` websocket connections to
Channels — currently just the scraper's live-status feed (see
api/consumers.py, api/routing.py). Websocket auth is handled inside the
consumer itself (token query param, matching the admin frontend's existing
DRF TokenAuthentication) rather than via Channels' AuthMiddlewareStack, since
that stack expects a session cookie and the admin app doesn't use one.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# Must be created before importing anything that touches Django models
# (api.routing -> api.consumers -> api.models), same reasoning as
# Channels' own "starlette-first" ASGI guidance.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from api.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': URLRouter(websocket_urlpatterns),
})
