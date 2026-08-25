from rest_framework import viewsets, views, generics, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.throttling import ScopedRateThrottle
from .permissions import IsSubscribed, is_user_subscribed

from rest_framework.decorators import action
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from .models import Job, Bookmark, Feedback, Portfolio, PortfolioView, Profile, CustomCV, JobApplicationKit, Company, ScraperRun
from .serializers import (
    JobSerializer, JobMapPinSerializer,
    UserSerializer, RegisterSerializer, RecentJobSerializer,
    FeedbackSerializer, PortfolioSettingsSerializer, PublicPortfolioSerializer,
    PortfolioViewSerializer, CustomCVSerializer, CustomCVCreateSerializer, tailor_resume_with_groq,
    JobApplicationKitSerializer, generate_application_kit_with_groq, CompanySerializer,
    BookmarkSerializer, AdminJobSerializer, ChangePasswordSerializer, AdminSetPasswordSerializer,
)
from .google_auth import get_or_create_google_user, _unique_username_from_email
from .email_otp import create_otp, verify_otp
from .referrals import attach_referral
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from scripts.ats_scoring import score_cv, get_profession_keywords, get_all_profession_keywords
from scripts.cv_export import render_cv_pdf, render_cv_docx
from django.http import HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.db import models
from django.db.models import Exists, OuterRef, Q, Count
from django.db.models.functions import TruncMonth
from django.core.cache import cache
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import ipaddress
import json
import logging
import random
import requests
import threading
import time
from django.conf import settings

logger = logging.getLogger(__name__)

