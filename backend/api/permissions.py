from rest_framework import permissions
from django.utils import timezone

class IsSubscribed(permissions.BasePermission):
    """
    Custom permission to only allow subscribed users to access the data.
    """
    def has_permission(self, request, view):
        # Allow superusers to always see data
        if request.user and request.user.is_superuser:
            return True
            
        if not request.user or not request.user.is_authenticated:
            return False
            
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return False
            
        # Check if subscription is active and not expired
        if profile.is_subscribed:
            if profile.subscription_expires_at:
                if profile.subscription_expires_at > timezone.now():
                    return True
                else:
                    # Auto-reset status if expired during the check
                    profile.is_subscribed = False
                    profile.save()
                    return False
            return True # Legacy support for profiles with is_subscribed=True but no expiry set
            
        return False
