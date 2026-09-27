from django.contrib.auth.models import User
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, views, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from . import activity
from .models import Employer, EmployerMember, KYCDocument
from .permissions import IsEmployerMember, IsEmployerAdmin, IsEmployerOwner
from .serializers import (
    EmployerSerializer, KYCDocumentSerializer,
    EmployerMemberSerializer, EmployerMemberRoleUpdateSerializer, EmployerTeamInviteSerializer,
    AdminEmployerSerializer, AdminEmployerCreateSerializer, AdminEmployerKYCReviewSerializer,
    AdminEmployerProfileUpdateSerializer,
    AdminEmployerMemberCreateSerializer, AdminEmployerMemberUpdateSerializer,
)

# Company-profile fields whose edits go into the employer activity log.
PROFILE_TRACKED_FIELDS = [
    'name', 'legal_name', 'industry', 'size', 'website', 'logo', 'logo_url',
    'address', 'contact_email', 'contact_phone',
]
MEMBER_USER_FIELDS = ['username', 'email', 'first_name', 'last_name']


def _log_profile_change(employer, before, actor):
    changes = activity.diff(before, employer, PROFILE_TRACKED_FIELDS)
    if changes:
        activity.record('profile_updated', employer=employer, actor=actor,
                        target_type='employer', target_id=employer.id, target_label=employer.name,
                        changes=changes)


def _log_member_removed(member, actor):
    activity.record('member_removed', employer=member.employer, actor=actor,
                    target_type='member', target_id=member.id, target_label=activity.person_name(member.user),
                    changes={'role': [member.role, None], 'email': [member.user.email, None]})


class MyEmployerView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /employers/me/ — any member can view, only owner/admin can edit."""
    serializer_class = EmployerSerializer
    permission_classes = [IsEmployerMember]

    def get_permissions(self):
        if self.request.method in ('PATCH', 'PUT'):
            return [IsEmployerMember(), IsEmployerAdmin()]
        return super().get_permissions()

    def get_object(self):
        return self.request.user.employer_membership.employer

    def perform_update(self, serializer):
        before = activity.snapshot(serializer.instance, PROFILE_TRACKED_FIELDS)
        employer = serializer.save()
        _log_profile_change(employer, before, self.request.user)


class EmployerChangeOwnPasswordView(views.APIView):
    """POST /employers/me/change-password/ — any employer member changing
    their own password from the portal's Profile page. Gated on the current
    password (same as the admin portal) since the emailed-OTP flow lives in
    the candidate frontend."""
    permission_classes = [IsEmployerMember]

    def post(self, request):
        from api.serializers import AdminChangeOwnPasswordSerializer
        serializer = AdminChangeOwnPasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Password updated successfully.'})


class KYCDocumentUploadView(generics.CreateAPIView):
    """POST /employers/kyc/ — upload one KYC document. Re-submitting after a
    rejection moves the employer back to pending review."""
    serializer_class = KYCDocumentSerializer
    permission_classes = [IsEmployerMember, IsEmployerAdmin]

    def perform_create(self, serializer):
        employer = self.request.user.employer_membership.employer
        serializer.save(employer=employer)
        if employer.kyc_status != 'approved':
            employer.kyc_status = 'pending'
            employer.kyc_rejection_reason = ''
            employer.save(update_fields=['kyc_status', 'kyc_rejection_reason'])


class EmployerTeamListView(generics.ListAPIView):
    serializer_class = EmployerMemberSerializer
    permission_classes = [IsEmployerMember]

    def get_queryset(self):
        return EmployerMember.objects.filter(
            employer=self.request.user.employer_membership.employer
        ).select_related('user').order_by('created_at')


class EmployerTeamInviteView(views.APIView):
    """Managing the team (inviting, editing roles, removing members) is
    owner-only — an admin can do everything hiring-related but can't touch
    who's on the team."""
    permission_classes = [IsEmployerMember, IsEmployerOwner]

    def post(self, request):
        employer = request.user.employer_membership.employer
        serializer = EmployerTeamInviteSerializer(data=request.data, context={'employer': employer})
        serializer.is_valid(raise_exception=True)
        member = serializer.save()
        return Response(EmployerMemberSerializer(member).data, status=201)


