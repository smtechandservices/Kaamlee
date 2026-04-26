from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings

# Authentication Models
class User(AbstractUser):
    email = models.EmailField(_('email address'), unique=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(blank=True, null=True)
    is_hr = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.email} Profile"

# Job Board Models
class SearchQuery(models.Model):
    query = models.CharField(max_length=255, unique=True)
    last_scraped_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.query

class Job(models.Model):
    title = models.CharField(max_length=255)
    company = models.CharField(max_length=255)
    company_logo = models.URLField(max_length=500, blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    is_remote = models.BooleanField(default=False)
    job_type = models.CharField(max_length=50, blank=True, null=True)
    site = models.CharField(max_length=50) # 'indeed', 'linkedin', etc.
    url = models.URLField(max_length=2000, unique=True, default='') # fallback or correct length
    description = models.TextField(blank=True, null=True)
    
    is_expired = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)

    def __str__(self):
        return f"{self.title} at {self.company}"

# Resume Models
class Resume(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='resumes')
    file = models.FileField(upload_to='resumes/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Resume of {self.user.email} uploaded at {self.uploaded_at}"

class ATSUsage(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ats_usage')
    free_checks_used = models.PositiveIntegerField(default=0)
    last_check_date = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} - Used: {self.free_checks_used}/2"
