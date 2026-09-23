from django.urls import path
from .views import (
    AmbassadorApplicationCreateView,
    AmbassadorEmailCheckView,
    AdminAmbassadorApplicationListView,
    AdminAmbassadorApplicationStatusView,
)

urlpatterns = [
    path('applications/', AmbassadorApplicationCreateView.as_view(), name='ambassador-application-create'),
    path('applications/check-email/', AmbassadorEmailCheckView.as_view(), name='ambassador-email-check'),
    path('admin/applications/', AdminAmbassadorApplicationListView.as_view(), name='ambassador-admin-list'),
    path('admin/applications/<int:pk>/', AdminAmbassadorApplicationStatusView.as_view(), name='ambassador-admin-status'),
]