class EmployerTeamMemberDetailView(views.APIView):
    """PATCH /employers/team/<id>/ — change a member's role. DELETE — remove
    them. Owner-only, and the owner's own row can't be edited or removed
    here (no self-demotion, no orphaning the employer account)."""
    permission_classes = [IsEmployerMember, IsEmployerOwner]

    def _get_member(self, request, pk):
        return get_object_or_404(EmployerMember, pk=pk, employer=request.user.employer_membership.employer)

    def patch(self, request, pk):
        member = self._get_member(request, pk)
        if member.role == 'owner':
            return Response({'error': "The owner's role can't be changed here."}, status=400)
        serializer = EmployerMemberRoleUpdateSerializer(member, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        old_role = member.role
        serializer.save()
        if member.role != old_role:
            activity.record('member_role_changed', employer=member.employer, actor=request.user,
                            target_type='member', target_id=member.id,
                            target_label=activity.person_name(member.user),
                            changes={'role': [old_role, member.role]})
        return Response(EmployerMemberSerializer(member).data)

    def delete(self, request, pk):
        member = self._get_member(request, pk)
        if member.role == 'owner':
            return Response({'error': "The owner can't be removed."}, status=400)
        _log_member_removed(member, request.user)
        # Delete the login itself, not just the membership link — otherwise a
        # removed member's account would linger with no employer and start
        # showing up as a "candidate" in the admin's Users list.
        member.user.delete()
        return Response(status=204)


class AdminEmployerKYCPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class AdminEmployerKYCListView(generics.ListCreateAPIView):
    """GET /employers/admin/kyc/ — the review queue. ?status=pending/approved/rejected, ?search=
    POST — create an employer and its initial owner login (the only way an
    employer account comes into existence; there's no self-signup)."""
    permission_classes = [permissions.IsAdminUser]
    pagination_class = AdminEmployerKYCPagination

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AdminEmployerCreateSerializer
        return AdminEmployerSerializer

    def create(self, request, *args, **kwargs):
        serializer = AdminEmployerCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employer = serializer.save()
        # Re-read with prefetches so the response matches a list row.
        employer = self.get_queryset().get(pk=employer.pk)
        return Response(AdminEmployerSerializer(employer, context={'request': request}).data, status=201)

    def get_queryset(self):
        queryset = (
            Employer.objects.all()
            .prefetch_related('kyc_documents', 'members__user')
            .order_by('-created_at')
        )
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(kyc_status=status_param)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(contact_email__icontains=search))
        # Exact (case-insensitive) match — the Add employer form's live
        # duplicate check on the company contact email.
        contact_email = self.request.query_params.get('contact_email')
        if contact_email:
            queryset = queryset.filter(contact_email__iexact=contact_email)
        return queryset


class AdminEmployerKYCDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET full employer + documents + team; PATCH with `kyc_status` to
    approve/reject, PATCH without it to edit the company profile;
    DELETE to remove the employer entirely (see perform_destroy)."""
    queryset = Employer.objects.all().prefetch_related('kyc_documents', 'members__user')
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['get', 'patch', 'delete']

    def perform_destroy(self, instance):
        """Deleting the Employer cascades its job postings (and their
        applications / stage history / saved-by rows) and KYC document
        rows. On top of that: the stored KYC files and logo are removed
        from storage, and every team member's login is deleted — otherwise
        those accounts would linger with no employer and show up as
        candidates in the admin Users list."""
        # Logged first; the entry keeps the name after the employer row is gone.
        activity.record('employer_deleted', employer=instance, actor=self.request.user,
                        target_type='employer', target_id=instance.id, target_label=instance.name,
                        changes={'postings': [instance.job_postings.count(), None],
                                 'team_members': [instance.members.count(), None]})
        for doc in instance.kyc_documents.all():
            doc.file.delete(save=False)
        if instance.logo:
            instance.logo.delete(save=False)
        member_user_ids = list(instance.members.values_list('user_id', flat=True))
        instance.delete()
        User.objects.filter(id__in=member_user_ids, is_superuser=False, is_staff=False).delete()

    def perform_update(self, serializer):
        employer = serializer.instance
        if isinstance(serializer, AdminEmployerKYCReviewSerializer):
            before = {'kyc_status': employer.kyc_status, 'kyc_rejection_reason': employer.kyc_rejection_reason}
            employer = serializer.save()
            # Every review is logged (the model only keeps the latest one).
            activity.record('kyc_reviewed', employer=employer, actor=self.request.user,
                            target_type='employer', target_id=employer.id, target_label=employer.name,
                            changes={
                                'kyc_status': [before['kyc_status'], employer.kyc_status],
                                'kyc_rejection_reason': [before['kyc_rejection_reason'] or None,
                                                         employer.kyc_rejection_reason or None],
                            })
            return
        before = activity.snapshot(employer, PROFILE_TRACKED_FIELDS)
        employer = serializer.save()
        _log_profile_change(employer, before, self.request.user)

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            if 'kyc_status' in self.request.data:
                return AdminEmployerKYCReviewSerializer
            return AdminEmployerProfileUpdateSerializer
        return AdminEmployerSerializer


class AdminKYCDocumentDetailView(views.APIView):
    """DELETE /employers/admin/kyc-documents/<id>/ — remove a submitted KYC
    document (e.g. it's the wrong file, unreadable, or outdated) so the
    employer can resubmit. Deletes the stored file itself, not just the
    row, so a removed document doesn't linger in storage."""
    permission_classes = [permissions.IsAdminUser]

    def delete(self, request, pk):
        doc = get_object_or_404(KYCDocument.objects.select_related('employer'), pk=pk)
        activity.record('kyc_document_deleted', employer=doc.employer, actor=request.user,
                        target_type='kyc_document', target_id=doc.id, target_label=doc.get_doc_type_display(),
                        changes={'uploaded_at': [doc.uploaded_at.isoformat(), None]})
        doc.file.delete(save=False)
        doc.delete()
        return Response(status=204)


class AdminEmployerMemberDetailView(views.APIView):
    """PATCH /employers/admin/members/<id>/ — a platform admin editing any
    team member directly: username/email/name/role, and optionally a new
    password (blank = unchanged). Full override, unlike the owner-only
    self-service team management in EmployerTeamMemberDetailView."""
    permission_classes = [permissions.IsAdminUser]
    queryset = EmployerMember.objects.select_related('user', 'employer')

    def patch(self, request, pk):
        member = get_object_or_404(self.queryset, pk=pk)
        if (
            request.data.get('role') and request.data.get('role') != 'owner'
            and member.role == 'owner' and not _has_other_owner(member)
        ):
            return Response({'role': ["This is the employer's only owner — make someone else owner first."]}, status=400)
        serializer = AdminEmployerMemberUpdateSerializer(member, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        before = {**activity.snapshot(member.user, MEMBER_USER_FIELDS), 'role': member.role}
        serializer.save()
        changes = activity.diff(before, member.user, MEMBER_USER_FIELDS)
        if member.role != before['role']:
            changes['role'] = [before['role'], member.role]
        if serializer.validated_data.get('new_password'):
            changes['password'] = [None, 'changed']  # never log the password itself
        if changes:
            action = 'member_role_changed' if list(changes) == ['role'] else 'member_updated'
            activity.record(action, employer=member.employer, actor=request.user,
                            target_type='member', target_id=member.id,
                            target_label=activity.person_name(member.user), changes=changes)
        return Response(EmployerMemberSerializer(member).data)

    def delete(self, request, pk):
        """Remove a member — deletes the login itself, same as the owner's
        own team removal (EmployerTeamMemberDetailView.delete). The last
        owner can't be removed, so an employer is never left without one."""
        member = get_object_or_404(self.queryset, pk=pk)
        if member.role == 'owner' and not _has_other_owner(member):
            return Response({'error': "This is the employer's only owner — make someone else owner first."}, status=400)
        _log_member_removed(member, request.user)
        member.user.delete()
        return Response(status=204)


def _has_other_owner(member):
    return EmployerMember.objects.filter(employer_id=member.employer_id, role='owner').exclude(pk=member.pk).exists()


class AdminEmployerMemberCreateView(views.APIView):
    """POST /employers/admin/kyc/<id>/members/ — add a login to an employer's team."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        employer = get_object_or_404(Employer, pk=pk)
        serializer = AdminEmployerMemberCreateSerializer(data=request.data, context={'employer': employer})
        serializer.is_valid(raise_exception=True)
        member = serializer.save()
        return Response(EmployerMemberSerializer(member).data, status=201)
