from rest_framework import viewsets, views, generics, permissions
from .permissions import IsSubscribed

from rest_framework.decorators import action
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from .models import Location, Job, ScrapeSession, ScrapeLog, Bookmark, Feedback
from .serializers import (
    LocationSerializer, JobSerializer, ScrapeSessionSerializer,
    ScrapeLogSerializer, UserSerializer, RegisterSerializer, RecentJobSerializer,
    FeedbackSerializer
)
from django.db.models import Count, Exists, OuterRef, Prefetch
from django.core.cache import cache
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
        limit = int(self.request.query_params.get('limit', 10))
        limit = min(limit, 299)
        return Job.objects.select_related('location').order_by('-created_at')[:limit]

class JobViewSet(viewsets.ModelViewSet):
    serializer_class = JobSerializer
    permission_classes = [permissions.IsAuthenticated]


    _COUNTRY_MAP = {
        'USA': 'United States',
        'UK': 'United Kingdom',
    }

    def get_queryset(self):
        user = self.request.user
        queryset = Job.objects.select_related('location').annotate(
            is_bookmarked=Exists(
                Bookmark.objects.filter(user=user, job_id=OuterRef('pk'))
            )
        ).order_by('-created_at')

        country = self.request.query_params.get('country')
        if country and country != 'All':
            country_name = self._COUNTRY_MAP.get(country, country)
            queryset = queryset.filter(location__country__iexact=country_name)

        location_id = self.request.query_params.get('location_id')
        if location_id:
            queryset = queryset.filter(location_id=location_id)

        state = self.request.query_params.get('state')
        if state:
            queryset = queryset.filter(location__state__iexact=state)

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
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        job_urls = request.data.get('urls', [])
        existing_urls = Job.objects.filter(job_url__in=job_urls).values_list('job_url', flat=True)
        return Response({'existing_urls': list(existing_urls)})

_LOCATIONS_CACHE_KEY = 'api_locations'
_LOCATIONS_CACHE_TTL = 300  # 5 minutes

class LocationViewSet(viewsets.ModelViewSet):
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Prefetch only location_name to avoid N+1 in accuracy_percentage calculation
        lean_jobs = Job.objects.only('location_name', 'location_id')
        return Location.objects.annotate(job_count=Count('jobs')).prefetch_related(
            Prefetch('jobs', queryset=lean_jobs)
        )

    def list(self, request, *args, **kwargs):
        data = cache.get(_LOCATIONS_CACHE_KEY)
        if data is None:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            data = serializer.data
            cache.set(_LOCATIONS_CACHE_KEY, data, _LOCATIONS_CACHE_TTL)
        return Response(data)

_STATS_CACHE_KEY = 'api_stats'
_STATS_CACHE_TTL = 30  # seconds

class StatsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        data = cache.get(_STATS_CACHE_KEY)
        if data is None:
            total_jobs = Job.objects.count()
            total_locations = Location.objects.count()
            active_sessions = ScrapeSession.objects.filter(status='running').count()
            last_session = ScrapeSession.objects.order_by('-start_time').first()
            data = {
                'total_jobs': total_jobs,
                'total_locations': total_locations,
                'active_sessions': active_sessions,
                'last_scrape_session': ScrapeSessionSerializer(last_session).data if last_session else None,
            }
            cache.set(_STATS_CACHE_KEY, data, _STATS_CACHE_TTL)
        return Response(data)

