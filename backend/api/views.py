from rest_framework import viewsets, views, generics, permissions
from rest_framework.pagination import PageNumberPagination
from .permissions import IsSubscribed

from rest_framework.decorators import action
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from .models import Location, Job, ScrapeSession, ScrapeLog, Bookmark, Feedback, Portfolio, Profile
from .serializers import (
    LocationSerializer, JobSerializer, JobMapPinSerializer, ScrapeSessionSerializer,
    ScrapeLogSerializer, UserSerializer, RegisterSerializer, RecentJobSerializer,
    FeedbackSerializer, PortfolioSettingsSerializer, PublicPortfolioSerializer
)
from django.db import models
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

class JobPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

_JOBS_CACHE_TTL = 120  # 2 minutes — matches the frontend's own client-side cache TTL

def _jobs_cache_version(user_id):
    """A per-user counter, bumped on bookmark changes, folded into cache keys below
    so a toggle invalidates that user's cached jobs/map_pins without tracking keys."""
    return cache.get(f'jobs_cache_v:{user_id}', 1)

def _bump_jobs_cache_version(user_id):
    cache.set(f'jobs_cache_v:{user_id}', _jobs_cache_version(user_id) + 1, None)

class JobViewSet(viewsets.ModelViewSet):
    serializer_class = JobSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = JobPagination

    _COUNTRY_MAP = {
        'USA': 'United States',
        'UK': 'United Kingdom',
    }

    def _cache_key(self, request, prefix, scoped_to_user):
        """scoped_to_user=False lets requests that don't depend on the caller's
        bookmarks (e.g. map_pins without bookmarked_only) share one cache entry
        across users instead of each user paying for their own copy."""
        query_str = '&'.join(f'{k}={v}' for k, v in sorted(request.query_params.items()))
        if scoped_to_user:
            version = _jobs_cache_version(request.user.id)
            return f'{prefix}:u{request.user.id}:v{version}:{query_str}'
        return f'{prefix}:anon:{query_str}'

    def _filter_queryset(self, queryset):
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

        location_query = self.request.query_params.get('location')
        if location_query:
            queryset = queryset.filter(
                models.Q(location_name__icontains=location_query) |
                models.Q(location__city__icontains=location_query) |
                models.Q(location__state__icontains=location_query)
            )

        is_remote = self.request.query_params.get('is_remote')
        if is_remote == 'true':
            queryset = queryset.filter(is_remote=True)

        return queryset

    def get_queryset(self):
        user = self.request.user
        queryset = Job.objects.select_related('location').annotate(
            is_bookmarked=Exists(
                Bookmark.objects.filter(user=user, job_id=OuterRef('pk'))
            )
        ).order_by('-created_at')

        queryset = self._filter_queryset(queryset)

        bookmarked_only = self.request.query_params.get('bookmarked_only')
        if bookmarked_only == 'true':
            queryset = queryset.filter(is_bookmarked=True)

        return queryset

    def list(self, request, *args, **kwargs):
        # Every job carries an is_bookmarked flag for this user, so the cache is
        # always scoped per-user and invalidated via the version bump below.
        cache_key = self._cache_key(request, 'api_jobs', scoped_to_user=True)
        data = cache.get(cache_key)
        if data is None:
            queryset = self.filter_queryset(self.get_queryset())
            page = self.paginate_queryset(queryset)
            serializer = self.get_serializer(page, many=True)
            data = self.get_paginated_response(serializer.data).data
            cache.set(cache_key, data, _JOBS_CACHE_TTL)
        return Response(data)

    @action(detail=True, methods=['post'])
    def toggle_bookmark(self, request, pk=None):
        job = self.get_object()
        bookmark, created = Bookmark.objects.get_or_create(user=request.user, job=job)
        _bump_jobs_cache_version(request.user.id)
        if not created:
            bookmark.delete()
            return Response({'status': 'unbookmarked', 'is_bookmarked': False})
        return Response({'status': 'bookmarked', 'is_bookmarked': True})

    @action(detail=False, methods=['get'])
    def map_pins(self, request):
        """All matching job coordinates, unpaginated — the map needs the full point
        set to draw correct clusters, but only needs a handful of fields per job.
        Uses .values() with a joined location fallback instead of the serializer so a
        large result set doesn't do one extra query per row (that N+1 is cheap on local
        SQLite but multiplies into a request timeout against a networked Postgres)."""
        bookmarked_only = request.query_params.get('bookmarked_only') == 'true'
        cache_key = self._cache_key(request, 'api_map_pins', scoped_to_user=bookmarked_only)
        pins = cache.get(cache_key)
        if pins is not None:
            return Response(pins)

        queryset = Job.objects.filter(latitude__isnull=False, longitude__isnull=False)
        queryset = self._filter_queryset(queryset)

        if bookmarked_only:
            queryset = queryset.filter(bookmarked_by__user=request.user)

        rows = queryset.values(
            'id', 'title', 'company', 'location_name', 'job_type', 'job_url',
            'latitude', 'longitude',
            'location__city', 'location__state', 'location__country',
        )

        pins = []
        for row in rows:
            name = row['location_name']
            if not name or str(name).strip().lower() in ('', 'nan', 'none'):
                parts = [p for p in (row['location__city'], row['location__state'], row['location__country']) if p]
                name = ', '.join(parts) if parts else None
            else:
                name = name.strip()
            pins.append({
                'id': row['id'],
                'title': row['title'],
                'company': row['company'],
                'location_name': name,
                'job_type': row['job_type'],
                'job_url': row['job_url'],
                'latitude': row['latitude'],
                'longitude': row['longitude'],
            })

        cache.set(cache_key, pins, _JOBS_CACHE_TTL)
        return Response(pins)


