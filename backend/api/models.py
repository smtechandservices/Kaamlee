from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=20, blank=True, null=True)
    linkedin_url = models.URLField(max_length=500, blank=True, null=True)
    resume = models.FileField(upload_to='resumes/', blank=True, null=True)
    resume_text = models.TextField(blank=True, null=True)
    resume_parsed = models.JSONField(blank=True, null=True)
    is_subscribed = models.BooleanField(default=False)
    subscription_expires_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"Profile for {self.user.username}"

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.get_or_create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()

class Location(models.Model):
    country = models.CharField(max_length=100, db_index=True)
    country_code = models.CharField(max_length=5)
    state = models.CharField(max_length=100, blank=True, null=True)
    city = models.CharField(max_length=100)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    last_scraped = models.DateTimeField(null=True, blank=True)


    def __str__(self):
        return f"{self.city}, {self.state or self.country}"

class Job(models.Model):
    id_from_site = models.CharField(max_length=255, unique=True)
    title = models.CharField(max_length=255)
    company = models.CharField(max_length=255)
    location_name = models.CharField(max_length=255) # The string returned by scraper
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='jobs')
    is_remote = models.BooleanField(default=False)
    job_type = models.CharField(max_length=100, null=True, blank=True)
    job_url = models.URLField(max_length=1000)
    description = models.TextField(null=True, blank=True)
    site = models.CharField(max_length=100)
    company_logo = models.URLField(max_length=1000, null=True, blank=True)
    date_posted = models.DateField(null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"{self.title} at {self.company}"

class ScrapeSession(models.Model):
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=50, default='running')
    jobs_found = models.IntegerField(default=0)
    jobs_deleted = models.IntegerField(default=0)
    current_location = models.CharField(max_length=255, null=True, blank=True)
    search_term = models.CharField(max_length=255, default='frontend developer')
    results_limit = models.IntegerField(default=5)
    stop_requested = models.BooleanField(default=False)
    error_message = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"Session {self.id} - {self.status}"

class ScrapeLog(models.Model):
    session = models.ForeignKey(ScrapeSession, null=True, blank=True, on_delete=models.SET_NULL, related_name='logs')
    message = models.TextField()
    level = models.CharField(max_length=20, default='info') # info, warning, error, success
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"[{self.timestamp.strftime('%H:%M:%S')}] {self.message}"

class Bookmark(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookmarks')
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='bookmarked_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'job')

    def __str__(self):
        return f"{self.user.username} bookmarked {self.job.title}"

class Feedback(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='feedback')
    rating = models.IntegerField(default=5)  # 1-5 stars
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Feedback by {self.user.username} - {self.rating}/5"


TEMPLATE_CHOICES = [
    ('classic', 'Classic'),
    ('bento', 'Bento'),
]

THEME_CHOICES = [
    ('minimal', 'Minimal'),
    ('noir', 'Noir'),
    ('noir-violet', 'Noir Violet'),
    ('minimal-violet', 'Minimal Violet'),
    ('noir-blue', 'Noir Blue'),
    ('minimal-blue', 'Minimal Blue'),
]

class Portfolio(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='portfolio')
    is_public = models.BooleanField(default=False)
    template = models.CharField(max_length=20, choices=TEMPLATE_CHOICES, default='classic')
    theme = models.CharField(max_length=20, choices=THEME_CHOICES, default='noir')
    title = models.CharField(max_length=100, blank=True)
    bio = models.TextField(blank=True)
    github_url = models.URLField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Portfolio for {self.user.username} ({self.theme})"

@receiver(post_save, sender=User)
def create_user_portfolio(sender, instance, created, **kwargs):
    if created:
        Portfolio.objects.get_or_create(user=instance)


CV_TEMPLATE_CHOICES = [
    ('modern', 'Modern'),
    ('classic', 'Classic'),
    ('ats', 'ATS Optimized'),
]

class CustomCV(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='custom_cvs')
    label = models.CharField(max_length=100, blank=True)
    target_role = models.CharField(max_length=100, blank=True)
    template = models.CharField(max_length=20, choices=CV_TEMPLATE_CHOICES, default='ats')
    content = models.JSONField()
    ats_score = models.IntegerField(default=0)
    ats_breakdown = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"CustomCV({self.label or self.target_role or self.id}) for {self.user.username}"


class JobApplicationKit(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='application_kits')
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='application_kits')
    cover_letter = models.TextField(blank=True)
    qa = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'job')

    def __str__(self):
        return f"ApplicationKit for {self.user.username} - {self.job.title}"
