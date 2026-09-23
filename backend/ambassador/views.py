from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import generics, permissions, views
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import serializers
from rest_framework.response import Response
from .models import AmbassadorApplication
from .serializers import (
    AmbassadorApplicationSerializer,
    AmbassadorApplicationAdminSerializer,
    AmbassadorApplicationStatusSerializer,
)

class AmbassadorApplicationCreateView(generics.CreateAPIView):
    """POST /ambassador/applications/ — public application form submission
    from the standalone frontend-ambassador site. No auth required."""
    queryset = AmbassadorApplication.objects.all()
    serializer_class = AmbassadorApplicationSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]


class AmbassadorEmailCheckView(views.APIView):
    """POST /ambassador/applications/check-email/ — runs the same email
    rules as submitting (registered Kaamlee candidate, no pending/approved
    application) so the form can stop the applicant on step one instead of
    after they've filled everything in. Submission re-checks regardless."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'ambassador-email-check'

    def post(self, request):
        email = (request.data.get('email') or '').strip()
        try:
            AmbassadorApplicationSerializer().validate_email(email)
        except serializers.ValidationError as e:
            detail = e.detail[0] if isinstance(e.detail, list) else e.detail
            return Response({'ok': False, 'error': str(detail)}, status=400)
        return Response({'ok': True})


class AdminAmbassadorApplicationListView(generics.ListAPIView):
    """GET /ambassador/admin/applications/ — full application list for the
    admin dashboard's Ambassadors page. Supports ?status= and ?search=."""
    serializer_class = AmbassadorApplicationAdminSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = AmbassadorApplication.objects.all().order_by('-created_at')

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


class AdminAmbassadorApplicationStatusView(generics.RetrieveUpdateDestroyAPIView):
    """PATCH /ambassador/admin/applications/<id>/ — approve/reject an
    application and optionally leave a reviewer note.
    DELETE /ambassador/admin/applications/<id>/?remove_user=true — remove
    the application, and optionally the matching Kaamlee account (matched
    by email, since there's no FK between the two)."""
    queryset = AmbassadorApplication.objects.all()
    serializer_class = AmbassadorApplicationStatusSerializer
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['patch', 'delete']

    def destroy(self, request, *args, **kwargs):
        application = self.get_object()
        removed_user = None
        if request.query_params.get('remove_user') == 'true':
            user = User.objects.filter(email__iexact=application.email, is_superuser=False).first()
            if user:
                removed_user = user.username
                user.delete()
        application.delete()
        return Response({'deleted': True, 'removed_user': removed_user})