class CheckExistenceView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        field = request.data.get('field')
        value = (request.data.get('value') or '').strip()
        if not value:
            return Response({'exists': False})

        if field == 'username':
            exists = User.objects.filter(username__iexact=value).exists()
        elif field == 'email':
            exists = User.objects.filter(email__iexact=value).exists()
        elif field == 'phone':
            exists = Profile.objects.filter(phone=value).exists()
        else:
            return Response({'error': 'Invalid field'}, status=400)

        return Response({'exists': exists})


class RequestLogsView(views.APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        log_file = settings.LOGS_DIR / 'requests.log'
        try:
            raw = log_file.read_text(encoding='utf-8', errors='replace')
        except FileNotFoundError:
            raw = ''

        query = request.query_params.get('q', '').strip()
        try:
            max_lines = int(request.query_params.get('lines', 2000))
        except ValueError:
            max_lines = 2000
        max_lines = max(1, min(max_lines, 20000))

        all_lines = raw.splitlines()
        if query:
            all_lines = [line for line in all_lines if query.lower() in line.lower()]

        shown = all_lines[-max_lines:]

        return Response({
            'lines': shown,
            'total_matches': len(all_lines),
            'shown_count': len(shown),
        })

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
        return User.objects.select_related('profile', 'portfolio').order_by('-date_joined')

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


class PublicPortfolioView(views.APIView):
    """GET /api/portfolio/<username>/ — public, no auth required."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        try:
            user = User.objects.select_related('profile', 'portfolio').get(username=username)
        except User.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        profile = getattr(user, 'profile', None)
        if not profile or not profile.resume_text:
            return Response({'error': 'Portfolio not available.'}, status=404)

        portfolio = getattr(user, 'portfolio', None)
        if not portfolio:
            return Response({'error': 'Portfolio not found.'}, status=404)

        # Allow owner to view their own private portfolio
        is_owner = request.user.is_authenticated and request.user == user
        if not portfolio.is_public and not is_owner:
            return Response({'error': 'Portfolio not public.'}, status=404)

        serializer = PublicPortfolioSerializer(portfolio)
        return Response(serializer.data)


class MyPortfolioView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/portfolio/me/ — authenticated user managing their own portfolio."""
    serializer_class = PortfolioSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        portfolio, _ = Portfolio.objects.get_or_create(user=self.request.user)
        return portfolio


class MyPortfolioContentView(views.APIView):
    """GET/PATCH /api/portfolio/content/ — read and update the parsed resume data."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        return Response({'resume_parsed': profile.resume_parsed or {}})

    def patch(self, request):
        profile = request.user.profile
        resume_parsed = request.data.get('resume_parsed')
        if resume_parsed is None:
            return Response({'error': 'resume_parsed is required.'}, status=400)
        profile.resume_parsed = resume_parsed
        profile.save(update_fields=['resume_parsed'])
        return Response({'resume_parsed': profile.resume_parsed})
