from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q, Count
from django.db.models.functions import TruncWeek
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, views
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from api.models import Profile
from api.serializers import UserSerializer
from .models import AmbassadorApplication
from .permissions import IsAmbassador
from .serializers import (
    AmbassadorApplicationSerializer,
    AmbassadorApplicationStatusSerializer,
    ReferralSerializer,
)
from .utils import create_ambassador_account, generate_temp_password

class AmbassadorApplicationCreateView(generics.CreateAPIView):
    """POST /ambassador/applications/ — public application form submission
    from the standalone frontend-ambassador site. No auth required."""
    queryset = AmbassadorApplication.objects.all()
    serializer_class = AmbassadorApplicationSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]


class AmbassadorEmailCheckView(views.APIView):
    """GET /ambassador/check-email/?email=... — public. Lets the application
    form gate its first step: applicants must already have a Kaamlee account,
    since approval reuses it (see create_ambassador_account)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        email = (request.query_params.get('email') or '').strip()
        if not email:
            return Response({'error': 'email is required'}, status=400)
        exists = User.objects.filter(email__iexact=email).exists()
        return Response({'exists': exists})


class AdminAmbassadorApplicationListView(generics.ListAPIView):
    """GET /ambassador/admin/applications/ — full application list for the
    admin dashboard's Ambassadors page. Supports ?status= and ?search=."""
    serializer_class = AmbassadorApplicationSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = AmbassadorApplication.objects.select_related('ambassador_profile__user').annotate(
            annotated_referral_count=Count('ambassador_profile__referrals', distinct=True)
        ).order_by('-created_at')

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) |
                Q(email__icontains=search) |
                Q(college_name__icontains=search)
            )

        return queryset


class AdminAmbassadorApplicationStatusView(generics.UpdateAPIView):
    """PATCH /ambassador/admin/applications/<id>/ — approve/reject an
    application and optionally leave a reviewer note.

    Approving an application for the first time provisions its portal
    account (User + AmbassadorProfile) and returns the plaintext temp
    password once, in `credentials`, so the admin can hand it over — it is
    never stored or shown again. Re-approving after a rejection reactivates
    the existing account instead of creating a new one; rejecting an
    approved application deactivates portal access without deleting it.
    """
    queryset = AmbassadorApplication.objects.all()
    serializer_class = AmbassadorApplicationStatusSerializer
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['patch']

    def perform_update(self, serializer):
        application = serializer.save()
        self.credentials = None
        profile = getattr(application, 'ambassador_profile', None)

        if application.status == 'approved':
            if not profile:
                self.credentials = create_ambassador_account(application)
            elif not profile.is_active:
                profile.is_active = True
                profile.save(update_fields=['is_active'])
        elif profile and profile.is_active:
            profile.is_active = False
            profile.save(update_fields=['is_active'])

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        if self.credentials:
            response.data['credentials'] = self.credentials
        return response


class AdminAmbassadorRegeneratePasswordView(views.APIView):
    """POST /ambassador/admin/applications/<id>/regenerate-password/ — issues
    a fresh temp password for an already-provisioned ambassador account (e.g.
    they lost it, or the admin wants to rotate it). Forces a password change
    on their next login. Returns the plaintext password once, same shape as
    the credentials returned on approval."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        application = get_object_or_404(AmbassadorApplication, pk=pk)
        profile = getattr(application, 'ambassador_profile', None)
        if not profile:
            return Response({'error': 'This application does not have an ambassador account yet.'}, status=400)

        temp_password = generate_temp_password()
        profile.user.set_password(temp_password)
        profile.user.save()
        profile.must_change_password = True
        profile.save(update_fields=['must_change_password'])

        return Response({
            'username': profile.user.username,
            'temp_password': temp_password,
            'referral_code': profile.referral_code,
        })


class AmbassadorLoginView(ObtainAuthToken):
    """POST /ambassador/login/ — username + password issued by admin on
    approval. Only accounts with an active AmbassadorProfile may log in here,
    even if the underlying User also has a candidate account."""

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        profile = getattr(user, 'ambassador_profile', None)
        if not profile or not profile.is_active:
            return Response({'error': 'This account does not have ambassador portal access.'}, status=403)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data,
            'must_change_password': profile.must_change_password,
            'referral_code': profile.referral_code,
        })


class AmbassadorMeView(views.APIView):
    """GET /ambassador/me/ — the logged-in ambassador's profile."""
    permission_classes = [IsAmbassador]

    def get(self, request):
        profile = request.user.ambassador_profile
        application = profile.application
        return Response({
            'username': request.user.username,
            'full_name': application.full_name,
            'email': request.user.email,
            'phone': request.user.profile.phone,
            'college_name': application.college_name,
            'course': application.course,
            'referral_code': profile.referral_code,
            'must_change_password': profile.must_change_password,
        })


class AmbassadorChangePasswordView(views.APIView):
    """POST /ambassador/change-password/ — requires the current password
    (the temp password on first login), clears must_change_password on
    success. Kept separate from api.ChangePasswordView, which requires a
    recently-verified email that ambassadors never go through."""
    permission_classes = [IsAmbassador]

    def post(self, request):
        current_password = request.data.get('current_password') or ''
        new_password = request.data.get('new_password') or ''
        confirm_password = request.data.get('confirm_password') or ''

        if not request.user.check_password(current_password):
            return Response({'current_password': 'Current password is incorrect.'}, status=400)
        if new_password != confirm_password:
            return Response({'confirm_password': 'Passwords do not match.'}, status=400)
        try:
            validate_password(new_password, user=request.user)
        except DjangoValidationError as e:
            return Response({'new_password': e.messages}, status=400)

        request.user.set_password(new_password)
        request.user.save()

        profile = request.user.ambassador_profile
        profile.must_change_password = False
        profile.save(update_fields=['must_change_password'])

        return Response({'detail': 'Password updated successfully.'})


class AmbassadorReferralsView(generics.ListAPIView):
    """GET /ambassador/referrals/ — everyone this ambassador referred, with
    subscription status."""
    serializer_class = ReferralSerializer
    permission_classes = [IsAmbassador]

    def get_queryset(self):
        return Profile.objects.filter(
            referred_by=self.request.user.ambassador_profile
        ).select_related('user').order_by('-user__date_joined')


class AmbassadorDashboardView(views.APIView):
    """GET /ambassador/dashboard/ — aggregate stats for the dashboard home."""
    permission_classes = [IsAmbassador]

    def get(self, request):
        referrals = Profile.objects.filter(referred_by=request.user.ambassador_profile)
        total = referrals.count()
        subscribed = referrals.filter(is_subscribed=True).count()

        eight_weeks_ago = timezone.now() - timedelta(weeks=8)
        weekly_counts = (
            referrals.filter(user__date_joined__gte=eight_weeks_ago)
            .annotate(week=TruncWeek('user__date_joined'))
            .values('week')
            .annotate(count=Count('id'))
            .order_by('week')
        )

        return Response({
            'total_referrals': total,
            'subscribed_referrals': subscribed,
            'conversion_rate': round(subscribed / total * 100, 1) if total else 0,
            'weekly_signups': [
                {'week': row['week'].date().isoformat(), 'count': row['count']}
                for row in weekly_counts
            ],
        })
