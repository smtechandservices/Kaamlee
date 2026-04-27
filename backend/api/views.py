from rest_framework import viewsets, views
from rest_framework.response import Response
from .models import Location, Job, ScrapeSession, ScrapeLog
from .serializers import LocationSerializer, JobSerializer, ScrapeSessionSerializer, ScrapeLogSerializer
from django.db.models import Count

class LocationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Location.objects.prefetch_related('jobs').annotate(job_count=Count('jobs'))
    serializer_class = LocationSerializer

class JobViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Job.objects.all()
    serializer_class = JobSerializer
    filterset_fields = ['location', 'site', 'is_remote']

    def get_queryset(self):
        queryset = super().get_queryset()
        location_id = self.request.query_params.get('location_id')
        if location_id:
            queryset = queryset.filter(location_id=location_id)
        return queryset

class StatsView(views.APIView):
    def get(self, request):
        total_jobs = Job.objects.count()
        total_locations = Location.objects.count()
        last_session = ScrapeSession.objects.order_by('-start_time').first()
        
        return Response({
            'total_jobs': total_jobs,
            'total_locations': total_locations,
            'last_scrape_session': ScrapeSessionSerializer(last_session).data if last_session else None,
            'jobs_by_site': Job.objects.values('site').annotate(count=Count('id'))
        })

class TriggerScrapeView(views.APIView):
    def post(self, request):
        if ScrapeSession.objects.filter(status='running').exists():
            return Response({"status": "A scraping session is already running"}, status=400)
            
        from .scraper_utils import run_background_scraping
        import threading
        thread = threading.Thread(target=run_background_scraping)
        thread.start()
        return Response({"status": "Scraping started in background"})

class StopScrapeView(views.APIView):
    def post(self, request):
        session = ScrapeSession.objects.filter(status='running').order_by('-start_time').first()
        if session:
            session.stop_requested = True
            session.save()
            print(f"STOP signal received for Session {session.id}")
            return Response({"status": "Stop requested. Scraper will terminate shortly."})
        return Response({"status": "No active scraping session found."}, status=400)
class ForceResetView(views.APIView):
    def post(self, request):
        count = ScrapeSession.objects.filter(status='running').update(status='stopped', stop_requested=False)
        return Response({"status": f"Force reset successful. {count} sessions stopped."})

class LogsView(views.APIView):
    def get(self, request):
        session_id = request.query_params.get('session_id')
        if not session_id:
            session = ScrapeSession.objects.order_by('-start_time').first()
            if not session:
                return Response([])
            session_id = session.id
            
        logs = ScrapeLog.objects.filter(session_id=session_id).order_by('timestamp')
        return Response(ScrapeLogSerializer(logs, many=True).data)
