from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from .views import (
    LocationViewSet, JobViewSet, StatsView, TriggerScrapeView,
    StopScrapeView, ForceResetView, LogsView, SignupView, UserView, RecentJobsView,
    CheckExistenceView, AdminLoginView, AdminUserViewSet, RolesView,
    FeedbackView, AdminFeedbackView, PublicPortfolioView, MyPortfolioView, MyPortfolioContentView,
    RequestLogsView, CustomCVListCreateView, CustomCVDetailView, CustomCVTailorView, CustomCVExportView,
    JobApplicationKitView,
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
    # PORTFOLIO
    # ==========================================
    path('portfolio/me/', MyPortfolioView.as_view(), name='portfolio-me'),
    path('portfolio/content/', MyPortfolioContentView.as_view(), name='portfolio-content'),
    path('portfolio/<str:username>/', PublicPortfolioView.as_view(), name='portfolio-public'),

    # ==========================================
    # CUSTOM CV
    # ==========================================
    path('custom-cv/', CustomCVListCreateView.as_view(), name='custom-cv-list'),
    path('custom-cv/<int:pk>/', CustomCVDetailView.as_view(), name='custom-cv-detail'),
    path('custom-cv/<int:pk>/tailor/', CustomCVTailorView.as_view(), name='custom-cv-tailor'),
    path('custom-cv/<int:pk>/export/', CustomCVExportView.as_view(), name='custom-cv-export'),

    # ==========================================
    # JOB APPLICATION KIT (cover letter + Q&A)
    # ==========================================
    path('jobs/<int:job_id>/application-kit/', JobApplicationKitView.as_view(), name='job-application-kit'),

    # ==========================================
    # SCRAPER & ADMIN
    # ==========================================
    path('stats/', StatsView.as_view(), name='stats'),
    path('logs/', LogsView.as_view(), name='logs'),
    path('admin/request-logs/', RequestLogsView.as_view(), name='admin-request-logs'),
    path('trigger-scrape/', TriggerScrapeView.as_view(), name='trigger-scrape'),
    path('stop-scrape/', StopScrapeView.as_view(), name='stop-scrape'),
    path('force-reset/', ForceResetView.as_view(), name='force-reset'),
]