class TriggerScrapeView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # Allow if authenticated as admin OR if a secret key matches
        cron_secret = os.environ.get('CRON_SECRET', 'fallback_cron_secret')
        auth_header = request.headers.get('Authorization', '')
        
        is_cron_authorized = False
        if cron_secret and auth_header == f"Bearer {cron_secret}":
            is_cron_authorized = True
            
        # Check standard admin token if not cron authorized
        if not is_cron_authorized:
            if not (request.user and request.user.is_authenticated and request.user.is_superuser):
                return Response({'error': 'Authentication credentials were not provided or invalid.'}, status=401)

        search_terms = request.data.get('search_terms', None)
        search_term = request.data.get('search_term', 'frontend developer')
        results_wanted = request.data.get('results_wanted', 5)
        country = request.data.get('country', None)

        # Check if already running
        if ScrapeSession.objects.filter(status='running').exists():
            return Response({'status': 'Scraper already running'}, status=400)

        import threading
        from .scraper_utils import run_background_scraping, run_parallel_role_scraping

        if search_terms and isinstance(search_terms, list) and len(search_terms) > 1:
            thread = threading.Thread(
                target=run_parallel_role_scraping,
                args=(search_terms, results_wanted, country)
            )
        else:
            role = search_terms[0] if search_terms and isinstance(search_terms, list) else search_term
            thread = threading.Thread(
                target=run_background_scraping,
                args=(role, results_wanted, country)
            )

        thread.daemon = True
        thread.start()
        cache.delete(_STATS_CACHE_KEY)
        return Response({'status': 'Scrape triggered', 'roles': search_terms or [search_term]})

class StopScrapeView(views.APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        session = ScrapeSession.objects.filter(status='running').order_by('-start_time').first()
        if session:
            session.stop_requested = True
            session.save()
            cache.delete(_STATS_CACHE_KEY)
            cache.delete(_LOCATIONS_CACHE_KEY)
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
        cache.delete(_STATS_CACHE_KEY)
        cache.delete(_LOCATIONS_CACHE_KEY)
        return Response({'status': 'All sessions reset'})

class LogsView(generics.ListAPIView):
    serializer_class = ScrapeLogSerializer
    permission_classes = [permissions.IsAdminUser]


    def get(self, request):
        logs = ScrapeLog.objects.all().order_by('-timestamp')[:100]
        last_session = ScrapeSession.objects.all().order_by('-start_time').first()
        active_sessions = ScrapeSession.objects.filter(status='running').order_by('-start_time')
        return Response({
            'logs': ScrapeLogSerializer(logs, many=True).data,
            'session': ScrapeSessionSerializer(last_session).data if last_session else None,
            'active_sessions': ScrapeSessionSerializer(active_sessions, many=True).data,
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
        roles = cache.get('api_roles')
        if roles is None:
            path = os.path.join(settings.BASE_DIR, 'api', 'roles.json')
            try:
                with open(path, 'r') as f:
                    roles = json.load(f)
                cache.set('api_roles', roles, 3600)  # 1 hour — static file
            except Exception as e:
                return Response({"error": str(e)}, status=500)
        return Response(roles)

class FeedbackView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            feedback = Feedback.objects.get(user=request.user)
            return Response(FeedbackSerializer(feedback).data)
        except Feedback.DoesNotExist:
            return Response(None)

    def post(self, request):
        rating = request.data.get('rating')
        message = request.data.get('message', '')
        if rating is None:
            return Response({'error': 'Rating is required.'}, status=400)
        try:
            rating = int(rating)
        except (ValueError, TypeError):
            return Response({'error': 'Rating must be a number.'}, status=400)
        if not (1 <= rating <= 5):
            return Response({'error': 'Rating must be between 1 and 5.'}, status=400)

        feedback, created = Feedback.objects.update_or_create(
            user=request.user,
            defaults={'rating': rating, 'message': message}
        )
        return Response(FeedbackSerializer(feedback).data, status=201 if created else 200)

    def delete(self, request):
        try:
            Feedback.objects.get(user=request.user).delete()
            return Response({'status': 'deleted'})
        except Feedback.DoesNotExist:
            return Response({'error': 'No feedback found.'}, status=404)

class AdminFeedbackView(generics.ListAPIView):
    serializer_class = FeedbackSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = Feedback.objects.all().select_related('user').order_by('-created_at')
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        return queryset
