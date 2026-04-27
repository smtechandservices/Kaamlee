from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LocationViewSet, JobViewSet, StatsView, TriggerScrapeView, StopScrapeView, ForceResetView, LogsView

router = DefaultRouter()
router.register(r'locations', LocationViewSet)
router.register(r'jobs', JobViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('stats/', StatsView.as_view(), name='stats'),
    path('trigger-scrape/', TriggerScrapeView.as_view(), name='trigger-scrape'),
    path('stop-scrape/', StopScrapeView.as_view(), name='stop-scrape'),
    path('force-reset/', ForceResetView.as_view(), name='force-reset'),
    path('logs/', LogsView.as_view(), name='logs'),
]

