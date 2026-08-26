import os
from datetime import timedelta

from django.utils import timezone

# Same limit for every user, free or paid — Groq spend is per-account, not a
# subscription perk. Override via env without a redeploy if the number needs
# tuning.
GROQ_DAILY_TOKEN_LIMIT = int(os.getenv('GROQ_DAILY_TOKEN_LIMIT', '50000'))
RESET_WINDOW = timedelta(hours=24)


class GroqQuotaExceeded(Exception):
    """Raised when a user has used up their 24h Groq token allowance."""


def _reset_if_expired(profile):
    if timezone.now() - profile.groq_tokens_reset_at >= RESET_WINDOW:
        profile.groq_tokens_used = 0
        profile.groq_tokens_reset_at = timezone.now()
        profile.save(update_fields=['groq_tokens_used', 'groq_tokens_reset_at'])


def usage_summary(profile):
    """Snapshot to hand back to the frontend after any AI action."""
    _reset_if_expired(profile)
    remaining = max(GROQ_DAILY_TOKEN_LIMIT - profile.groq_tokens_used, 0)
    return {
        'used': profile.groq_tokens_used,
        'limit': GROQ_DAILY_TOKEN_LIMIT,
        'remaining': remaining,
        'resets_at': (profile.groq_tokens_reset_at + RESET_WINDOW).isoformat(),
    }


def ensure_quota_available(profile):
    """Raises GroqQuotaExceeded if this profile has no tokens left in the
    current 24h window. Call before spending a Groq request on their behalf."""
    _reset_if_expired(profile)
    if profile.groq_tokens_used >= GROQ_DAILY_TOKEN_LIMIT:
        raise GroqQuotaExceeded()


def record_usage(profile, tokens_used):
    _reset_if_expired(profile)
    profile.groq_tokens_used += max(tokens_used, 0)
    profile.save(update_fields=['groq_tokens_used'])
