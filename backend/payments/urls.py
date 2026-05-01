from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AdminRevenueStatsView,
    CreateOrderView, VerifyPaymentView, TransactionViewSet, CheckPaymentStatusView,
)

router = DefaultRouter()
router.register(r'transactions', TransactionViewSet, basename='transaction')

urlpatterns = [
    # stats
    path('admin/revenue-stats/', AdminRevenueStatsView.as_view(), name='admin-revenue-stats'),

    # payments
    path('create-order/', CreateOrderView.as_view(), name='create-order'),
    path('verify-payment/', VerifyPaymentView.as_view(), name='verify-payment'),
    path('check-status/', CheckPaymentStatusView.as_view(), name='check-status'),
    path('', include(router.urls)),
]
