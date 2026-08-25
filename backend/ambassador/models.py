from django.conf import settings
from django.db import models

DEGREE_LEVEL_CHOICES = [
    ('undergrad', 'Undergraduate'),
    ('postgrad', 'Postgraduate'),
]

APPLICATION_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
]

class AmbassadorApplication(models.Model):
    # Student details
    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=20)

    # College details
    college_name = models.CharField(max_length=255)
    college_city = models.CharField(max_length=100, blank=True)
    college_state = models.CharField(max_length=100, blank=True)

    # Course details
    course = models.CharField(max_length=255)
    degree_level = models.CharField(max_length=10, choices=DEGREE_LEVEL_CHOICES, default='undergrad')
    graduation_year = models.PositiveIntegerField()

    # Verification
    id_card_image = models.ImageField(upload_to='ambassador_id_cards/')

    # Review
    status = models.CharField(max_length=10, choices=APPLICATION_STATUS_CHOICES, default='pending', db_index=True)
    reviewer_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} ({self.college_name}) - {self.status}"


class AmbassadorProfile(models.Model):
    """Created once an application is approved and the portal account is
    provisioned. referral_code is 5 letters from the username + 5 random
    digits (e.g. PSDAD21312) — see ambassador.utils.generate_referral_code."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ambassador_profile')
    application = models.OneToOneField(AmbassadorApplication, on_delete=models.CASCADE, related_name='ambassador_profile')
    referral_code = models.CharField(max_length=32, unique=True, db_index=True)
    must_change_password = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.referral_code})"
