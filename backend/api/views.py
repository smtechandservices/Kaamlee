from rest_framework import viewsets, views, generics, permissions
from rest_framework.decorators import action
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from .models import Location, Job, ScrapeSession, ScrapeLog, Bookmark
from .serializers import (
    LocationSerializer, JobSerializer, ScrapeSessionSerializer, 
    ScrapeLogSerializer, UserSerializer, RegisterSerializer, RecentJobSerializer
)
from django.db.models import Count, Exists, OuterRef
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import os
import json
from django.conf import settings

class SignupView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return User.objects.all()

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            "user": UserSerializer(user).data,
            "token": token.key
        })

class UserView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    def get_object(self):
        return self.request.user
    def perform_update(self, serializer):
        serializer.save()

class RecentJobsView(generics.ListAPIView):
    serializer_class = RecentJobSerializer
    permission_classes = [permissions.AllowAny]
    def get_queryset(self):
        return Job.objects.all().order_by('-created_at')[:10]

class JobViewSet(viewsets.ModelViewSet):
    serializer_class = JobSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Job.objects.all().order_by('-created_at')
        
        # Annotate with bookmark status for current user
        user = self.request.user
        queryset = queryset.annotate(
            is_bookmarked=Exists(
                Bookmark.objects.filter(user=user, job_id=OuterRef('pk'))
            )
        )

        # Filters
        location_id = self.request.query_params.get('location_id')
        if location_id:
            queryset = queryset.filter(location_id=location_id)
            
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(title__icontains=search) | queryset.filter(company__icontains=search)

        bookmarked_only = self.request.query_params.get('bookmarked_only')
        if bookmarked_only == 'true':
            queryset = queryset.filter(is_bookmarked=True)

        return queryset

    @action(detail=True, methods=['post'])
    def bookmark(self, request, pk=None):
        job = self.get_object()
        bookmark, created = Bookmark.objects.get_or_create(user=request.user, job=job)
        if not created:
            bookmark.delete()
            return Response({'status': 'unbookmarked'})
        return Response({'status': 'bookmarked'})

class CheckExistenceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        job_urls = request.data.get('urls', [])
        existing_urls = Job.objects.filter(job_url__in=job_urls).values_list('job_url', flat=True)
        return Response({'existing_urls': list(existing_urls)})

class LocationViewSet(viewsets.ModelViewSet):
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Location.objects.annotate(job_count=Count('jobs'))

class StatsView(views.APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        total_jobs = Job.objects.count()
        total_locations = Location.objects.count()
        active_sessions = ScrapeSession.objects.filter(status='running').count()
        return Response({
            'total_jobs': total_jobs,
            'total_locations': total_locations,
            'active_sessions': active_sessions
        })

class TriggerScrapeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        # Simulation
        return Response({'status': 'Scrape triggered'})

class StopScrapeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        return Response({'status': 'Scrape stopped'})

class ForceResetView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        return Response({'status': 'State reset'})

class LogsView(generics.ListAPIView):
    serializer_class = ScrapeLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ScrapeLog.objects.all().order_by('-timestamp')

class AdminLoginView(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        if not user.is_superuser:
            return Response({"error": "Only superusers can access the admin dashboard."}, status=403)
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        })

class AdminUserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return User.objects.all().order_by('-date_joined')

class RolesView(views.APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        path = os.path.join(settings.BASE_DIR, 'api', 'roles.json')
        try:
            with open(path, 'r') as f:
                roles = json.load(f)
            return Response(roles)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
