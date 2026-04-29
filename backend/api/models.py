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
    country = models.CharField(max_length=100)
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
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} at {self.company}"

class ScrapeSession(models.Model):
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=50, default='running')
    jobs_found = models.IntegerField(default=0)
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