class _RunRegistry:
    """Tracks in-flight (and just-finished) scraper syncs (RunScraperScriptView)
    so the admin dashboard can list what's running, request a cooperative
    stop, and poll for each board's logs/result.

    RunScraperScriptView used to stream progress back over the same HTTP
    connection that kicked the run off, but a sync that's geocode-heavy can
    run for minutes (Nominatim caps out around one request per 2s — see
    scripts/geocode_jobs.py) — long enough for a browser/proxy/host timeout
    to kill that connection well before the run itself finishes server-side,
    which showed up to the admin as a false "failed" even though the sync
    completed fine in its background thread. Decoupling the run from the
    request means the registry itself has to hold each board's logs/result
    until the dashboard's poll picks them up, instead of just tracking that
    a board is busy.

    Also doubles as the guard against running the same board twice at once
    (a double-click or a second admin tab), which can exceed SQLite's write
    lock busy-timeout on large boards.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._runs = {}  # normalized board name -> run info dict

    def start(self, board, script):
        """Reserves `board`, returning its stop_event, or None if it's
        already running (a previous run that finished is fair game to
        reserve again — its stale logs/result get overwritten here)."""
        key = board.strip().lower()
        with self._lock:
            existing = self._runs.get(key)
            if existing and not existing['done']:
                return None
            stop_event = threading.Event()
            self._runs[key] = {
                'board': board, 'script': script, 'started_at': time.time(),
                'stop_event': stop_event, 'done': False, 'logs': [], 'result': None,
            }
            return stop_event

    def cancel(self, board):
        """Pops a reservation that never actually started running — used to
        roll back a batch when a later board in the same request turns out
        to already be running. (Distinct from `finish`, which marks a real
        run's completion and keeps its result around for polling.)"""
        with self._lock:
            self._runs.pop(board.strip().lower(), None)

    def log(self, board, message):
        with self._lock:
            run = self._runs.get(board.strip().lower())
            if run:
                run['logs'].append(message)

    def finish(self, board, result=None):
        with self._lock:
            run = self._runs.get(board.strip().lower())
            if run:
                run['done'] = True
                if result is not None:
                    run['result'] = result

    def is_running(self, board):
        with self._lock:
            run = self._runs.get(board.strip().lower())
            return bool(run and not run['done'])

    def list(self):
        with self._lock:
            return [
                {'board': r['board'], 'script': r['script'], 'started_at': r['started_at']}
                for r in self._runs.values() if not r['done']
            ]

    def status(self, boards):
        """Returns {requested board name: {logs, done, result} | None} —
        None for a board that was never reserved (or a very first poll that
        raced the reservation). Delivered logs are drained so a board that's
        still running doesn't get the same lines re-sent on the next poll."""
        with self._lock:
            out = {}
            for board in boards:
                run = self._runs.get(board.strip().lower())
                if not run:
                    out[board] = None
                    continue
                logs, run['logs'] = run['logs'], []
                out[board] = {'logs': logs, 'done': run['done'], 'result': run['result']}
            return out

    def stop(self, board):
        with self._lock:
            run = self._runs.get(board.strip().lower())
        if not run:
            return False
        run['stop_event'].set()
        return True

    def stop_all(self):
        with self._lock:
            runs = [r for r in self._runs.values() if not r['done']]
        for run in runs:
            run['stop_event'].set()
        return [r['board'] for r in runs]

_run_registry = _RunRegistry()
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

        attach_referral(user.profile, request.data.get('referral_code'))

        token, created = Token.objects.get_or_create(user=user)
        return Response({
            "user": UserSerializer(user).data,
            "token": token.key
        })

class RequestEmailOtpView(views.APIView):
    """Issues a one-time code for the given email and hands the raw code back
    to the caller so it can be emailed. Only callable by the frontend server
    (which owns SMTP delivery), authenticated via a shared secret bearer token.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'email-otp-request'
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        internal_secret = settings.OTP_INTERNAL_SECRET
        auth_header = request.headers.get('Authorization', '')
        if not internal_secret or auth_header != f"Bearer {internal_secret}":
            return Response({"error": "Not authorized."}, status=401)

        email = (request.data.get('email') or '').strip().lower()
        purpose = request.data.get('purpose')
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({"error": "Enter a valid email address."}, status=400)

        if purpose == 'signup' and User.objects.filter(email__iexact=email).exists():
            return Response({"error": "Email is already registered. Please log in instead."}, status=400)

        try:
            code = create_otp(email)
        except ValueError as e:
            return Response({"error": str(e)}, status=429)

        return Response({"code": code})


class VerifyEmailOtpView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'email-otp-verify'
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        code = (request.data.get('code') or '').strip()
        if not email or not code:
            return Response({"error": "Email and code are required."}, status=400)

        try:
            verify_otp(email, code)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)

        user = User.objects.filter(email__iexact=email).first()
        created = False
        if not user:
            user = User.objects.create_user(username=_unique_username_from_email(email), email=email)
            user.set_unusable_password()
            user.save()
            created = True

        attach_referral(user.profile, request.data.get('referral_code'))

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            "user": UserSerializer(user).data,
            "token": token.key,
            "created": created,
        })


class ConfirmEmailOtpView(views.APIView):
    """Verify-only variant used to gate the signup wizard's Contact Details
    step — unlike VerifyEmailOtpView, this never creates or logs in a user;
    it just checks the code and leaves EmailOTP.is_used=True as the proof
    RegisterSerializer looks for at final submission.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'email-otp-verify'
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        code = (request.data.get('code') or '').strip()
        if not email or not code:
            return Response({"error": "Email and code are required."}, status=400)

        try:
            verify_otp(email, code)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)

        return Response({"verified": True})


class UserView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_object(self):
        return self.request.user
    def perform_update(self, serializer):
        serializer.save()

class ChangePasswordView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Password updated successfully.'})

class RecentJobsView(generics.ListAPIView):
    serializer_class = RecentJobSerializer
    permission_classes = [permissions.AllowAny]
    def get_queryset(self):
        limit = int(self.request.query_params.get('limit', 10))
        limit = min(limit, 299)
        return Job.objects.order_by('?')[:limit]

class JobPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

