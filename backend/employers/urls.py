from django.urls import path
from .views import (
    MyEmployerView, EmployerChangeOwnPasswordView, KYCDocumentUploadView,
    EmployerTeamListView, EmployerTeamInviteView, EmployerTeamMemberDetailView,
    AdminEmployerKYCListView, AdminEmployerKYCDetailView, AdminKYCDocumentDetailView, AdminEmployerMemberDetailView, AdminEmployerMemberCreateView,
)

urlpatterns = [
    path('me/', MyEmployerView.as_view(), name='employer-me'),
    path('me/change-password/', EmployerChangeOwnPasswordView.as_view(), name='employer-change-password'),
    path('kyc/', KYCDocumentUploadView.as_view(), name='employer-kyc-upload'),
    path('team/', EmployerTeamListView.as_view(), name='employer-team-list'),
    path('team/invite/', EmployerTeamInviteView.as_view(), name='employer-team-invite'),
    path('team/<int:pk>/', EmployerTeamMemberDetailView.as_view(), name='employer-team-member-detail'),

    path('admin/kyc/', AdminEmployerKYCListView.as_view(), name='admin-employer-kyc-list'),
    path('admin/kyc/<int:pk>/', AdminEmployerKYCDetailView.as_view(), name='admin-employer-kyc-detail'),
    path('admin/kyc-documents/<int:pk>/', AdminKYCDocumentDetailView.as_view(), name='admin-kyc-document-detail'),
    path('admin/kyc/<int:pk>/members/', AdminEmployerMemberCreateView.as_view(), name='admin-employer-member-create'),
    path('admin/members/<int:pk>/', AdminEmployerMemberDetailView.as_view(), name='admin-employer-member-detail'),
]
