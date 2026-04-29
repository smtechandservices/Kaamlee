from rest_framework import viewsets, views, generics, permissions
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from .models import Location, Job, ScrapeSession, ScrapeLog
from .serializers import LocationSerializer, JobSerializer, ScrapeSessionSerializer, ScrapeLogSerializer, UserSerializer, RegisterSerializer
from django.db.models import Count
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
        queryset = super().get_queryset()
        location_id = self.request.query_params.get('location_id')
        if location_id:
            queryset = queryset.filter(location_id=location_id)
        return queryset

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
            
        from .scraper_utils import run_background_scraping
        import threading
        thread = threading.Thread(target=run_background_scraping)
        thread.start()
        return Response({"status": "Scraping started in background"})

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
                return Response([])
            session_id = session.id
            
        logs = ScrapeLog.objects.filter(session_id=session_id).order_by('timestamp')
        return Response(ScrapeLogSerializer(logs, many=True).data)

class RecentJobsView(generics.ListAPIView):
    queryset = Job.objects.order_by('-created_at')[:10]
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
