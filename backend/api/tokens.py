"""Expiring auth tokens on top of DRF's TokenAuthentication.

DRF's stock tokens never expire, so a copied token used to work forever.
Here a token is only valid for TOKEN_TTL after it was issued; an expired
one is deleted the first time it's presented, and login always hands out a
fresh token rather than resurrecting an expired one. Logout deletes the
token outright (see LogoutView).

Note DRF keeps one token per user, shared across that user's devices —
expiry or logout on one device ends the session everywhere.
"""
import os
from datetime import timedelta

from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import AuthenticationFailed

TOKEN_TTL = timedelta(hours=int(os.getenv('TOKEN_TTL_HOURS', '24')))  # 1 day


def is_expired(token):
    return timezone.now() - token.created >= TOKEN_TTL


def issue_token(user):
    """The token to hand out at login/signup — the user's current one if
    it's still valid, otherwise a newly minted one."""
    token = Token.objects.filter(user=user).first()
    if token and not is_expired(token):
        return token
    if token:
        token.delete()
    return Token.objects.create(user=user)


class ExpiringTokenAuthentication(TokenAuthentication):
    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        if is_expired(token):
            token.delete()
            raise AuthenticationFailed('Your session has expired. Please log in again.')
        return user, token


def expires_at(token):
    return token.created + TOKEN_TTL


def purge_expired_tokens():
    """Delete every expired token. Run hourly by the scheduler
    (api/scheduler.py) and whenever the admin Sessions page loads, so
    expired sessions don't linger in the table until their next use."""
    deleted, _ = Token.objects.filter(created__lte=timezone.now() - TOKEN_TTL).delete()
    return deleted
