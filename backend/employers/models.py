from django.db import models
from django.contrib.auth.models import User

KYC_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
]

class Employer(models.Model):
    name = models.CharField(max_length=255)
    legal_name = models.CharField(max_length=255, blank=True)
    industry = models.CharField(max_length=100, blank=True)
    size = models.CharField(max_length=50, blank=True)
    website = models.URLField(max_length=500, blank=True)
    logo = models.ImageField(upload_to='employer_logos/', blank=True, null=True)
    # Externally hosted logo, set by an admin when creating the employer.
    # An uploaded `logo` file takes priority when both are present.
    logo_url = models.URLField(max_length=500, blank=True)
    address = models.CharField(max_length=500, blank=True)
    contact_email = models.EmailField(max_length=255)
    contact_phone = models.CharField(max_length=20, blank=True)

    kyc_status = models.CharField(max_length=10, choices=KYC_STATUS_CHOICES, default='pending', db_index=True)
    kyc_reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='kyc_reviews')
    kyc_reviewed_at = models.DateTimeField(null=True, blank=True)
    kyc_rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def logo_src(self):
        return self.logo.url if self.logo else (self.logo_url or None)


EMPLOYER_MEMBER_ROLE_CHOICES = [
    ('owner', 'Owner'),
    ('admin', 'Admin'),
    ('recruiter', 'Recruiter'),
]

class EmployerMember(models.Model):
    employer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name='members')
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employer_membership')
    role = models.CharField(max_length=10, choices=EMPLOYER_MEMBER_ROLE_CHOICES, default='owner')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.role} at {self.employer.name})"


KYC_DOC_TYPE_CHOICES = [
    ('registration_certificate', 'Registration Certificate'),
    ('tax_id', 'Tax ID'),
    ('address_proof', 'Address Proof'),
    ('authorized_signatory_id', 'Authorized Signatory ID'),
]

class KYCDocument(models.Model):
    employer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name='kyc_documents')
    doc_type = models.CharField(max_length=30, choices=KYC_DOC_TYPE_CHOICES)
    file = models.FileField(upload_to='employer_kyc/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.get_doc_type_display()} for {self.employer.name}"
