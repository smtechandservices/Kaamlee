from django.db import models

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

