import re

from django.conf import settings
from django.contrib.auth.models import User
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from .models import Profile

_USERNAME_SANITIZE_RE = re.compile(r'[^\w.@+-]')


def _unique_username_from_email(email):
    base = _USERNAME_SANITIZE_RE.sub('', email.split('@')[0])[:140] or 'user'
    username = base
    suffix = 1
    while User.objects.filter(username__iexact=username).exists():
        suffix += 1
        username = f"{base}{suffix}"[:150]
    return username


def get_or_create_google_user(credential):
    """Verify a Google ID token and return the matching (or newly created) Django user.

    Raises ValueError with a user-facing message if the token is invalid/unverified.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise ValueError("Google sign-in is not configured on this server.")

    try:
        payload = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise ValueError("Invalid or expired Google sign-in token.")

    if not payload.get('email_verified'):
        raise ValueError("Your Google account's email is not verified.")

    google_sub = payload['sub']
    email = payload['email']

    profile = Profile.objects.filter(google_id=google_sub).select_related('user').first()
    if profile:
        return profile.user

    user = User.objects.filter(email__iexact=email).first()
    if user:
        user.profile.google_id = google_sub
        user.profile.save()
        return user

    user = User.objects.create_user(
        username=_unique_username_from_email(email),
        email=email,
        first_name=payload.get('given_name', ''),
        last_name=payload.get('family_name', ''),
    )
    user.set_unusable_password()
    user.save()
    # Profile is created automatically by the post_save signal.
    user.profile.google_id = google_sub
    user.profile.save()
    return user