_JOBS_CACHE_TTL = 120  # 2 minutes — matches the frontend's own client-side cache TTL
FREE_PREVIEW_LIMIT = 200  # non-subscribers get a capped, most-recent-first taste of the map/list
_SHUFFLE_PRIME = 2147483647  # 2**31 - 1, a Mersenne prime — see _shuffle()

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
        # Only admins may create/edit/delete jobs.
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'bulk_delete'):
            return [permissions.IsAdminUser()]
        # list/map_pins are open to any authenticated user — non-subscribers get a
        # capped, recent-jobs preview instead of a 403 (see get_queryset/map_pins).
        # toggle_bookmark is a free feature — bookmarking shouldn't require a subscription.
        if self.action in ('list', 'map_pins', 'toggle_bookmark'):
            return [permissions.IsAuthenticated()]
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

        if not is_user_subscribed(user):
            # Free preview: most-recent jobs only, no shuffle/pagination depth.
            return queryset.order_by('-created_at')[:FREE_PREVIEW_LIMIT]

        return self._shuffle(queryset)

    def get_object(self):
        # Detail actions (toggle_bookmark, update_status, retrieve/update/destroy)
        # look a job up by its exact pk, so the free-preview cap in get_queryset()
        # — which caps non-subscribers' *list*/map_pins browsing to the most
        # recent FREE_PREVIEW_LIMIT jobs — doesn't belong here. Without this
        # override, DRF's default get_object() reuses that same sliced
        # queryset, so a non-subscriber toggling a bookmark on any job outside
        # that recent slice got a spurious 404, even though bookmarking is
        # meant to be free regardless of subscription (see get_permissions).
        queryset = Job.objects.annotate(
            is_bookmarked=Exists(Bookmark.objects.filter(user=self.request.user, job_id=OuterRef('pk')))
        )
        obj = get_object_or_404(queryset, pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, obj)
        return obj

    def _shuffle(self, queryset):
        """Random order for browsing variety, but stable within one cache window
        so paginating doesn't repeat or skip jobs — it reshuffles only once the
        cached page results are due to go stale anyway.

        Used to materialize every matching id into Python and order by a
        Case/When with one WHEN per row — which meant one bound SQL parameter
        per row, and broke outright ("too many SQL variables") once the Job
        table passed SQLite's ~32k bound-parameter ceiling. Instead, scramble
        each row's id with a per-window linear hash computed in SQL:
        (id * multiplier + offset) mod P. P is prime, so any nonzero
        multiplier mod P is automatically coprime with it, which makes the
        map a bijection over 0..P-1 — i.e. a real permutation, not just a
        handful of collisions. multiplier and offset are re-rolled from the
        same time-bucketed seed as before, so the permutation itself changes
        each window rather than just rotating the previous one. Cost is two
        bound parameters no matter how large the table gets.
        """
        seed = int(timezone.now().timestamp() // _JOBS_CACHE_TTL)
        rng = random.Random(seed)
        multiplier = rng.randrange(1, _SHUFFLE_PRIME)
        offset = rng.randrange(0, _SHUFFLE_PRIME)
        shuffle_key = models.ExpressionWrapper(
            (models.F('id') * multiplier + offset) % _SHUFFLE_PRIME,
            output_field=models.BigIntegerField(),
        )
        return queryset.annotate(_shuffle_key=shuffle_key).order_by('_shuffle_key')

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
        subscribed = is_user_subscribed(request.user)
        # Tier goes in the prefix so a free-preview response never leaks into a
        # subscriber's cache entry (or vice versa) for the same filter params.
        cache_prefix = 'api_map_pins' if subscribed else 'api_map_pins_free'
        cache_key = self._cache_key(request, cache_prefix, scoped_to_user=bookmarked_only)
        pins = cache.get(cache_key)
        if pins is not None:
            return Response(pins)

        queryset = Job.objects.filter(latitude__isnull=False, longitude__isnull=False)
        queryset = self._filter_queryset(queryset)

        if bookmarked_only:
            queryset = queryset.filter(bookmarked_by__user=request.user)

        if not subscribed:
            # Free preview: most-recent jobs only, so non-subscribers still see
            # activity on the map without giving away the full unlimited set.
            queryset = queryset.order_by('-created_at')[:FREE_PREVIEW_LIMIT]

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
    Kanban board — grouped client-side by `status`. Open to any authenticated
    user (read-only view); actually changing a card's status or bookmarking a
    job still requires a subscription via JobViewSet's IsSubscribed actions."""
    permission_classes = [permissions.IsAuthenticated]

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
            data = {
                'total_jobs': total_jobs,
            }
            cache.set(_STATS_CACHE_KEY, data, _STATS_CACHE_TTL)
        return Response(data)

class CompaniesPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 2000

class CompanyViewSet(viewsets.ModelViewSet):
    """Full CRUD for managing configured companies (add/edit/delete/activate)."""
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = CompaniesPagination

    def get_queryset(self):
        queryset = Company.objects.all().order_by('-created_at')
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
            # Most recently scraped first; never-scraped companies (null)
            # sort to the end rather than the default (nulls-first on desc).
            .order_by(models.F('last_scraped_at').desc(nulls_last=True))
            .values(
                'id', 'name', 'domain', 'career_url', 'contact_url', 'contact_email',
                'address', 'linkedin_url', 'logo_url', 'is_active', 'last_scraped_at',
            )
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(list(companies_qs), request, view=self)

        # light=true skips the recent-jobs fetch below (2 queries per company —
        # painfully slow once there are hundreds of companies) for callers that
        # only need name + job_count.
        if request.query_params.get('light') == 'true':
            names = [c['name'] for c in page]
            counts = dict(
                Job.objects.filter(site__startswith='http', company__in=names)
                .values('company')
                .annotate(count=Count('id'))
                .values_list('company', 'count')
            )
            result = [{**c, 'job_count': counts.get(c['name'], 0), 'jobs': []} for c in page]
            return paginator.get_paginated_response(result)

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

class JobsMissingCoordinatesView(views.APIView):
    """Companies that have at least one job with no coordinates, most-affected
    first — feeds the Jobs page's "Run Geocode" picker so an admin can jump
    straight to the boards that actually need it instead of hunting through
    the full company filter dropdown."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        rows = (
            Job.objects.filter(latitude__isnull=True)
            .values('company')
            .annotate(missing=Count('id'))
            .order_by('-missing')
        )
        companies = [r['company'] for r in rows]
        totals = dict(
            Job.objects.filter(company__in=companies)
            .values('company')
            .annotate(total=Count('id'))
            .values_list('company', 'total')
        )
        return Response([
            {'company': r['company'], 'missing': r['missing'], 'total': totals.get(r['company'], r['missing'])}
            for r in rows
        ])

class AdminJobsView(generics.ListAPIView):
    """Paginated, filterable job listing for the admin dashboard's Jobs page."""
    serializer_class = AdminJobSerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = JobPagination

    def get_queryset(self):
        # Jobs missing coordinates first (they're the ones needing admin
        # attention — see the Jobs page's "Run Geocode" picker), most
        # recent first within each of those two groups.
        queryset = Job.objects.annotate(
            missing_coords=models.Case(
                models.When(latitude__isnull=True, then=models.Value(0)),
                default=models.Value(1),
                output_field=models.IntegerField(),
            )
        ).order_by('missing_coords', '-created_at')

        company = self.request.query_params.get('company')
        if company:
            queryset = queryset.filter(company=company)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(title__icontains=search) | models.Q(company__icontains=search)
            )

        return queryset

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Stats reflect the current filter set (company/search), not just the
        # current page, so switching filters updates the summary card too.
        aggregates = self.get_queryset().aggregate(
            with_coordinates=Count('id', filter=Q(latitude__isnull=False, longitude__isnull=False)),
            most_recent_posted=models.Max('date_posted'),
            oldest_posted=models.Min('date_posted'),
        )
        response.data['stats'] = aggregates
        return response

