import logging

import razorpay
from django.conf import settings
from django.db import transaction as db_transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, views
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from ambassador.permissions import IsAmbassador
from .maps_link import resolve_map_link
from .models import Event, EventRegistration
from .serializers import (
    EventSerializer,
    EventRequestCreateSerializer,
    AdminEventUpdateSerializer,
    EventRegistrationSerializer,
    MyEventRegistrationSerializer,
)

logger = logging.getLogger(__name__)


class EventRequestCreateView(generics.CreateAPIView):
    """POST /events/requests/ — an ambassador submits a request to run an event."""
    queryset = Event.objects.all()
    serializer_class = EventRequestCreateSerializer
    permission_classes = [IsAmbassador]
    parser_classes = [MultiPartParser, FormParser]

    def perform_create(self, serializer):
        extra = {'created_by_ambassador': self.request.user.ambassador_profile}
        coords = resolve_map_link(serializer.validated_data.get('location_map_url'))
        if coords:
            extra['latitude'], extra['longitude'] = coords
        serializer.save(**extra)


class AmbassadorEventListView(generics.ListAPIView):
    """GET /events/mine/ — events this ambassador has submitted, any status."""
    serializer_class = EventSerializer
    permission_classes = [IsAmbassador]

    def get_queryset(self):
        return Event.objects.filter(
            created_by_ambassador=self.request.user.ambassador_profile
        ).order_by('-created_at')

    def get_serializer_context(self):
        return {'request': self.request}


class AmbassadorEventUpdateView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /events/mine/<pk>/ — an ambassador requests changes to their
    own event. Editing a still-pending event just updates it in place;
    editing an approved or rejected one resets status back to pending and
    clears any reviewer note, so it goes through admin review again rather
    than silently changing a listing users have already registered for."""
    serializer_class = EventRequestCreateSerializer
    permission_classes = [IsAmbassador]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return Event.objects.filter(created_by_ambassador=self.request.user.ambassador_profile)

    def perform_update(self, serializer):
        instance = serializer.instance
        extra = {}
        if instance.status in ('approved', 'rejected'):
            extra['status'] = 'pending'
            extra['reviewer_notes'] = ''

        new_url = serializer.validated_data.get('location_map_url')
        if new_url and new_url != instance.location_map_url:
            coords = resolve_map_link(new_url)
            if coords:
                extra['latitude'], extra['longitude'] = coords

        serializer.save(**extra)


class EventRequestDeleteView(views.APIView):
    """POST /events/<pk>/request-delete/ — an ambassador asks admin to
    remove their own event. Doesn't delete anything itself (deleting cascades
    to EventRegistration rows, which could destroy paid attendees' records)
    — just flags it for admin, who can dismiss the request or delete it
    outright via the admin endpoint."""
    permission_classes = [IsAmbassador]

    def post(self, request, pk):
        event = get_object_or_404(
            Event, pk=pk, created_by_ambassador=request.user.ambassador_profile
        )
        if not event.delete_requested:
            event.delete_requested = True
            event.save(update_fields=['delete_requested'])
        return Response({'delete_requested': True})


class EventAttendeesView(generics.ListAPIView):
    """GET /events/<pk>/attendees/ — confirmed registrants for one of this
    ambassador's own events. 404s (not 403) for events they don't own, so as
    not to reveal that another ambassador's event exists."""
    serializer_class = EventRegistrationSerializer
    permission_classes = [IsAmbassador]

    def get_queryset(self):
        event = get_object_or_404(
            Event, pk=self.kwargs['pk'], created_by_ambassador=self.request.user.ambassador_profile
        )
        return event.registrations.filter(status='confirmed').select_related('user').order_by('-created_at')


class AdminEventListView(generics.ListAPIView):
    """GET /events/admin/ — full event list for the admin approval queue.
    Supports ?status= and ?search=."""
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = Event.objects.select_related('created_by_ambassador__user').order_by('-created_at')

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(location__icontains=search) |
                Q(created_by_ambassador__user__username__icontains=search)
            )

        return queryset

    def get_serializer_context(self):
        return {'request': self.request}


