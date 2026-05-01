from rest_framework import viewsets, views, generics, permissions
from .permissions import IsSubscribed

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
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]


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
    def toggle_bookmark(self, request, pk=None):
        job = self.get_object()
        bookmark, created = Bookmark.objects.get_or_create(user=request.user, job=job)
        if not created:
            bookmark.delete()
            return Response({'status': 'unbookmarked', 'is_bookmarked': False})
        return Response({'status': 'bookmarked', 'is_bookmarked': True})


class CheckExistenceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def post(self, request):
        job_urls = request.data.get('urls', [])
        existing_urls = Job.objects.filter(job_url__in=job_urls).values_list('job_url', flat=True)
        return Response({'existing_urls': list(existing_urls)})

class LocationViewSet(viewsets.ModelViewSet):
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]


    def get_queryset(self):
        return Location.objects.annotate(job_count=Count('jobs'))

class StatsView(views.APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        total_jobs = Job.objects.count()
        total_locations = Location.objects.count()
        active_sessions = ScrapeSession.objects.filter(status='running').count()
        last_session = ScrapeSession.objects.all().order_by('-start_time').first()
        return Response({
            'total_jobs': total_jobs,
            'total_locations': total_locations,
            'active_sessions': active_sessions,
            'last_scrape_session': ScrapeSessionSerializer(last_session).data if last_session else None
        })

class TriggerScrapeView(views.APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        search_term = request.data.get('search_term', 'frontend developer')
        results_wanted = request.data.get('results_wanted', 5)

        # Check if already running
        if ScrapeSession.objects.filter(status='running').exists():
            return Response({'status': 'Scraper already running'}, status=400)

        import threading
        from .scraper_utils import run_background_scraping
        
        thread = threading.Thread(
            target=run_background_scraping, 
            args=(search_term, results_wanted)
        )
        thread.daemon = True
        thread.start()
        
        return Response({'status': 'Scrape triggered'})

class StopScrapeView(views.APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        session = ScrapeSession.objects.filter(status='running').order_by('-start_time').first()
        if session:
            session.stop_requested = True
            session.save()
            return Response({'status': 'Stop request sent'})
        return Response({'status': 'No active session found'}, status=404)

class ForceResetView(views.APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        ScrapeSession.objects.filter(status='running').update(
            status='stopped',
            end_time=timezone.now(),
            error_message='Force reset by admin'
        )
        return Response({'status': 'All sessions reset'})

class LogsView(generics.ListAPIView):
    serializer_class = ScrapeLogSerializer
    permission_classes = [permissions.IsAdminUser]


    def get(self, request):
        logs = ScrapeLog.objects.all().order_by('-timestamp')[:100]
        last_session = ScrapeSession.objects.all().order_by('-start_time').first()
        return Response({
            'logs': ScrapeLogSerializer(logs, many=True).data,
            'session': ScrapeSessionSerializer(last_session).data if last_session else None
        })

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