class RunScraperScriptView(views.APIView):
    """Lets an admin trigger a job-import script for up to 3 companies at a
    time from the dashboard, instead of running e.g. scripts/jobs/ashbyhq.py
    by hand from a terminal.

    The companies run concurrently (scripts.jobs.*.run_many spins up one
    thread per board), so a 3-company run takes roughly as long as the
    slowest board instead of the sum of all three.

    This kicks the run off in a background thread and returns immediately —
    it used to stream progress back over the same HTTP connection that
    triggered it, but a geocode-heavy sync can run for minutes (see
    _RunRegistry's docstring), long enough for a browser/proxy/host timeout
    to kill that connection well before the run itself finished, which
    looked to the admin like a failure even though the sync completed fine.
    The frontend instead polls RunScriptStatusView for each board's
    logs/result, which _run_registry now holds onto until read.
    """
    permission_classes = [permissions.IsAdminUser]

    # script key -> display name. Each key must match a scripts/jobs/{key}.py
    # module exposing a sync_board(board_name) generator (see ashbyhq.py).
    SCRIPTS = {'ashbyhq': 'Ashby', 'greenhouse': 'Greenhouse', 'recruitee': 'Recruitee', 'lever': 'Lever', 'workable': 'Workable', 'epam': 'EPAM'}

    def post(self, request):
        script = request.data.get('script')
        if script not in self.SCRIPTS:
            return Response({'error': f"Unknown script '{script}'. Choose one of: {', '.join(self.SCRIPTS)}"}, status=400)

        companies = request.data.get('companies')
        if not isinstance(companies, list) or not (1 <= len(companies) <= 3):
            return Response({'error': 'Provide 1 to 3 company names.'}, status=400)
        requested = [c.strip() for c in companies if (c or '').strip()]
        if not requested:
            return Response({'error': 'Provide 1 to 3 company names.'}, status=400)

        # Two concurrent syncs writing thousands of rows each for the same
        # (or even different) companies can exceed SQLite's busy-timeout and
        # fail with "database is locked" — reject a board that's already
        # mid-run rather than let a double-click or a second admin tab
        # trigger that. Reserve them all in one pass so two overlapping
        # requests can't both pass the check for different boards, then
        # partially collide.
        stop_events = {}
        runs = {}
        reserved = []
        for board in requested:
            stop_event = _run_registry.start(board, script)
            if stop_event is None:
                for r in reserved:
                    _run_registry.cancel(r)
                return Response(
                    {'error': f"Already running: {board}. Wait for that run to finish first."}, status=409,
                )
            reserved.append(board)
            stop_events[board.strip().lower()] = stop_event
            runs[board.strip().lower()] = ScraperRun.objects.create(script=script, board=board)

        # Imported lazily (and dynamically, by validated script key) so a
        # module's own django.setup() call never runs during Django's own
        # app loading.
        import importlib
        run_many = importlib.import_module(f'scripts.jobs.{script}').run_many

        def on_log(board_name, message):
            _run_registry.log(board_name, message)

        def on_result(board_name, result):
            _run_registry.finish(board_name, result)
            run = runs.get(board_name.strip().lower())
            if run is None:
                return
            run.status = 'stopped' if result.get('stopped') else ('success' if result.get('ok') else 'failed')
            run.finished_at = timezone.now()
            for field in ('fetched', 'created', 'updated', 'geocoded', 'borrowed', 'removed'):
                setattr(run, field, result.get(field) or 0)
            run.error = result.get('error') or ''
            run.save()

        def runner():
            try:
                run_many(requested, on_log=on_log, on_result=on_result, stop_events=stop_events)
            finally:
                # Belt-and-suspenders: on_result already marks each board
                # done as it finishes, but this covers a run_many failure
                # that never gets that far for some board.
                for board in requested:
                    _run_registry.finish(board)
                for run in runs.values():
                    if run.status == 'running':
                        run.status = 'failed'
                        run.finished_at = timezone.now()
                        run.error = run.error or 'Run ended unexpectedly without reporting a result.'
                        run.save()

        threading.Thread(target=runner, daemon=True).start()
        return Response({'started': requested}, status=202)

