from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from .views import (
    JobViewSet, StatsView, CompaniesView, CompanyViewSet,
    SignupView, GoogleAuthView, UserView, RecentJobsView,
    CheckExistenceView, AdminLoginView, AdminUserViewSet, CategoriesView, CountriesView,
    FeedbackView, AdminFeedbackView, PublicPortfolioView, MyPortfolioView, MyPortfolioContentView, PortfolioAnalyticsView,
    RequestLogsView, CustomCVListCreateView, CustomCVDetailView, CustomCVTailorView, CustomCVExportView,
    JobApplicationKitView, AtsKeywordsView, ApplicationsView, AdminJobsView, ChangePasswordView,
    RequestEmailOtpView, VerifyEmailOtpView, ConfirmEmailOtpView, RunScraperScriptView, RunGeocodeView,
    RunningScriptsView, StopScriptView,
    JobsMissingCoordinatesView,
)

router = DefaultRouter()
router.register(r'jobs', JobViewSet, basename='jobs')
router.register(r'users', AdminUserViewSet, basename='users')
router.register(r'admin/companies', CompanyViewSet, basename='admin-companies')

urlpatterns = [
    # ==========================================
    # AUTHENTICATION & PROFILE
    # ==========================================
    path('user/', UserView.as_view(), name='user'),
    path('user/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('login/', obtain_auth_token, name='login'),
    path('signup/', SignupView.as_view(), name='signup'),
    path('auth/google/', GoogleAuthView.as_view(), name='auth-google'),
    path('otp/request/', RequestEmailOtpView.as_view(), name='otp-request'),
    path('otp/verify/', VerifyEmailOtpView.as_view(), name='otp-verify'),
    path('otp/confirm/', ConfirmEmailOtpView.as_view(), name='otp-confirm'),
    path('admin-login/', AdminLoginView.as_view(), name='admin-login'),
    
    # ==========================================
    # CORE API
    # ==========================================
    path('', include(router.urls)),
    path('recent-jobs/', RecentJobsView.as_view(), name='recent-jobs'),
    path('check-existence/', CheckExistenceView.as_view(), name='check-existence'),
    path('categories/', CategoriesView.as_view(), name='categories'),
    path('countries/', CountriesView.as_view(), name='countries'),
    
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
    path('portfolio/analytics/', PortfolioAnalyticsView.as_view(), name='portfolio-analytics'),
    path('portfolio/<str:username>/', PublicPortfolioView.as_view(), name='portfolio-public'),

    # ==========================================
    # CUSTOM CV
    # ==========================================
    path('custom-cv/', CustomCVListCreateView.as_view(), name='custom-cv-list'),
    path('custom-cv/keywords/', AtsKeywordsView.as_view(), name='custom-cv-keywords'),
    path('custom-cv/<int:pk>/', CustomCVDetailView.as_view(), name='custom-cv-detail'),
    path('custom-cv/<int:pk>/tailor/', CustomCVTailorView.as_view(), name='custom-cv-tailor'),
    path('custom-cv/<int:pk>/export/', CustomCVExportView.as_view(), name='custom-cv-export'),

    # ==========================================
    # JOB APPLICATION KIT (cover letter + Q&A)
    # ==========================================
    path('jobs/<int:job_id>/application-kit/', JobApplicationKitView.as_view(), name='job-application-kit'),

    # ==========================================
    # APPLICATION TRACKER (Kanban board)
    # ==========================================
    path('applications/', ApplicationsView.as_view(), name='applications'),

    # ==========================================
    # ADMIN
    # ==========================================
    path('stats/', StatsView.as_view(), name='stats'),
    path('companies/', CompaniesView.as_view(), name='companies'),
    path('admin/jobs/', AdminJobsView.as_view(), name='admin-jobs'),
    path('admin/run-script/', RunScraperScriptView.as_view(), name='admin-run-script'),
    path('admin/run-script/running/', RunningScriptsView.as_view(), name='admin-run-script-running'),
    path('admin/run-script/stop/', StopScriptView.as_view(), name='admin-run-script-stop'),
    path('admin/run-geocode/', RunGeocodeView.as_view(), name='admin-run-geocode'),
    path('admin/jobs/missing-coordinates/', JobsMissingCoordinatesView.as_view(), name='admin-jobs-missing-coordinates'),
    path('admin/request-logs/', RequestLogsView.as_view(), name='admin-request-logs'),
]