class AdminEventStatusView(generics.RetrieveUpdateDestroyAPIView):
    """PATCH /events/admin/<pk>/ — approve/reject an event request, edit its
    details outright, or dismiss a delete request. DELETE /events/admin/<pk>/
    — actually removes it (blocked if anyone has a confirmed, paid
    registration — those need to be handled, e.g. refunded, before the event
    itself can be deleted)."""
    queryset = Event.objects.all()
    serializer_class = AdminEventUpdateSerializer
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['patch', 'delete']

    def perform_update(self, serializer):
        new_url = serializer.validated_data.get('location_map_url')
        if new_url and new_url != serializer.instance.location_map_url:
            coords = resolve_map_link(new_url)
            if coords:
                serializer.save(latitude=coords[0], longitude=coords[1])
                return
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        event = self.get_object()
        if event.registrations.filter(status='confirmed').exists():
            return Response(
                {"error": "This event has confirmed registrations — handle those (e.g. refund) before deleting it."},
                status=400,
            )
        event.delete()
        return Response(status=204)


class EventResolveMapLinkView(views.APIView):
    """GET /events/resolve-map-link/?url=... — best-effort resolve of a
    pasted Google Maps link for the ambassador submit form / admin edit
    modal's live map preview. Always 200s with null coordinates rather than
    erroring, since a link that won't resolve shouldn't block filling out
    the rest of the form."""
    permission_classes = [IsAmbassador | permissions.IsAdminUser]

    def get(self, request):
        url = (request.query_params.get('url') or '').strip()
        if not url:
            return Response({'error': 'url is required'}, status=400)
        coords = resolve_map_link(url)
        if not coords:
            return Response({'latitude': None, 'longitude': None})
        return Response({'latitude': coords[0], 'longitude': coords[1]})


class EventListView(generics.ListAPIView):
    """GET /events/ — approved events any logged-in user can browse."""
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Event.objects.filter(status='approved').order_by('event_date')

    def get_serializer_context(self):
        return {'request': self.request}


class EventDetailView(generics.RetrieveAPIView):
    """GET /events/<pk>/ — a single approved event."""
    queryset = Event.objects.filter(status='approved')
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        return {'request': self.request}


