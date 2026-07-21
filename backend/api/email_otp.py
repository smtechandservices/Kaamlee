import secrets

from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
from datetime import timedelta

from .models import EmailOTP

OTP_LENGTH = 6
OTP_TTL_MINUTES = 10
RESEND_COOLDOWN_SECONDS = 60
MAX_ATTEMPTS = 5


def _generate_code():
    return ''.join(secrets.choice('0123456789') for _ in range(OTP_LENGTH))


def create_otp(email):
    """Create a fresh OTP for the given email and return the raw (unhashed) code.

    Raises ValueError if a still-fresh code was already issued (resend cooldown).
    """
    email = email.lower()
    cooldown_cutoff = timezone.now() - timedelta(seconds=RESEND_COOLDOWN_SECONDS)
    recent = EmailOTP.objects.filter(email=email, created_at__gte=cooldown_cutoff).exists()
    if recent:
        raise ValueError("Please wait a moment before requesting another code.")

    code = _generate_code()
    EmailOTP.objects.create(
        email=email,
        code_hash=make_password(code),
        expires_at=timezone.now() + timedelta(minutes=OTP_TTL_MINUTES),
    )
    return code


def verify_otp(email, code):
    """Verify a submitted code for the given email.

    Raises ValueError with a user-facing message on failure. Marks the OTP as
    used on success so it cannot be replayed.
    """
    email = email.lower()
    otp = EmailOTP.objects.filter(email=email, is_used=False).order_by('-created_at').first()
    if not otp or otp.expires_at < timezone.now():
        raise ValueError("Invalid or expired code. Please request a new one.")

    if otp.attempts >= MAX_ATTEMPTS:
        raise ValueError("Too many incorrect attempts. Please request a new code.")

    if not check_password(code, otp.code_hash):
        otp.attempts += 1
        otp.save(update_fields=['attempts'])
        raise ValueError("Incorrect code. Please try again.")

    otp.is_used = True
    otp.save(update_fields=['is_used'])
