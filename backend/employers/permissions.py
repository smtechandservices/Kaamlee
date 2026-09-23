from rest_framework import permissions


class IsEmployerMember(permissions.BasePermission):
    """Any authenticated user who belongs to an employer account."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and hasattr(request.user, 'employer_membership'))


class IsEmployerAdmin(permissions.BasePermission):
    """Owner or admin role within their employer account — required for
    anything that changes employer-level state (profile edits, KYC
    submission, team management) rather than just viewing it."""
    def has_permission(self, request, view):
        membership = getattr(request.user, 'employer_membership', None)
        return bool(membership and membership.role in ('owner', 'admin'))


class IsEmployerOwner(permissions.BasePermission):
    """Owner role only — managing the team itself (inviting, editing a
    member's role, removing someone) is narrower than IsEmployerAdmin's
    "owner or admin" so an admin can't demote or remove anyone, including
    other admins."""
    def has_permission(self, request, view):
        membership = getattr(request.user, 'employer_membership', None)
        return bool(membership and membership.role == 'owner')


class IsApprovedEmployer(permissions.BasePermission):
    """Job posting is the whole point of passing KYC — an employer can't post
    (or even draft) a job until an admin has approved it. Assumes
    IsEmployerMember already ran, so `employer_membership` exists."""
    message = "Your employer account must complete KYC review before posting jobs."

    def has_permission(self, request, view):
        return request.user.employer_membership.employer.kyc_status == 'approved'
