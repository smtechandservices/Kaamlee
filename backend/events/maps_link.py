"""Resolve a Google Maps share link an ambassador/admin pastes (a
maps.app.goo.gl short link, or a full google.com/maps/place/... URL) into
(latitude, longitude), so the event can be pinned on our own map.

We can't just <iframe> the pasted Google Maps URL itself — Google's Maps
pages (short link redirect target included) send `X-Frame-Options:
SAMEORIGIN`, so browsers refuse to render them in a frame on our origin, and
the old keyless "output=embed" trick is dead (404s); the real Maps Embed API
requires a billed API key we don't have. Instead we follow the link's
redirect — Google encodes the exact pin as `!3d<lat>!4d<lng>` (falling back
to the `@<lat>,<lng>` map-center) right in the resolved URL — and plot that
point on our own MapLibre map (see EventLocationMap.tsx), while still using
the ambassador's original pasted link for the "Get Directions" button.
"""
import logging
import re

import requests

logger = logging.getLogger(__name__)

# The precise place pin, when present, is more accurate than the `@lat,lng`
# map-center coordinate (which can drift if the viewport was panned/zoomed
# before the link was shared).
_PRECISE_COORDS_RE = re.compile(r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)')
_CENTER_COORDS_RE = re.compile(r'@(-?\d+\.\d+),(-?\d+\.\d+)')

_REQUEST_TIMEOUT = 6
_HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; KaamleeBot/1.0)'}


def resolve_map_link(url):
    """Returns (latitude, longitude) or None. Never raises — a link that
    doesn't resolve or doesn't carry coordinates just means no map preview,
    not a failure to save the event."""
    if not url or not url.strip():
        return None
    try:
        response = requests.head(
            url.strip(), headers=_HEADERS, timeout=_REQUEST_TIMEOUT, allow_redirects=True
        )
    except requests.RequestException:
        logger.exception("Failed to resolve Google Maps link: %s", url)
        return None

    resolved = response.url
    match = _PRECISE_COORDS_RE.search(resolved) or _CENTER_COORDS_RE.search(resolved)
    if not match:
        return None
    return float(match.group(1)), float(match.group(2))
