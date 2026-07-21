from rest_framework import viewsets, views, generics, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.throttling import ScopedRateThrottle
from .permissions import IsSubscribed

from rest_framework.decorators import action
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from .models import Job, ScrapeSession, ScrapeLog, Bookmark, Feedback, Portfolio, PortfolioView, Profile, CustomCV, JobApplicationKit, Company
from .serializers import (
    JobSerializer, JobMapPinSerializer, ScrapeSessionSerializer,
    ScrapeLogSerializer, UserSerializer, RegisterSerializer, RecentJobSerializer,
    FeedbackSerializer, PortfolioSettingsSerializer, PublicPortfolioSerializer,
    PortfolioViewSerializer, CustomCVSerializer, CustomCVCreateSerializer, tailor_resume_with_groq,
    JobApplicationKitSerializer, generate_application_kit_with_groq, CompanySerializer,
    BookmarkSerializer, AdminJobSerializer,
)
from .google_auth import get_or_create_google_user
from scripts.ats_scoring import score_cv, get_profession_keywords, get_all_profession_keywords
from scripts.cv_export import render_cv_pdf, render_cv_docx
from django.http import HttpResponse
from django.db import models
from django.db.models import Exists, OuterRef, Q, Count
from django.db.models.functions import TruncMonth
from django.core.cache import cache
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import ipaddress
import os
import random
import requests
import time
from django.conf import settings
from user_agents import parse as parse_user_agent

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

class GoogleAuthView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        credential = request.data.get('credential')
        if not credential:
            return Response({"error": "Missing Google credential."}, status=400)

        try:
            user = get_or_create_google_user(credential)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)

        token, created = Token.objects.get_or_create(user=user)
        return Response({
            "user": UserSerializer(user).data,
            "token": token.key
        })

