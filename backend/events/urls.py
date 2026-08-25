from django.urls import path
from .views import (
    EventRequestCreateView,
    AmbassadorEventListView,
    AmbassadorEventUpdateView,
    EventRequestDeleteView,
    EventAttendeesView,
    AdminEventListView,
    AdminEventStatusView,
    EventResolveMapLinkView,
    EventListView,
    EventDetailView,
    EventCreateOrderView,
    EventVerifyPaymentView,
    EventCheckPaymentStatusView,
    MyEventRegistrationsView,
)

# Literal-prefixed routes must be declared before <int:pk>/ so they aren't
# swallowed by the int converter.
urlpatterns = [
    path('requests/', EventRequestCreateView.as_view(), name='event-request-create'),
    path('mine/', AmbassadorEventListView.as_view(), name='event-mine'),
    path('mine/<int:pk>/', AmbassadorEventUpdateView.as_view(), name='event-mine-update'),
    path('registrations/mine/', MyEventRegistrationsView.as_view(), name='event-registrations-mine'),
    path('resolve-map-link/', EventResolveMapLinkView.as_view(), name='event-resolve-map-link'),
    path('admin/', AdminEventListView.as_view(), name='event-admin-list'),
    path('admin/<int:pk>/', AdminEventStatusView.as_view(), name='event-admin-status'),

    path('<int:pk>/attendees/', EventAttendeesView.as_view(), name='event-attendees'),
    path('<int:pk>/request-delete/', EventRequestDeleteView.as_view(), name='event-request-delete'),
    path('<int:pk>/create-order/', EventCreateOrderView.as_view(), name='event-create-order'),
    path('<int:pk>/verify-payment/', EventVerifyPaymentView.as_view(), name='event-verify-payment'),
    path('<int:pk>/check-status/', EventCheckPaymentStatusView.as_view(), name='event-check-status'),
    path('<int:pk>/', EventDetailView.as_view(), name='event-detail'),

    path('', EventListView.as_view(), name='event-list'),
]
