from django.db import models
from django.contrib.auth.models import User
from employers.models import Employer, EmployerMember
from api.models import CustomCV

EMPLOYMENT_TYPE_CHOICES = [
    ('full_time', 'Full-time'),
    ('part_time', 'Part-time'),
    ('contract', 'Contract'),
    ('internship', 'Internship'),
]

EXPERIENCE_LEVEL_CHOICES = [
    ('entry', 'Entry level'),
    ('mid', 'Mid level'),
    ('senior', 'Senior'),
    ('lead', 'Lead / Principal'),
]

JOB_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('published', 'Published'),
    ('paused', 'Paused'),
    ('closed', 'Closed'),
]

class JobPosting(models.Model):
    employer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name='job_postings')
    created_by = models.ForeignKey(EmployerMember, on_delete=models.SET_NULL, null=True, related_name='created_postings')

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_TYPE_CHOICES, default='full_time')
    salary_min = models.PositiveIntegerField(null=True, blank=True)
    salary_max = models.PositiveIntegerField(null=True, blank=True)
    salary_currency = models.CharField(max_length=10, default='INR')
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    is_remote = models.BooleanField(default=False)
    experience_level = models.CharField(max_length=10, choices=EXPERIENCE_LEVEL_CHOICES, default='mid')
    category = models.CharField(max_length=50, default='Other', db_index=True)
    status = models.CharField(max_length=10, choices=JOB_STATUS_CHOICES, default='draft', db_index=True)

    # Employer-defined extra application fields: [{key, label, type, required}]
    application_form_schema = models.JSONField(default=list, blank=True)
    # Screening questions, text-only for now: [{id, question}]
    screening_questions = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)
    closes_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} @ {self.employer.name}"


APPLICATION_STAGE_CHOICES = [
    ('applied', 'Applied'),
    ('screening', 'Screening'),
    ('shortlisted', 'Shortlisted'),
    ('interview', 'Interview'),
    ('offer', 'Offer'),
    ('hired', 'Hired'),
    ('rejected', 'Rejected'),
]

class Application(models.Model):
    job_posting = models.ForeignKey(JobPosting, on_delete=models.CASCADE, related_name='applications')
    candidate = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hiring_applications')
    cv = models.ForeignKey(CustomCV, on_delete=models.SET_NULL, null=True, blank=True)

    portfolio_public_snapshot = models.BooleanField(default=False)
    form_responses = models.JSONField(default=dict, blank=True)
    # [{question_id, answer_text}] — text only; a video URL joins this shape later.
    screening_answers = models.JSONField(default=list, blank=True)

    stage = models.CharField(max_length=15, choices=APPLICATION_STAGE_CHOICES, default='applied', db_index=True)
    stage_updated_at = models.DateTimeField(auto_now=True)
    applied_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('job_posting', 'candidate')
        ordering = ['-applied_at']

    def __str__(self):
        return f"{self.candidate.username} -> {self.job_posting.title} ({self.stage})"


class ApplicationStageChange(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='stage_changes')
    from_stage = models.CharField(max_length=15, choices=APPLICATION_STAGE_CHOICES, blank=True)
    to_stage = models.CharField(max_length=15, choices=APPLICATION_STAGE_CHOICES)
    changed_by = models.ForeignKey(EmployerMember, on_delete=models.SET_NULL, null=True)
    # Required by the view when to_stage == 'rejected' — this is what the
    # candidate reads as "why was I rejected."
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.application_id}: {self.from_stage or '—'} -> {self.to_stage}"


class SavedJob(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_jobs')
    job_posting = models.ForeignKey(JobPosting, on_delete=models.CASCADE, related_name='saved_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'job_posting')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} saved {self.job_posting.title}"


class JobApplicationKit(models.Model):
    """AI-generated cover letter + common-question answers for one posting,
    tailored to the candidate's resume. Rebuilt against JobPosting after the
    scraped Job model (and this same feature) was removed with the scraper."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hiring_application_kits')
    job_posting = models.ForeignKey(JobPosting, on_delete=models.CASCADE, related_name='application_kits')
    cover_letter = models.TextField(blank=True)
    qa = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'job_posting')

    def __str__(self):
        return f"ApplicationKit for {self.user.username} - {self.job_posting.title}"
