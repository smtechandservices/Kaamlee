from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    RegisterView, ContactHRView, UserProfileView,
    JobSearchView, 
    ResumeUploadView, ATSCheckView
)

urlpatterns = [
    # Auth
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/login/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/contact-hr/', ContactHRView.as_view(), name='contact_hr'),
    path('auth/me/', UserProfileView.as_view(), name='user_profile'),
    
    # Jobs
    path('jobs/search/', JobSearchView.as_view(), name='job_search'),
    
    # Resumes
    path('resumes/upload/', ResumeUploadView.as_view(), name='resume_upload'),
    path('resumes/ats-check/', ATSCheckView.as_view(), name='ats_check'),
]