class UserView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
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
        return Job.objects.order_by('-created_at')[:limit]

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
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]
    pagination_class = JobPagination

    def get_permissions(self):
        # Jobs are populated by the scraper; only admins may create/edit/delete them.
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'bulk_delete'):
            return [permissions.IsAdminUser()]
        return super().get_permissions()

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        ids = request.data.get('ids')
        if not isinstance(ids, list) or not ids:
            return Response({'error': 'ids must be a non-empty list.'}, status=400)
        deleted_count, _ = Job.objects.filter(id__in=ids).delete()
        return Response({'deleted': deleted_count})

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
            queryset = queryset.filter(country__iexact=country_name)

        state = self.request.query_params.get('state')
        if state:
            queryset = queryset.filter(state__iexact=state)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(title__icontains=search) | queryset.filter(company__icontains=search)

        category = self.request.query_params.get('category')
        if category and category != 'All':
            queryset = queryset.filter(category__iexact=category)

        location_query = self.request.query_params.get('location')
        if location_query:
            queryset = queryset.filter(
                models.Q(location_name__icontains=location_query) |
                models.Q(city__icontains=location_query) |
                models.Q(state__icontains=location_query)
            )

        is_remote = self.request.query_params.get('is_remote')
        if is_remote == 'true':
            queryset = queryset.filter(is_remote=True)

        return queryset

    def get_queryset(self):
        user = self.request.user
        queryset = Job.objects.annotate(
            is_bookmarked=Exists(
                Bookmark.objects.filter(user=user, job_id=OuterRef('pk'))
            )
        ).order_by('-created_at')

        queryset = self._filter_queryset(queryset)

        bookmarked_only = self.request.query_params.get('bookmarked_only')
        if bookmarked_only == 'true':
            queryset = queryset.filter(is_bookmarked=True)

        return self._shuffle(queryset)

    def _shuffle(self, queryset):
        """Random order for browsing variety, but stable within one cache window
        so paginating doesn't repeat or skip jobs — it reshuffles only once the
        cached page results are due to go stale anyway."""
        ids = list(queryset.values_list('id', flat=True))
        if not ids:
            return queryset
        seed = int(timezone.now().timestamp() // _JOBS_CACHE_TTL)
        random.Random(seed).shuffle(ids)
        order = models.Case(*[models.When(pk=pk, then=pos) for pos, pk in enumerate(ids)])
        return queryset.order_by(order)

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

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        status_value = request.data.get('status')
        valid_statuses = dict(Bookmark._meta.get_field('status').choices)
        if status_value not in valid_statuses:
            return Response({'error': 'Invalid status'}, status=400)

        job = self.get_object()
        bookmark, created = Bookmark.objects.get_or_create(user=request.user, job=job)
        bookmark.status = status_value
        bookmark.save()
        if created:
            _bump_jobs_cache_version(request.user.id)
        return Response(BookmarkSerializer(bookmark, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def map_pins(self, request):
        """All matching job coordinates, unpaginated — the map needs the full point
        set to draw correct clusters, but only needs a handful of fields per job.
        Uses .values() instead of the serializer so a large result set doesn't do
        one extra query per row."""
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
            'latitude', 'longitude', 'city', 'state', 'country',
        )

        pins = []
        for row in rows:
            name = row['location_name']
            if not name or str(name).strip().lower() in ('', 'nan', 'none'):
                parts = [p for p in (row['city'], row['state'], row['country']) if p]
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


class ApplicationsView(views.APIView):
    """Every job the user has bookmarked/tracked, for the application-tracker
    Kanban board — grouped client-side by `status`."""
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def get(self, request):
        bookmarks = Bookmark.objects.filter(user=request.user).select_related('job').order_by('-status_updated_at')
        serializer = BookmarkSerializer(bookmarks, many=True, context={'request': request})
        return Response(serializer.data)


class CheckExistenceView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'check-existence'

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

_COUNTRIES_CACHE_KEY = 'api_countries'
_COUNTRIES_CACHE_TTL = 300  # 5 minutes

class CountriesView(views.APIView):
    """Distinct countries derived live from whatever jobs currently exist —
    always accurate, no stale entries left behind after jobs expire."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        countries = cache.get(_COUNTRIES_CACHE_KEY)
        if countries is None:
            countries = list(
                Job.objects.exclude(country='').values_list('country', flat=True)
                .distinct().order_by('country')
            )
            cache.set(_COUNTRIES_CACHE_KEY, countries, _COUNTRIES_CACHE_TTL)
        return Response(countries)

_STATS_CACHE_KEY = 'api_stats'
_STATS_CACHE_TTL = 30  # seconds

class StatsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        data = cache.get(_STATS_CACHE_KEY)
        if data is None:
            total_jobs = Job.objects.count()
            active_sessions = ScrapeSession.objects.filter(status='running').count()
            last_session = ScrapeSession.objects.order_by('-start_time').first()
            data = {
                'total_jobs': total_jobs,
                'active_sessions': active_sessions,
                'last_scrape_session': ScrapeSessionSerializer(last_session).data if last_session else None,
            }
            cache.set(_STATS_CACHE_KEY, data, _STATS_CACHE_TTL)
        return Response(data)

class TriggerCompanyScrapeView(views.APIView):
    permission_classes = [permissions.AllowAny]
    MAX_COMPANIES = 10

    def post(self, request):
        cron_secret = os.environ.get('CRON_SECRET')
        auth_header = request.headers.get('Authorization', '')

        is_cron_authorized = bool(cron_secret) and auth_header == f"Bearer {cron_secret}"
        if not is_cron_authorized:
            if not (request.user and request.user.is_authenticated and request.user.is_superuser):
                return Response({'error': 'Authentication credentials were not provided or invalid.'}, status=401)

        companies = request.data.get('companies')
        if not companies or not isinstance(companies, list):
            return Response({'error': 'companies must be a non-empty list of company names.'}, status=400)
        if len(companies) > self.MAX_COMPANIES:
            return Response({'error': f'Pick at most {self.MAX_COMPANIES} companies.'}, status=400)

        if ScrapeSession.objects.filter(status='running').exists():
            return Response({'status': 'Scraper already running'}, status=400)

        import threading
        from scripts.job_scraper import scrape_companies_by_names, log_to_db

        session = ScrapeSession.objects.create(
            status='running', search_term=f"company_career_pages:{','.join(companies)}", results_limit=0,
        )

        def _run():
            log_to_db(session, f"Starting career-page scrape for {', '.join(companies)}", "success")
            try:
                scrape_companies_by_names(companies, session=session)
                session.status = 'completed'
            except Exception as e:
                session.status = 'failed'
                session.error_message = str(e)
            session.current_location = None
            session.end_time = timezone.now()
            try:
                session.save()
            except Exception:
                # A stuck 'running' session blocks every future scrape attempt
                # (see the running-session check above), so retry once after a
                # beat rather than leaving it wedged on a transient DB lock.
                time.sleep(2)
                session.save()
            cache.delete(_STATS_CACHE_KEY)
            cache.delete(_COUNTRIES_CACHE_KEY)

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()
        cache.delete(_STATS_CACHE_KEY)
        return Response({'status': 'Company career-page scrape triggered', 'session_id': session.id})

class CompaniesPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 500  # lets callers like the "Scrape by Company" picker pull the full list in one request

class CompanyViewSet(viewsets.ModelViewSet):
    """Full CRUD for managing configured companies (add/edit/delete/activate)."""
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = CompaniesPagination

    def get_queryset(self):
        queryset = Company.objects.all().order_by(
            models.F('last_scraped_at').desc(nulls_last=True), '-created_at',
        )
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(models.Q(name__icontains=search) | models.Q(domain__icontains=search))
        return queryset

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk_create(self, request):
        """Add many companies at once, e.g. from an admin-uploaded CSV.
        Rows are validated independently so one bad row doesn't block the rest."""
        items = request.data.get('companies')
        if not isinstance(items, list) or not items:
            return Response({'error': 'companies must be a non-empty list.'}, status=400)

        created = []
        errors = []
        for idx, item in enumerate(items):
            serializer = CompanySerializer(data=item)
            if serializer.is_valid():
                serializer.save()
                created.append(serializer.data)
            else:
                errors.append({
                    'row': idx + 1,
                    'name': item.get('name', '') if isinstance(item, dict) else '',
                    'errors': serializer.errors,
                })

        cache.delete(_STATS_CACHE_KEY)
        return Response(
            {'created': created, 'errors': errors},
            status=201 if created else 400,
        )

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        ids = request.data.get('ids')
        if not isinstance(ids, list) or not ids:
            return Response({'error': 'ids must be a non-empty list.'}, status=400)
        deleted_count, _ = Company.objects.filter(id__in=ids).delete()
        cache.delete(_STATS_CACHE_KEY)
        return Response({'deleted': deleted_count})

class CompaniesView(views.APIView):
    """Paginated companies + their 10 most recent jobs each, for the admin
    dashboard's company cards. For CRUD management, see CompanyViewSet."""
    permission_classes = [permissions.IsAdminUser]
    RECENT_JOBS_PER_COMPANY = 10
    pagination_class = CompaniesPagination

    def get(self, request):
        companies_qs = (
            Company.objects.all()
            .order_by(models.F('last_scraped_at').desc(nulls_last=True), '-created_at')
            .values(
                'id', 'name', 'domain', 'career_url', 'contact_url', 'contact_email',
                'address', 'linkedin_url', 'logo_url', 'is_active', 'last_scraped_at',
            )
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(list(companies_qs), request, view=self)

        result = []
        for c in page:
            jobs_qs = Job.objects.filter(site__startswith='http', company=c['name'])
            total = jobs_qs.count()
            recent_jobs = jobs_qs.order_by('-date_posted', '-created_at')[:self.RECENT_JOBS_PER_COMPANY]
            jobs = [{
                'id': job.id,
                'title': job.title,
                'location_name': job.location_name,
                'is_remote': job.is_remote,
                'job_url': job.job_url,
                'date_posted': job.date_posted,
                'experience_required': job.experience_required,
                'salary': job.salary,
            } for job in recent_jobs]
            result.append({
                **c,
                'job_count': total,
                'jobs': jobs,
            })

        return paginator.get_paginated_response(result)

class AdminJobsView(generics.ListAPIView):
    """Paginated, filterable job listing for the admin dashboard's Jobs page.
    Read-only — jobs themselves are managed via the scraper, not hand-edited here."""
    serializer_class = AdminJobSerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = JobPagination

    def get_queryset(self):
        queryset = Job.objects.order_by('-created_at')

        company = self.request.query_params.get('company')
        if company:
            queryset = queryset.filter(company=company)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(title__icontains=search) | models.Q(company__icontains=search)
            )

        return queryset

class StopScrapeView(views.APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        session = ScrapeSession.objects.filter(status='running').order_by('-start_time').first()
        if session:
            session.stop_requested = True
            session.save()
            cache.delete(_STATS_CACHE_KEY)
            cache.delete(_COUNTRIES_CACHE_KEY)
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
        cache.delete(_COUNTRIES_CACHE_KEY)
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
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return User.objects.select_related('profile', 'portfolio').order_by('-date_joined')

class CategoriesView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from scripts.job_categorizer import CATEGORIES
        return Response(CATEGORIES)

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


def get_client_ip(request):
    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def get_device_info(user_agent_string):
    ua = parse_user_agent(user_agent_string or '')
    if ua.is_mobile:
        device = 'Mobile'
    elif ua.is_tablet:
        device = 'Tablet'
    elif ua.is_pc:
        device = 'Desktop'
    else:
        device = 'Other'
    return device, ua.browser.family or 'Other', ua.os.family or 'Other'


def resolve_country(ip):
    """Best-effort IP → country lookup via a free geolocation API, cached per IP
    for a day so repeat visitors don't cost a network call on every view."""
    if not ip:
        return '', ''
    try:
        if ipaddress.ip_address(ip).is_private:
            return '', ''
    except ValueError:
        return '', ''

    cache_key = f'portfolio_view_geo:{ip}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    country, country_code = '', ''
    try:
        resp = requests.get(
            f'http://ip-api.com/json/{ip}',
            params={'fields': 'status,country,countryCode'},
            timeout=2,
        )
        data = resp.json()
        if data.get('status') == 'success':
            country = data.get('country') or ''
            country_code = data.get('countryCode') or ''
    except Exception:
        pass

    cache.set(cache_key, (country, country_code), 60 * 60 * 24)
    return country, country_code


# Repeat hits from the same IP within this window (e.g. refreshes, the owner
# checking their own public link) count as one view rather than inflating the total.
PORTFOLIO_VIEW_DEDUPE_MINUTES = 30


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

        if not is_owner:
            ip = get_client_ip(request)
            recent_cutoff = timezone.now() - timedelta(minutes=PORTFOLIO_VIEW_DEDUPE_MINUTES)
            already_counted = PortfolioView.objects.filter(
                portfolio=portfolio, ip_address=ip, viewed_at__gte=recent_cutoff,
            ).exists()
            if not already_counted:
                device, browser, operating_system = get_device_info(request.META.get('HTTP_USER_AGENT', ''))
                country, country_code = resolve_country(ip)
                PortfolioView.objects.create(
                    portfolio=portfolio, ip_address=ip,
                    country=country, country_code=country_code,
                    device=device, browser=browser, operating_system=operating_system,
                )

        serializer = PublicPortfolioSerializer(portfolio)
        return Response(serializer.data)


class MyPortfolioView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/portfolio/me/ — authenticated user managing their own portfolio."""
    serializer_class = PortfolioSettingsSerializer
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def get_object(self):
        portfolio, _ = Portfolio.objects.get_or_create(user=self.request.user)
        return portfolio


class PortfolioAnalyticsView(views.APIView):
    """GET /api/portfolio/analytics/ — view stats for the authenticated user's own portfolio."""
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def get(self, request):
        portfolio, _ = Portfolio.objects.get_or_create(user=request.user)
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=7)
        month_start = now - timedelta(days=30)

        views_qs = PortfolioView.objects.filter(portfolio=portfolio)
        total_views = views_qs.count()
        recent_views = views_qs.order_by('-viewed_at')[:20]

        def breakdown(field):
            rows = (
                views_qs.exclude(**{field: ''})
                .values(field)
                .annotate(count=Count('id'))
                .order_by('-count')[:10]
            )
            return [
                {
                    'label': row[field],
                    'count': row['count'],
                    'percent': round(row['count'] / total_views * 100) if total_views else 0,
                }
                for row in rows
            ]

        countries = (
            views_qs.exclude(country='')
            .values('country', 'country_code')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )
        countries_data = [
            {
                'country': c['country'],
                'country_code': c['country_code'],
                'count': c['count'],
                'percent': round(c['count'] / total_views * 100) if total_views else 0,
            }
            for c in countries
        ]

        # Last 6 calendar months, oldest first, zero-filled where there's no data.
        months = []
        cursor = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        for _ in range(6):
            months.append(cursor)
            prev_month = cursor.month - 1 or 12
            prev_year = cursor.year - 1 if cursor.month == 1 else cursor.year
            cursor = cursor.replace(year=prev_year, month=prev_month)
        months.reverse()

        monthly_counts = (
            views_qs.filter(viewed_at__gte=months[0])
            .annotate(month=TruncMonth('viewed_at'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )
        counts_by_month = {row['month'].strftime('%Y-%m'): row['count'] for row in monthly_counts}
        monthly_views = [
            {
                'month': m.strftime('%Y-%m'),
                'label': m.strftime('%b'),
                'count': counts_by_month.get(m.strftime('%Y-%m'), 0),
            }
            for m in months
        ]

        return Response({
            'total_views': total_views,
            'views_today': views_qs.filter(viewed_at__gte=today_start).count(),
            'views_this_week': views_qs.filter(viewed_at__gte=week_start).count(),
            'views_this_month': views_qs.filter(viewed_at__gte=month_start).count(),
            'unique_viewers': views_qs.values('ip_address').distinct().count(),
            'countries': countries_data,
            'devices': breakdown('device'),
            'browsers': breakdown('browser'),
            'operating_systems': breakdown('operating_system'),
            'monthly_views': monthly_views,
            'recent_views': PortfolioViewSerializer(recent_views, many=True).data,
        })


class MyPortfolioContentView(views.APIView):
    """GET/PATCH /api/portfolio/content/ — read and update the parsed resume data."""
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

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


class CustomCVListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/custom-cv/ — list or create the user's custom CVs."""
    serializer_class = CustomCVSerializer
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def get_queryset(self):
        return CustomCV.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.resume_text:
            return Response({'error': 'Upload a resume before creating a custom CV.'}, status=400)
        serializer = CustomCVCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        cv = serializer.save()
        return Response(CustomCVSerializer(cv).data, status=201)


class AtsKeywordsView(views.APIView):
    """GET /api/custom-cv/keywords/ — profession -> ATS keyword list reference data,
    the same terms score_cv() checks target_role content against. Powers the
    "ATS mapping terms" panel on the custom CV list page.
    """
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def get(self, request):
        return Response(get_all_profession_keywords())


class CustomCVDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PATCH/DELETE /api/custom-cv/<id>/"""
    serializer_class = CustomCVSerializer
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def get_queryset(self):
        return CustomCV.objects.filter(user=self.request.user)


class CustomCVTailorView(views.APIView):
    """POST /api/custom-cv/<id>/tailor/ — rewrite content for a new target role."""
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def post(self, request, pk):
        try:
            cv = CustomCV.objects.get(pk=pk, user=request.user)
        except CustomCV.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        target_role = (request.data.get('target_role') or '').strip()
        if not target_role:
            return Response({'error': 'target_role is required.'}, status=400)

        keywords = get_profession_keywords(target_role)
        tailored = tailor_resume_with_groq(cv.content, target_role, keywords)
        if not tailored:
            return Response({'error': 'Failed to tailor resume. Please try again.'}, status=502)

        cv.content = tailored
        cv.target_role = target_role
        cv.ats_score, cv.ats_breakdown = score_cv(cv.content, target_role)
        cv.save()
        return Response(CustomCVSerializer(cv).data)


class CustomCVExportView(views.APIView):
    """GET /api/custom-cv/<id>/export/?type=pdf|docx"""
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def get(self, request, pk):
        try:
            cv = CustomCV.objects.get(pk=pk, user=request.user)
        except CustomCV.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        fmt = request.query_params.get('type', 'pdf')
        name = (cv.content.get('name') or request.user.get_full_name() or request.user.username or 'resume').strip()
        role = (cv.target_role or cv.content.get('role') or '').strip()
        filename = '_'.join(p for p in [name, role, 'CV'] if p).replace(' ', '_')

        if fmt == 'docx':
            data = render_cv_docx(cv.content)
            response = HttpResponse(
                data,
                content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}.docx"'
            return response
        elif fmt == 'pdf':
            data = render_cv_pdf(cv.content, cv.template)
            if data is None:
                return Response({'error': 'Failed to generate PDF.'}, status=500)
            response = HttpResponse(data, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}.pdf"'
            return response
        else:
            return Response({'error': 'format must be pdf or docx.'}, status=400)


class JobApplicationKitView(views.APIView):
    """GET/POST /api/jobs/<job_id>/application-kit/ — fetch or (re)generate a cover
    letter + common application Q&A for a job, tailored to the user's resume."""
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def get(self, request, job_id):
        kit = JobApplicationKit.objects.filter(user=request.user, job_id=job_id).first()
        if not kit:
            return Response({'error': 'Not found.'}, status=404)
        return Response(JobApplicationKitSerializer(kit).data)

    def post(self, request, job_id):
        try:
            job = Job.objects.get(pk=job_id)
        except Job.DoesNotExist:
            return Response({'error': 'Job not found.'}, status=404)

        profile = getattr(request.user, 'profile', None)
        content = profile.resume_parsed if profile else None
        if not content:
            return Response({'error': 'Upload a resume before generating a cover letter.'}, status=400)

        generated = generate_application_kit_with_groq(content, job.title, job.company, job.description)
        if not generated or not generated.get('cover_letter'):
            return Response({'error': 'Failed to generate. Please try again.'}, status=502)

        kit, _ = JobApplicationKit.objects.update_or_create(
            user=request.user, job=job,
            defaults={'cover_letter': generated.get('cover_letter', ''), 'qa': generated.get('qa', [])},
        )
        return Response(JobApplicationKitSerializer(kit).data)
