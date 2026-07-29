from rest_framework import permissions
from django.utils import timezone

def is_user_subscribed(user):
    """Shared subscription check so views can offer a limited free preview
    (e.g. recent jobs on the map) without duplicating the expiry logic."""
    if user and user.is_superuser:
        return True

    if not user or not user.is_authenticated:
        return False

    profile = getattr(user, 'profile', None)
    if not profile:
        return False

    if profile.is_subscribed:
        if profile.subscription_expires_at:
            if profile.subscription_expires_at > timezone.now():
                return True
            else:
                # Auto-reset status if expired during the check
                profile.is_subscribed = False
                profile.save()
                return False
        return True  # Legacy support for profiles with is_subscribed=True but no expiry set

    return False

class IsSubscribed(permissions.BasePermission):
    """
    Custom permission to only allow subscribed users to access the data.
    """
    def has_permission(self, request, view):
        return is_user_subscribed(request.user)
