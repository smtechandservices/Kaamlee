from django.db import models
from django.contrib.auth.models import User
from api.models import Job

class ResumeVersion(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='resume_versions')
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='resumes/versions/')
    is_tailored = models.BooleanField(default=False)
    job = models.ForeignKey(Job, on_delete=models.SET_NULL, null=True, blank=True, related_name='tailored_resumes')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.name}"

class Application(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('failed', 'Failed'),
        ('withdrawn', 'Withdrawn'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='applications')
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='applications')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    resume_version = models.ForeignKey(ResumeVersion, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'job')

    def __str__(self):
        return f"{self.user.username} - {self.job.title} at {self.job.company}"

class ApplicationEvent(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=100) # e.g., 'form_fill_started', 'resume_uploaded', 'error'
    message = models.TextField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

class ApplicationAnswer(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_answers')
    question_text = models.TextField()
    answer_text = models.TextField()
    question_key = models.CharField(max_length=255, db_index=True) # e.g., 'experience_years', 'sponsorship'
    is_ai_generated = models.BooleanField(default=False)
    last_used = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'question_key')

    def __str__(self):
        return f"{self.user.username} - {self.question_key}"
