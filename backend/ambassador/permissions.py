from rest_framework import permissions


class IsAmbassador(permissions.BasePermission):
    """Allows access only to authenticated users with an active ambassador
    portal account (created on application approval)."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        profile = getattr(user, 'ambassador_profile', None)
        return bool(profile and profile.is_active)
