from rest_framework import viewsets, views, generics, permissions
from rest_framework.decorators import action
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from .models import Location, Job, ScrapeSession, ScrapeLog, Bookmark
from .serializers import LocationSerializer, JobSerializer, ScrapeSessionSerializer, ScrapeLogSerializer, UserSerializer, RegisterSerializer
from django.db.models import Count, Exists, OuterRef
from django.contrib.auth.models import User

class SignupView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

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
        # The serializer already handles source='profile.phone' etc.
        # But for nested updates, we usually need to handle them in the serializer's update method.
        # Let's check the serializer.
        serializer.save()

class LocationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Location.objects.prefetch_related('jobs').annotate(job_count=Count('jobs'))
    serializer_class = LocationSerializer
    permission_classes = [permissions.AllowAny]

class JobViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Job.objects.all()
    serializer_class = JobSerializer
    filterset_fields = ['location', 'site', 'is_remote']
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Job.objects.all()
        if self.request.user.is_authenticated:
            queryset = queryset.annotate(
                is_bookmarked=Exists(Bookmark.objects.filter(user=self.request.user, job=OuterRef('pk')))
            )
            
        location_id = self.request.query_params.get('location_id')
        if location_id:
            queryset = queryset.filter(location_id=location_id)
            
        bookmarked_only = self.request.query_params.get('bookmarked_only')
        if bookmarked_only == 'true' and self.request.user.is_authenticated:
            queryset = queryset.filter(bookmarked_by__user=self.request.user)
            
        return queryset

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def toggle_bookmark(self, request, pk=None):
        if not request.user.profile.is_subscribed:
            return Response({"error": "Only subscribed users can bookmark jobs"}, status=403)
            
        job = self.get_object()
        bookmark, created = Bookmark.objects.get_or_create(user=request.user, job=job)
        if not created:
            bookmark.delete()
            return Response({"status": "unbookmarked", "is_bookmarked": False})
        return Response({"status": "bookmarked", "is_bookmarked": True})

class StatsView(views.APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta
        three_days_ago_dt = timezone.now() - timedelta(hours=72)
        three_days_ago_date = three_days_ago_dt.date()
        
        total_jobs = Job.objects.count()
        
        from django.db.models import Q
        jobs_last_3_days = Job.objects.filter(
            Q(date_posted__gte=three_days_ago_date) | 
            Q(date_posted__isnull=True, created_at__gte=three_days_ago_dt)
        ).count()
        total_locations = Location.objects.count()
        last_session = ScrapeSession.objects.order_by('-start_time').first()
        
        return Response({
            'total_jobs': total_jobs,
            'jobs_last_3_days': jobs_last_3_days,
            'total_locations': total_locations,
            'last_scrape_session': ScrapeSessionSerializer(last_session).data if last_session else None,
            'jobs_by_site': Job.objects.values('site').annotate(count=Count('id'))
        })

class TriggerScrapeView(views.APIView):
    permission_classes = [permissions.IsAdminUser]
    def post(self, request):
        if ScrapeSession.objects.filter(status='running').exists():
            return Response({"status": "A scraping session is already running"}, status=400)
            
        search_term = request.data.get('search_term', 'frontend developer')
        results_wanted = int(request.data.get('results_wanted', 5))
        
        from .scraper_utils import run_background_scraping
        import threading
        thread = threading.Thread(target=run_background_scraping, args=(search_term, results_wanted))
        thread.start()
        return Response({"status": f"Scraping for '{search_term}' started in background"})

class StopScrapeView(views.APIView):
    permission_classes = [permissions.IsAdminUser]
    def post(self, request):
        session = ScrapeSession.objects.filter(status='running').order_by('-start_time').first()
        if session:
            session.stop_requested = True
            session.save()
            print(f"STOP signal received for Session {session.id}")
            return Response({"status": "Stop requested. Scraper will terminate shortly."})
        return Response({"status": "No active scraping session found."}, status=400)
class ForceResetView(views.APIView):
    permission_classes = [permissions.IsAdminUser]
    def post(self, request):
        count = ScrapeSession.objects.filter(status='running').update(status='stopped', stop_requested=False)
        return Response({"status": f"Force reset successful. {count} sessions stopped."})

class LogsView(views.APIView):
    permission_classes = [permissions.IsAdminUser]
    def get(self, request):
        session_id = request.query_params.get('session_id')
        if not session_id:
            session = ScrapeSession.objects.order_by('-start_time').first()
            if not session:
                return Response({"logs": [], "session": None})
        else:
            session = ScrapeSession.objects.filter(id=session_id).first()
            
        logs = ScrapeLog.objects.filter(session=session).order_by('timestamp')
        return Response({
            "logs": ScrapeLogSerializer(logs, many=True).data,
            "session": ScrapeSessionSerializer(session).data if session else None
        })

class RecentJobsView(generics.ListAPIView):
    queryset = Job.objects.order_by('-date_posted')[:10]
    serializer_class = JobSerializer
    permission_classes = [permissions.AllowAny]

class CheckExistenceView(views.APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        field = request.data.get('field')
        value = request.data.get('value')
        
        if not field or not value:
            return Response({"error": "Field and value are required"}, status=400)
            
        exists = False
        if field == 'username':
            exists = User.objects.filter(username=value).exists()
        elif field == 'email':
            exists = User.objects.filter(email=value).exists()
        elif field == 'phone':
            from .models import Profile
            exists = Profile.objects.filter(phone=value).exists()
        else:
            return Response({"error": "Invalid field"}, status=400)
            
        return Response({"exists": exists})

class SubscriptionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        from django.utils import timezone
        from datetime import timedelta
        profile = request.user.profile
        now = timezone.now()
        
        if profile.subscription_expires_at and profile.subscription_expires_at > now:
            profile.subscription_expires_at += timedelta(days=30)
        else:
            profile.subscription_expires_at = now + timedelta(days=30)
        
        profile.is_subscribed = True
        profile.save()
        
        return Response(UserSerializer(request.user).data)

class AdminLoginView(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
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
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]

class RolesView(views.APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        import os
        import json
        from django.conf import settings
        path = os.path.join(settings.BASE_DIR, 'api', 'roles.json')
        try:
            with open(path, 'r') as f:
                roles = json.load(f)
            return Response(roles)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