class EventCreateOrderView(views.APIView):
    """POST /events/<pk>/create-order/ — start registration for an approved
    event. Price is always looked up server-side from the event, never
    trusted from the client. Free events (price_paise=0) skip Razorpay
    entirely and are confirmed immediately."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        event = get_object_or_404(Event, pk=pk, status='approved')

        now = timezone.now()
        deadline = event.registration_deadline or event.event_date
        if deadline and now > deadline:
            return Response({"error": "Registration is closed for this event."}, status=400)

        if event.capacity is not None:
            confirmed_count = event.registrations.filter(status='confirmed').exclude(user=request.user).count()
            if confirmed_count >= event.capacity:
                return Response({"error": "This event is full."}, status=400)

        if event.price_paise == 0:
            registration, _ = EventRegistration.objects.update_or_create(
                event=event, user=request.user,
                defaults={'status': 'confirmed', 'amount_paise': 0},
            )
            return Response({'free': True, 'registration_id': registration.id, 'status': registration.status})

        existing = EventRegistration.objects.filter(event=event, user=request.user).first()
        if existing and existing.status == 'confirmed':
            return Response({"error": "You're already registered for this event."}, status=400)

        key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)
        if not key_id or not key_secret:
            logger.error("Razorpay keys are missing in settings")
            return Response({"error": "Razorpay keys are not configured"}, status=500)

        client = razorpay.Client(auth=(key_id, key_secret))

        try:
            order_data = {
                'amount': int(event.price_paise),
                'currency': 'INR',
                'receipt': f'event_{event.id}_{request.user.id}_{int(now.timestamp())}',
                'notes': {
                    'portal': 'kaamlee-events',
                    'event_id': event.id,
                    'user': request.user.username,
                },
                'payment_capture': 1,
            }
            order = client.order.create(data=order_data)

            EventRegistration.objects.update_or_create(
                event=event, user=request.user,
                defaults={
                    'razorpay_order_id': order['id'],
                    'amount_paise': event.price_paise,
                    'status': 'pending',
                },
            )

            return Response({
                'order_id': order['id'],
                'amount': order['amount'],
                'currency': order['currency'],
            })
        except Exception:
            logger.exception("Failed to create Razorpay order for event %s / user %s", event.id, request.user.id)
            return Response({"error": "Could not create order. Please try again."}, status=500)


class EventVerifyPaymentView(views.APIView):
    """POST /events/<pk>/verify-payment/ — verify a Razorpay payment and
    confirm the registration."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_signature = request.data.get('razorpay_signature')

        key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)
        client = razorpay.Client(auth=(key_id, key_secret))

        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature,
        }

        # verify_payment_signature is a local HMAC check (no network call), so
        # it's safe to do inside the locked section below alongside the row lock.
        with db_transaction.atomic():
            registration = EventRegistration.objects.select_for_update().filter(
                event_id=pk, user=request.user
            ).first()
            if not registration:
                return Response({"error": "Registration not found"}, status=404)

            # Idempotent: a replayed/duplicate call for an already-confirmed
            # registration must not error out.
            if registration.status == 'confirmed':
                return Response({"status": "success", "registration_id": registration.id})

            try:
                client.utility.verify_payment_signature(params_dict)
            except razorpay.errors.SignatureVerificationError:
                registration.status = 'failed'
                registration.save()
                return Response({"error": "Invalid signature or payment failed"}, status=400)

            registration.razorpay_payment_id = razorpay_payment_id
            registration.razorpay_signature = razorpay_signature
            registration.status = 'confirmed'
            registration.save()

            return Response({"status": "success", "registration_id": registration.id})


class EventCheckPaymentStatusView(views.APIView):
    """POST /events/<pk>/check-status/ — reconciliation fallback: polls
    Razorpay directly for this user's registration on this event, in case
    the client-side verify call never landed (e.g. the tab closed mid-flow)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        registration = EventRegistration.objects.filter(event_id=pk, user=request.user).first()
        if not registration:
            return Response({"error": "Registration not found"}, status=404)

        if registration.status == 'confirmed':
            return Response({"status": "success", "registration_id": registration.id})

        if not registration.razorpay_order_id:
            return Response({"status": registration.status})

        key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)
        client = razorpay.Client(auth=(key_id, key_secret))

        try:
            payments = client.order.payments(registration.razorpay_order_id)
            successful_payment = next((p for p in payments['items'] if p['status'] == 'captured'), None)

            if successful_payment:
                with db_transaction.atomic():
                    registration = EventRegistration.objects.select_for_update().filter(
                        event_id=pk, user=request.user
                    ).first()
                    if registration and registration.status != 'confirmed':
                        registration.status = 'confirmed'
                        registration.razorpay_payment_id = successful_payment['id']
                        registration.save()

                return Response({"status": "success", "registration_id": registration.id})

            status = "pending"
            if any(p['status'] == 'failed' for p in payments['items']):
                status = "failed"
            return Response({"status": status})
        except Exception:
            logger.exception("Failed to check payment status for event %s / user %s", pk, request.user.id)
            return Response({"error": "Could not check payment status. Please try again."}, status=500)


class MyEventRegistrationsView(generics.ListAPIView):
    """GET /events/registrations/mine/ — this user's event registrations."""
    serializer_class = MyEventRegistrationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return EventRegistration.objects.filter(
            user=self.request.user
        ).select_related('event').order_by('-created_at')
