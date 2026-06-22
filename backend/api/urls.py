from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from .views import (
    LocationViewSet, JobViewSet, StatsView, TriggerScrapeView,
    StopScrapeView, ForceResetView, LogsView, SignupView, UserView, RecentJobsView,
    CheckExistenceView, AdminLoginView, AdminUserViewSet, RolesView,
    FeedbackView, AdminFeedbackView
)

router = DefaultRouter()
router.register(r'jobs', JobViewSet, basename='jobs')
router.register(r'users', AdminUserViewSet, basename='users')
router.register(r'locations', LocationViewSet, basename='locations')

urlpatterns = [
    # ==========================================
    # AUTHENTICATION & PROFILE
    # ==========================================
    path('user/', UserView.as_view(), name='user'),
    path('login/', obtain_auth_token, name='login'),
    path('signup/', SignupView.as_view(), name='signup'),
    path('admin-login/', AdminLoginView.as_view(), name='admin-login'),
    
    # ==========================================
    # CORE API
    # ==========================================
    path('', include(router.urls)),
    path('recent-jobs/', RecentJobsView.as_view(), name='recent-jobs'),
    path('check-existence/', CheckExistenceView.as_view(), name='check-existence'),
    path('roles/', RolesView.as_view(), name='roles'),
    
    # ==========================================
    # FEEDBACK
    # ==========================================
    path('feedback/', FeedbackView.as_view(), name='feedback'),
    path('admin/feedback/', AdminFeedbackView.as_view(), name='admin-feedback'),

    # ==========================================
    # SCRAPER & ADMIN
    # ==========================================
    path('stats/', StatsView.as_view(), name='stats'),
    path('logs/', LogsView.as_view(), name='logs'),
    path('trigger-scrape/', TriggerScrapeView.as_view(), name='trigger-scrape'),
    path('stop-scrape/', StopScrapeView.as_view(), name='stop-scrape'),
    path('force-reset/', ForceResetView.as_view(), name='force-reset'),
]
