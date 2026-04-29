from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from .views import (
    LocationViewSet, JobViewSet, StatsView, TriggerScrapeView, 
    StopScrapeView, ForceResetView, LogsView, SignupView, UserView, RecentJobsView,
    CheckExistenceView, SubscriptionView, AdminLoginView, AdminUserViewSet
)

router = DefaultRouter()
router.register(r'jobs', JobViewSet)
router.register(r'users', AdminUserViewSet)
router.register(r'locations', LocationViewSet)

urlpatterns = [
    # ==========================================
    # USER ENDPOINTS (Frontend & Mobile)
    # ==========================================
    path('login/', obtain_auth_token, name='login'),
    path('signup/', SignupView.as_view(), name='signup'),
    path('user/', UserView.as_view(), name='user'),
    path('check-existence/', CheckExistenceView.as_view(), name='check-existence'),
    
    # Public Data & Exploration
    path('', include(router.urls)),
    path('stats/', StatsView.as_view(), name='stats'),
    path('recent-jobs/', RecentJobsView.as_view(), name='recent-jobs'),
    
    # Subscription Logic
    path('subscribe/', SubscriptionView.as_view(), name='subscribe'),

    # ==========================================
    # ADMIN ENDPOINTS (Scraper & System Management)
    # ==========================================
    path('admin-login/', AdminLoginView.as_view(), name='admin-login'),
    path('trigger-scrape/', TriggerScrapeView.as_view(), name='trigger-scrape'),
    path('stop-scrape/', StopScrapeView.as_view(), name='stop-scrape'),
    path('force-reset/', ForceResetView.as_view(), name='force-reset'),
    path('logs/', LogsView.as_view(), name='logs'),
]