class RunScriptStatusView(views.APIView):
    """Polled by the dashboard while a run kicked off via RunScraperScriptView
    is in flight: `?boards=Board1,Board2` returns each board's log lines
    collected since the last poll plus its result once done, e.g.
      {"Board1": {"logs": ["Fetching ..."], "done": false, "result": null},
       "Board2": {"logs": [], "done": true, "result": {"ok": true, ...}}}
    A board missing from the registry entirely (never reserved, or a poll
    that raced the very first reservation) comes back as `null`.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        boards = [b for b in (request.query_params.get('boards') or '').split(',') if b.strip()]
        if not boards:
            return Response({'error': 'Provide boards as a comma-separated ?boards= query param.'}, status=400)
        return Response(_run_registry.status(boards))

class RunningScriptsView(views.APIView):
    """Lists scraper syncs currently in flight — started via
    RunScraperScriptView from any admin session, or by the background
    auto-scrape scheduler (see api.scheduler) — for the dashboard's "Active
    Runs" card. Backed by ScraperRun rather than _run_registry so it
    reflects the database (survives a dashboard reload/deploy) instead of
    just this process's in-memory state."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        return Response([
            {'board': r['board'], 'script': r['script'], 'started_at': r['started_at'].timestamp()}
            for r in ScraperRun.objects.filter(status='running').values('board', 'script', 'started_at')
        ])

