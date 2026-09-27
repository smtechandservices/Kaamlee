from django.conf import settings
from rest_framework.throttling import UserRateThrottle


class JobSpySearchIntervalThrottle(UserRateThrottle):
    """At most one Live Search per user every JOBSPY_SEARCH_INTERVAL_SECONDS.

    DRF rate strings only take a one-unit period — it reads just the first
    letter, so '1/2m' would silently mean once a *minute* — hence the interval
    is set in seconds here instead of in DEFAULT_THROTTLE_RATES. Works
    alongside the hourly 'jobspy-search' scoped throttle on the same view."""
    scope = 'jobspy-search-interval'

    def get_rate(self):
        return f"1/{settings.JOBSPY_SEARCH_INTERVAL_SECONDS}s"

    def parse_rate(self, rate):
        return (1, settings.JOBSPY_SEARCH_INTERVAL_SECONDS)
