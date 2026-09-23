from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, views, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from .models import Employer, EmployerMember, KYCDocument
from .permissions import IsEmployerMember, IsEmployerAdmin, IsEmployerOwner
from .serializers import (
    EmployerSerializer, KYCDocumentSerializer,
    EmployerMemberSerializer, EmployerMemberRoleUpdateSerializer, EmployerTeamInviteSerializer,
    AdminEmployerSerializer, AdminEmployerCreateSerializer, AdminEmployerKYCReviewSerializer,
    AdminEmployerMemberCreateSerializer, AdminEmployerMemberUpdateSerializer,
)


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
        serializer.save()
        return Response(EmployerMemberSerializer(member).data)

    def delete(self, request, pk):
        member = self._get_member(request, pk)
        if member.role == 'owner':
            return Response({'error': "The owner can't be removed."}, status=400)
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


class AdminEmployerKYCDetailView(generics.RetrieveUpdateAPIView):
    """GET full employer + documents + team; PATCH to approve/reject."""
    queryset = Employer.objects.all().prefetch_related('kyc_documents', 'members__user')
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['get', 'patch']

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return AdminEmployerKYCReviewSerializer
        return AdminEmployerSerializer


class AdminKYCDocumentDetailView(views.APIView):
    """DELETE /employers/admin/kyc-documents/<id>/ — remove a submitted KYC
    document (e.g. it's the wrong file, unreadable, or outdated) so the
    employer can resubmit. Deletes the stored file itself, not just the
    row, so a removed document doesn't linger in storage."""
    permission_classes = [permissions.IsAdminUser]

    def delete(self, request, pk):
        doc = get_object_or_404(KYCDocument, pk=pk)
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
        serializer.save()
        return Response(EmployerMemberSerializer(member).data)

    def delete(self, request, pk):
        """Remove a member — deletes the login itself, same as the owner's
        own team removal (EmployerTeamMemberDetailView.delete). The last
        owner can't be removed, so an employer is never left without one."""
        member = get_object_or_404(self.queryset, pk=pk)
        if member.role == 'owner' and not _has_other_owner(member):
            return Response({'error': "This is the employer's only owner — make someone else owner first."}, status=400)
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