class StopScriptView(views.APIView):
    """Requests a cooperative stop for one running board (`{"board": "X"}`)
    or all of them (`{"all": true}`). The board's own sync loop checks a
    shared flag between steps and exits early on its own — a real OS
    thread can't be killed from outside — so stopping isn't instant and
    whatever's already been fetched/geocoded up to that point stays saved."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        if request.data.get('all'):
            stopped = _run_registry.stop_all()
            return Response({'stopped': stopped})

        board = (request.data.get('board') or '').strip()
        if not board:
            return Response({'error': 'Provide a board name or {"all": true}.'}, status=400)
        if not _run_registry.stop(board):
            return Response({'error': f"'{board}' isn't currently running."}, status=404)
        return Response({'stopped': [board]})

class RunGeocodeView(views.APIView):
    """Lets an admin trigger the coordinate backfill (scripts/geocode_jobs.py)
    for one company or the whole table from the Jobs page, instead of running
    it by hand from a terminal.

    Streams newline-delimited JSON as it runs, same shape as
    RunScraperScriptView:
      {"type": "log", "message": "..."}                  — progress line
      {"type": "result", "ok": true, ...stats}
      {"type": "result", "ok": false, "error": "..."}
      {"type": "done"}                                     — always last
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        company = (request.data.get('company') or '').strip() or None

        # Imported lazily so its django.setup() call never runs during
        # Django's own app loading.
        from scripts.geocode_jobs import run_streaming

        def event_stream():
            try:
                stats = None
                for item in run_streaming(company=company):
                    if isinstance(item, dict):
                        stats = item
                    else:
                        yield json.dumps({'type': 'log', 'message': item}) + '\n'
                yield json.dumps({'type': 'result', 'ok': True, **stats}) + '\n'
            except Exception as e:
                yield json.dumps({'type': 'result', 'ok': False, 'error': str(e)}) + '\n'
            yield json.dumps({'type': 'done'}) + '\n'

        return StreamingHttpResponse(event_stream(), content_type='application/x-ndjson')

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

    @action(detail=True, methods=['post'], url_path='set-password')
    def set_password(self, request, pk=None):
        user = self.get_object()
        serializer = AdminSetPasswordSerializer(data=request.data, context={'user': user})
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'detail': 'Password updated successfully.'})

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

    try:
        resp = requests.get(
            f'http://ip-api.com/json/{ip}',
            params={'fields': 'status,country,countryCode'},
            timeout=4,
        )
        data = resp.json()
    except Exception:
        logger.warning('portfolio geo lookup failed for %s', ip, exc_info=True)
        # Transient (timeout/network) failure — don't cache it, so the next
        # view for this IP gets a fresh retry instead of a 24h blank result.
        return '', ''

    country, country_code = '', ''
    if data.get('status') == 'success':
        country = data.get('country') or ''
        country_code = data.get('countryCode') or ''
    else:
        logger.warning('portfolio geo lookup returned non-success for %s: %s', ip, data)

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

        # Touching subscription status here (not just on the owner's own requests)
        # means a lapsed-but-still-public portfolio gets flipped private the moment
        # anyone loads the link, not only the next time the owner is active.
        is_user_subscribed(user)

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
    """GET/PATCH /api/portfolio/me/ — authenticated user managing their own portfolio.
    Open to any authenticated user so free users can build/preview a portfolio;
    going public requires an active subscription (see update())."""
    serializer_class = PortfolioSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        portfolio, _ = Portfolio.objects.get_or_create(user=self.request.user)
        return portfolio

    def update(self, request, *args, **kwargs):
        if not is_user_subscribed(request.user):
            portfolio = self.get_object()
            # Only block the false->true transition — saving other settings on an
            # already-public portfolio (e.g. after a subscription lapses) still works.
            if request.data.get('is_public') and not portfolio.is_public:
                return Response({'error': 'Subscribe to make your portfolio public.'}, status=403)
            for field in ('template', 'theme'):
                if field in request.data and request.data[field] != getattr(portfolio, field):
                    return Response({'error': 'Subscribe to change your portfolio template or theme.'}, status=403)
        return super().update(request, *args, **kwargs)


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


