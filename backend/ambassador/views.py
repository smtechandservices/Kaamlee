from django.db.models import Q
from rest_framework import generics, permissions
from rest_framework.parsers import MultiPartParser, FormParser
from .models import AmbassadorApplication
from .serializers import AmbassadorApplicationSerializer, AmbassadorApplicationStatusSerializer

class AmbassadorApplicationCreateView(generics.CreateAPIView):
    """POST /ambassador/applications/ — public application form submission
    from the standalone frontend-ambassador site. No auth required."""
    queryset = AmbassadorApplication.objects.all()
    serializer_class = AmbassadorApplicationSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]


class AdminAmbassadorApplicationListView(generics.ListAPIView):
    """GET /ambassador/admin/applications/ — full application list for the
    admin dashboard's Ambassadors page. Supports ?status= and ?search=."""
    serializer_class = AmbassadorApplicationSerializer
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


class AdminAmbassadorApplicationStatusView(generics.UpdateAPIView):
    """PATCH /ambassador/admin/applications/<id>/ — approve/reject an
    application and optionally leave a reviewer note."""
    queryset = AmbassadorApplication.objects.all()
    serializer_class = AmbassadorApplicationStatusSerializer
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['patch']
