from rest_framework import serializers
from .models import Event, EventRegistration


def _split_list(text):
    return [item.strip() for item in text.split(',') if item.strip()]


class EventSerializer(serializers.ModelSerializer):
    """Shared list/detail serializer for browsing events (public and admin)."""
    spots_left = serializers.SerializerMethodField()
    is_registered = serializers.SerializerMethodField()
    created_by_ambassador_name = serializers.SerializerMethodField()
    goodies_list = serializers.SerializerMethodField()
    collaborators_list = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            'id', 'title', 'description', 'banner_image', 'location', 'location_map_url', 'latitude', 'longitude',
            'event_date', 'registration_deadline', 'capacity', 'price_paise',
            'prize_pool_paise', 'goodies', 'goodies_list', 'collaborators', 'collaborators_list',
            'status', 'reviewer_notes', 'delete_requested', 'created_by_ambassador', 'created_by_ambassador_name',
            'created_at', 'spots_left', 'is_registered',
        ]
        read_only_fields = [
            'id', 'latitude', 'longitude', 'status', 'reviewer_notes', 'delete_requested',
            'created_by_ambassador', 'created_at',
        ]

    def get_spots_left(self, obj):
        if obj.capacity is None:
            return None
        confirmed = obj.registrations.filter(status='confirmed').count()
        return max(obj.capacity - confirmed, 0)

    def get_is_registered(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.registrations.filter(user=request.user, status='confirmed').exists()

    def get_created_by_ambassador_name(self, obj):
        application = getattr(obj.created_by_ambassador, 'application', None)
        return application.full_name if application else obj.created_by_ambassador.user.username

    def get_goodies_list(self, obj):
        return _split_list(obj.goodies)

    def get_collaborators_list(self, obj):
        return _split_list(obj.collaborators)


class EventRequestCreateSerializer(serializers.ModelSerializer):
    """Ambassador-facing: submit a request to run an event, or edit
    ("request changes" to) one they already submitted. status/creator are
    set by the view, not the client — editing an approved/rejected event
    resets status to pending for re-review, handled in the view."""
    class Meta:
        model = Event
        fields = [
            'id', 'title', 'description', 'banner_image', 'location', 'location_map_url',
            'event_date', 'registration_deadline', 'capacity', 'price_paise',
            'prize_pool_paise', 'goodies', 'collaborators',
            'status', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'created_at']


class AdminEventUpdateSerializer(serializers.ModelSerializer):
    """Admin-only: approve/reject an event, leave a review note, edit its
    details outright (title, schedule, price, capacity, banner, hackathon
    extras, etc), or dismiss a delete request by clearing delete_requested.
    PATCH is partial, so the quick approve/reject action can send just
    {status}."""
    class Meta:
        model = Event
        fields = [
            'id', 'title', 'description', 'banner_image', 'location', 'location_map_url',
            'event_date', 'registration_deadline', 'capacity', 'price_paise',
            'prize_pool_paise', 'goodies', 'collaborators',
            'status', 'reviewer_notes', 'delete_requested',
        ]
        read_only_fields = ['id']


class EventRegistrationSerializer(serializers.ModelSerializer):
    """An event's attendee, for the owning ambassador's attendees view."""
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = EventRegistration
        fields = ['id', 'name', 'email', 'status', 'amount_paise', 'created_at']

    def get_name(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.username


class MyEventRegistrationSerializer(serializers.ModelSerializer):
    """A user's own registration, for their event-registrations list."""
    event_title = serializers.CharField(source='event.title', read_only=True)

    class Meta:
        model = EventRegistration
        fields = ['id', 'event', 'event_title', 'status', 'amount_paise', 'created_at']
