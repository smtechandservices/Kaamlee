from django.urls import path
from .views import (
    EmployerJobPostingListCreateView, EmployerJobPostingDetailView, EmployerJobPostingPublishView,
    EmployerJobApplicationsView, EmployerApplicationStageView, EmployerApplicationCVView,
    AdminJobPostingListView, AdminJobPostingDetailView, AdminJobApplicationsView, AdminApplicationCVView,
    PublicJobPostingListView, SuggestedJobPostingsView, CombinedJobFeedView, PublicJobPostingDetailView, PublicCountriesView, PublicJobMapPinsView,
    ApplyToJobView, MyApplicationsView, SavedJobView, MySavedJobsView, JobApplicationKitView,
)

urlpatterns = [
    # Employer side
    path('jobs/', EmployerJobPostingListCreateView.as_view(), name='hiring-employer-jobs'),
    path('jobs/<int:pk>/', EmployerJobPostingDetailView.as_view(), name='hiring-employer-job-detail'),
    path('jobs/<int:pk>/publish/', EmployerJobPostingPublishView.as_view(), name='hiring-employer-job-publish'),
    path('jobs/<int:pk>/applications/', EmployerJobApplicationsView.as_view(), name='hiring-employer-job-applications'),
    path('applications/<int:pk>/stage/', EmployerApplicationStageView.as_view(), name='hiring-application-stage'),
    path('applications/<int:pk>/cv/', EmployerApplicationCVView.as_view(), name='hiring-employer-application-cv'),

    # Admin side
    path('admin/jobs/', AdminJobPostingListView.as_view(), name='hiring-admin-jobs'),
    path('admin/jobs/<int:pk>/', AdminJobPostingDetailView.as_view(), name='hiring-admin-job-detail'),
    path('admin/jobs/<int:pk>/applications/', AdminJobApplicationsView.as_view(), name='hiring-admin-job-applications'),
    path('admin/applications/<int:pk>/cv/', AdminApplicationCVView.as_view(), name='hiring-admin-application-cv'),

    # Candidate side
    path('jobs/public/', PublicJobPostingListView.as_view(), name='hiring-public-jobs'),
    path('jobs/suggested/', SuggestedJobPostingsView.as_view(), name='hiring-suggested-jobs'),
    path('feed/', CombinedJobFeedView.as_view(), name='hiring-feed'),
    path('jobs/public/map_pins/', PublicJobMapPinsView.as_view(), name='hiring-public-map-pins'),
    path('jobs/public/countries/', PublicCountriesView.as_view(), name='hiring-public-countries'),
    path('jobs/public/<int:pk>/', PublicJobPostingDetailView.as_view(), name='hiring-public-job-detail'),
    path('jobs/<int:pk>/apply/', ApplyToJobView.as_view(), name='hiring-apply'),
    path('jobs/<int:pk>/application-kit/', JobApplicationKitView.as_view(), name='hiring-application-kit'),
    path('applications/mine/', MyApplicationsView.as_view(), name='hiring-my-applications'),
    path('saved/mine/', MySavedJobsView.as_view(), name='hiring-my-saved'),
    path('saved/<int:job_id>/', SavedJobView.as_view(), name='hiring-saved-toggle'),
]
