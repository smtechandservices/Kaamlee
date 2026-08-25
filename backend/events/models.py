from django.conf import settings
from django.db import models

EVENT_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
]

REGISTRATION_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('confirmed', 'Confirmed'),
    ('failed', 'Failed'),
    ('cancelled', 'Cancelled'),
]


class Event(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    banner_image = models.ImageField(upload_to='event_banners/', blank=True, null=True)
    location = models.CharField(max_length=255)
    # A Google Maps share link (maps.app.goo.gl/... or a full
    # google.com/maps/place/... URL) pasted by the ambassador/admin — the
    # source of truth for the map pin and "Get Directions" link. Optional:
    # `location` alone is still shown as plain text if this is blank.
    location_map_url = models.URLField(max_length=500, blank=True)
    # Coordinates resolved from location_map_url (see events.maps_link) —
    # null if resolution failed or no link was given; map UI just hides then.
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    event_date = models.DateTimeField()
    registration_deadline = models.DateTimeField(blank=True, null=True)
    capacity = models.PositiveIntegerField(blank=True, null=True)
    price_paise = models.PositiveIntegerField(default=0)
    prize_pool_paise = models.PositiveIntegerField(blank=True, null=True)
    goodies = models.TextField(blank=True)
    collaborators = models.TextField(blank=True)

    # Review
    status = models.CharField(max_length=10, choices=EVENT_STATUS_CHOICES, default='pending', db_index=True)
    reviewer_notes = models.TextField(blank=True)
    # Ambassador asked admin to remove this event — admin decides whether to
    # actually delete it (blocked if there are paid registrations to unwind
    # first) or dismiss the request. Deliberately not a self-service delete:
    # deleting cascades to EventRegistration rows, which could destroy paid
    # attendees' records.
    delete_requested = models.BooleanField(default=False)

    # Ownership only — no commission/referral relationship. Users pay Kaamlee
    # directly; this FK just scopes the ambassador's own attendees view.
    created_by_ambassador = models.ForeignKey(
        'ambassador.AmbassadorProfile', on_delete=models.CASCADE, related_name='events'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-event_date']

    def __str__(self):
        return f"{self.title} ({self.status})"


class EventRegistration(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='registrations')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='event_registrations')

    razorpay_order_id = models.CharField(max_length=255, blank=True)
    razorpay_payment_id = models.CharField(max_length=255, blank=True, null=True)
    razorpay_signature = models.CharField(max_length=255, blank=True, null=True)
    amount_paise = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=REGISTRATION_STATUS_CHOICES, default='pending', db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        # One registration row per (event, user) — re-registering after a
        # failed/pending attempt updates this row rather than creating a
        # duplicate (see events.views.EventCreateOrderView).
        unique_together = [('event', 'user')]

    def __str__(self):
        return f"{self.user.username} -> {self.event.title} ({self.status})"
