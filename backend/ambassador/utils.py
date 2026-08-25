import re
import secrets
import string

from django.contrib.auth.models import User
from django.db import transaction

from .models import AmbassadorProfile

_USERNAME_SANITIZE_RE = re.compile(r'[^a-z0-9]+')
_LETTERS_ONLY_RE = re.compile(r'[^A-Za-z]')
_TEMP_PASSWORD_ALPHABET = string.ascii_letters + string.digits
REFERRAL_CODE_LETTERS = 5
REFERRAL_CODE_DIGITS = 5


def _unique_username(full_name):
    base = _USERNAME_SANITIZE_RE.sub('.', full_name.strip().lower()).strip('.')[:20] or 'ambassador'
    username = base
    suffix = 1
    while User.objects.filter(username__iexact=username).exists():
        suffix += 1
        username = f"{base}{suffix}"[:30]
    return username


def generate_temp_password():
    return ''.join(secrets.choice(_TEMP_PASSWORD_ALPHABET) for _ in range(10))


def generate_referral_code(username):
    """5 letters pulled from the username + 5 random digits, e.g. PSDAD21312.
    Padded with X if the username has fewer than 5 letters; retried on
    collision (digits only, letters stay tied to the username)."""
    letters = _LETTERS_ONLY_RE.sub('', username).upper()[:REFERRAL_CODE_LETTERS]
    letters = (letters + 'X' * REFERRAL_CODE_LETTERS)[:REFERRAL_CODE_LETTERS]

    while True:
        digits = ''.join(secrets.choice(string.digits) for _ in range(REFERRAL_CODE_DIGITS))
        code = f"{letters}{digits}"
        if not AmbassadorProfile.objects.filter(referral_code=code).exists():
            return code


@transaction.atomic
def create_ambassador_account(application):
    """Provision portal access for an approved application: reuses an existing
    User by email if one already exists (e.g. the applicant already has a
    candidate account), otherwise creates one. Returns the plaintext temp
    password so the caller can hand it to the admin exactly once — it is
    never stored.
    """
    user = User.objects.filter(email__iexact=application.email).first()
    if user and hasattr(user, 'ambassador_profile'):
        return {
            'username': user.username,
            'temp_password': None,
            'referral_code': user.ambassador_profile.referral_code,
            'note': 'This email already has an ambassador account.',
        }

    temp_password = generate_temp_password()
    if user:
        user.set_password(temp_password)
        user.is_active = True
        user.save()
    else:
        user = User.objects.create_user(
            username=_unique_username(application.full_name),
            email=application.email,
            password=temp_password,
        )

    if application.phone:
        user.profile.phone = application.phone
        user.profile.save(update_fields=['phone'])

    referral_code = generate_referral_code(user.username)
    AmbassadorProfile.objects.create(
        user=user,
        application=application,
        referral_code=referral_code,
    )

    return {
        'username': user.username,
        'temp_password': temp_password,
        'referral_code': referral_code,
    }