CUSTOM_CV_FREE_LIMIT = 1  # non-subscribers may keep at most one custom CV; more requires a subscription

def _free_cv_id(user):
    """Which of a user's CVs stays usable without a subscription — the oldest
    one (e.g. built while subscribed, or the original free CV). Used both to
    cap new creation and to lock the rest if a subscription lapses with
    multiple CVs already on the account."""
    first = CustomCV.objects.filter(user=user).order_by('created_at', 'id').first()
    return first.id if first else None

def _is_cv_locked(user, cv):
    return not is_user_subscribed(user) and cv.id != _free_cv_id(user)

class CustomCVListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/custom-cv/ — list or create the user's custom CVs.
    Open to any authenticated user so free users can build one CV; creating
    beyond CUSTOM_CV_FREE_LIMIT requires an active subscription."""
    serializer_class = CustomCVSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CustomCV.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.resume_text:
            return Response({'error': 'Upload a resume before creating a custom CV.'}, status=400)
        if not is_user_subscribed(request.user) and CustomCV.objects.filter(user=request.user).count() >= CUSTOM_CV_FREE_LIMIT:
            return Response({'error': 'Free plan allows 1 custom CV. Subscribe to create more.'}, status=403)
        serializer = CustomCVCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        cv = serializer.save()
        return Response(CustomCVSerializer(cv).data, status=201)


class AtsKeywordsView(views.APIView):
    """GET /api/custom-cv/keywords/ — profession -> ATS keyword list reference data,
    the same terms score_cv() checks target_role content against. Powers the
    "ATS mapping terms" panel on the custom CV list page.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(get_all_profession_keywords())


class CustomCVDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PATCH/DELETE /api/custom-cv/<id>/ — scoped to the caller's own CVs,
    so a free user can still fully use their one allotted CV. If a subscription
    lapses while multiple CVs exist, only _free_cv_id stays usable at all — the
    rest are fully locked (not even viewable) until re-subscribing, though they
    can still be deleted to free up the slot."""
    serializer_class = CustomCVSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CustomCV.objects.filter(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        if _is_cv_locked(request.user, self.get_object()):
            return Response({'error': 'Subscribe to open this CV.'}, status=403)
        return super().retrieve(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if _is_cv_locked(request.user, self.get_object()):
            return Response({'error': 'Subscribe to edit this CV.'}, status=403)
        return super().update(request, *args, **kwargs)


class CustomCVTailorView(views.APIView):
    """POST /api/custom-cv/<id>/tailor/ — rewrite content for a new target role.
    AI retargeting is a premium feature outright — unlike editing/exporting,
    it's gated by subscription status alone, even on the one free CV."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            cv = CustomCV.objects.get(pk=pk, user=request.user)
        except CustomCV.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        if not is_user_subscribed(request.user):
            return Response({'error': 'Subscribe to retarget a CV for a new role.'}, status=403)

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
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            cv = CustomCV.objects.get(pk=pk, user=request.user)
        except CustomCV.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

        if _is_cv_locked(request.user, cv):
            return Response({'error': 'Subscribe to export this CV.'}, status=403)

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
        if not profile or not profile.resume:
            return Response({'error': 'Upload a resume before generating a cover letter.'}, status=400)

        content = profile.resume_parsed
        if not content:
            # A resume file exists but parsing it never succeeded (e.g. the AI
            # parser errored or is temporarily down) — distinct from never
            # having uploaded one at all, so say so instead of telling the
            # user to do something they already did.
            return Response(
                {'error': "We couldn't read your resume. Try re uploading it, or try again in a bit."},
                status=502,
            )

        generated = generate_application_kit_with_groq(content, job.title, job.company, job.description)
        if not generated or not generated.get('cover_letter'):
            return Response({'error': 'Failed to generate. Please try again.'}, status=502)

        kit, _ = JobApplicationKit.objects.update_or_create(
            user=request.user, job=job,
            defaults={'cover_letter': generated.get('cover_letter', ''), 'qa': generated.get('qa', [])},
        )
        return Response(JobApplicationKitSerializer(kit).data)
