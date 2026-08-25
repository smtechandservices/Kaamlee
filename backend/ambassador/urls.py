from django.urls import path
from .views import (
    AmbassadorApplicationCreateView,
    AmbassadorEmailCheckView,
    AdminAmbassadorApplicationListView,
    AdminAmbassadorApplicationStatusView,
    AdminAmbassadorRegeneratePasswordView,
    AmbassadorLoginView,
    AmbassadorMeView,
    AmbassadorChangePasswordView,
    AmbassadorReferralsView,
    AmbassadorDashboardView,
)

urlpatterns = [
    path('applications/', AmbassadorApplicationCreateView.as_view(), name='ambassador-application-create'),
    path('check-email/', AmbassadorEmailCheckView.as_view(), name='ambassador-check-email'),
    path('admin/applications/', AdminAmbassadorApplicationListView.as_view(), name='ambassador-admin-list'),
    path('admin/applications/<int:pk>/', AdminAmbassadorApplicationStatusView.as_view(), name='ambassador-admin-status'),
    path('admin/applications/<int:pk>/regenerate-password/', AdminAmbassadorRegeneratePasswordView.as_view(), name='ambassador-admin-regenerate-password'),

    path('login/', AmbassadorLoginView.as_view(), name='ambassador-login'),
    path('me/', AmbassadorMeView.as_view(), name='ambassador-me'),
    path('change-password/', AmbassadorChangePasswordView.as_view(), name='ambassador-change-password'),
    path('referrals/', AmbassadorReferralsView.as_view(), name='ambassador-referrals'),
    path('dashboard/', AmbassadorDashboardView.as_view(), name='ambassador-dashboard'),
]
