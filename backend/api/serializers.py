import io
import os
import json
import logging
import PyPDF2
from groq import Groq
from rest_framework import serializers
from .models import Job, ScrapeSession, ScrapeLog, Bookmark, Feedback, Portfolio, PortfolioView, CustomCV, JobApplicationKit, Company, EmailOTP
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from datetime import timedelta
from scripts.ats_scoring import score_cv

logger = logging.getLogger(__name__)
_groq = Groq(api_key=os.getenv('GROQ_API_KEY'))

EMAIL_VERIFICATION_WINDOW_MINUTES = 60

def _email_recently_verified(email):
    """True if `email` completed an OTP check (via /otp/confirm/ or /otp/verify/)
    within the last EMAIL_VERIFICATION_WINDOW_MINUTES."""
    return EmailOTP.objects.filter(
        email=email.lower(),
        is_used=True,
        created_at__gte=timezone.now() - timedelta(minutes=EMAIL_VERIFICATION_WINDOW_MINUTES),
    ).exists()

_PARSE_PROMPT = """You are a resume parser. Extract all information from the resume text below and return ONLY a valid JSON object with this exact structure:

{
  "name": "Full Name",
  "role": "Current or most recent job title / self-described role",
  "contacts": [
    {"type": "email", "value": "email@example.com"},
    {"type": "phone", "value": "+91 9876543210"}
  ],
  "links": [
    {"label": "GitHub", "url": "https://github.com/username", "type": "github"},
    {"label": "LinkedIn", "url": "https://linkedin.com/in/username", "type": "linkedin"},
    {"label": "Portfolio", "url": "https://example.com", "type": "web"}
  ],
  "summary": "Full summary / objective / about text",
  "skills": [
    {"category": "Languages", "items": ["Python", "JavaScript"]},
    {"category": "Frameworks", "items": ["Django", "React"]}
  ],
  "experience": [
    {
      "company": "Company Name",
      "location": "City, Country",
      "period": "Jan 2022 – Present",
      "role": "Job Title",
      "bullets": ["Achievement or responsibility"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "B.Tech Computer Science",
      "period": "2018 – 2022",
      "location": "City, Country"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Short description",
      "tech": ["React", "Node.js"],
      "bullets": ["Key feature or achievement"],
      "url": ""
    }
  ],
  "certifications": [
    {"name": "Cert Name", "issuer": "Issuer", "date": "2023"}
  ],
  "achievements": ["Award or achievement"]
}

Rules:
- Return ONLY the JSON, no markdown, no explanation
- If a field has no data, use empty string "" or empty array []
- Keep all bullet points from the resume, do not summarise
- Preserve exact dates and company names
- For skills without categories, use category ""
"""

def extract_text_from_pdf(pdf_file):
    try:
        reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
        return text
    except Exception:
        logger.exception("Failed to extract text from uploaded PDF")
        return ""

def parse_resume_with_groq(resume_text: str) -> dict:
    try:
        response = _groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": _PARSE_PROMPT},
                {"role": "user", "content": resume_text[:12000]},
            ],
            temperature=0.1,
            max_tokens=4096,
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if model wraps with them
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception:
        logger.exception("Groq resume parse error")
        return {}

_TAILOR_PROMPT_TEMPLATE = """You are a resume editor helping a candidate retarget their existing resume for a new target role: "{target_role}".

You will be given the candidate's resume as JSON (the same schema you must return). Rewrite it so it reads naturally for someone applying to "{target_role}" roles, using this reference list of relevant keywords/skills for that role where appropriate:
{keywords}

Rules — follow these strictly:
- Return ONLY the JSON, no markdown, no explanation, same exact schema/keys as the input.
- Do NOT invent new employers, job titles, dates, degrees, or projects that are not in the input.
- Do NOT claim hands-on production experience with a technology that has no evidence anywhere in the input. If a reference keyword has no supporting evidence, you may add it to the "skills" section only, phrased as "Familiar with" / "Exposure to" rather than presented as production experience.
- You MAY rephrase and re-emphasize existing bullets, summary, and skills to highlight transferable work relevant to "{target_role}" — e.g. if the candidate built a UI that called REST APIs, it is fair to emphasize that API integration work for a backend-leaning target role.
- Update the top-level "role" field to reflect the target role framing (e.g. "Frontend Developer" -> "Fullstack Developer") only if that framing is reasonably supported by the rewritten content.
- Preserve all company names, dates, and education exactly as given.
- Keep the same number of experience/project/education entries as the input.
"""

def tailor_resume_with_groq(content: dict, target_role: str, keywords: list) -> dict:
    prompt = _TAILOR_PROMPT_TEMPLATE.format(
        target_role=target_role,
        keywords=", ".join(keywords) if keywords else "(no specific keyword list — use general best judgement for this role)",
    )
    try:
        response = _groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps(content)},
            ],
            temperature=0.3,
            max_tokens=4096,
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception:
        logger.exception("Groq resume tailor error")
        return {}

APPLICATION_KIT_QUESTIONS = [
    "How many years of experience do you have that are relevant to this role?",
    "Why do you want to leave your current job / why are you interested in this opportunity?",
    "What are you looking for in your next role?",
    "Why should we hire you for this position?",
    "What are your key strengths relevant to this job?",
]

_APPLICATION_KIT_PROMPT_TEMPLATE = """You are a career coach helping a candidate apply for a job. You will be given the candidate's resume as JSON, plus a job's title, company, and description.

Using ONLY information grounded in the candidate's resume — do not invent employers, job titles, dates, degrees, projects, or skills not present in the resume — produce:

1. "cover_letter": a concise, personalized cover letter (3-4 short paragraphs, first person, professional but warm tone). Address it to the company by name, reference the job title, and connect the candidate's real experience/skills to what the role likely needs based on the description. No placeholder text like "[Company Name]".
2. "qa": short, natural, first-person answers (2-4 sentences each) to each of these common application questions, grounded in the resume and tailored to this specific job:
{questions}

Job title: {job_title}
Company: {company}
Job description: {job_description}

Return ONLY valid JSON, no markdown, with this exact structure:
{{
  "cover_letter": "...",
  "qa": [
    {{"question": "...", "answer": "..."}}
  ]
}}
"""

def generate_application_kit_with_groq(resume_content: dict, job_title: str, company: str, job_description: str) -> dict:
    prompt = _APPLICATION_KIT_PROMPT_TEMPLATE.format(
        questions="\n".join(f"- {q}" for q in APPLICATION_KIT_QUESTIONS),
        job_title=job_title,
        company=company or "the company",
        job_description=(job_description or "")[:4000],
    )
    try:
        response = _groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps(resume_content)},
            ],
            temperature=0.4,
            max_tokens=2048,
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception:
        logger.exception("Groq application kit error")
        return {}

def calculate_match(resume_text, job_title, job_description):
    if not resume_text:
        return 0
    
    resume_words = set(resume_text.lower().split())
    job_content = (job_title + " " + (job_description or "")).lower()
    job_words = set(job_content.split())
    
    # Common words to ignore (simple stop words)
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'in', 'of', 'for', 'with', 'on', 'at', 'by', 'from', 'as', 'it', 'its', 'they', 'them', 'their', 'our', 'we', 'you', 'your', 'my', 'me', 'i'}
    
    resume_words = resume_words - stop_words
    job_words = job_words - stop_words
    
    if not job_words:
        return 0
        
    overlap = resume_words.intersection(job_words)
    # Basic keyword overlap score
    score = (len(overlap) / len(job_words)) * 100
    
    # Bonus for title match (important keywords in title)
    title_words = set(job_title.lower().split()) - stop_words
    title_overlap = resume_words.intersection(title_words)
    if title_words:
        score += (len(title_overlap) / len(title_words)) * 30 # Higher weight for title
        
    return min(round(score, 1), 100)

class UserSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(source='profile.phone', required=False)
    linkedin_url = serializers.URLField(source='profile.linkedin_url', required=False, allow_blank=True, allow_null=True)
    resume = serializers.FileField(source='profile.resume', required=False, allow_null=True)
    resume_text = serializers.CharField(source='profile.resume_text', read_only=True)
    has_resume = serializers.SerializerMethodField()
    is_subscribed = serializers.BooleanField(source='profile.is_subscribed', required=False)
    subscription_expires_at = serializers.DateTimeField(source='profile.subscription_expires_at', required=False, allow_null=True)
    portfolio_is_public = serializers.SerializerMethodField()
    signed_in_with_google = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name', 'phone', 'linkedin_url',
            'resume', 'resume_text', 'has_resume', 'is_subscribed', 'subscription_expires_at',
            'is_superuser', 'is_staff', 'portfolio_is_public', 'signed_in_with_google',
        )
        read_only_fields = ('id', 'email', 'is_superuser', 'is_staff', 'resume_text', 'has_resume', 'portfolio_is_public', 'signed_in_with_google')

    MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB — the whole file is read into memory for extraction/Groq

    def validate_resume(self, value):
        if value is None:
            return value
        if value.size > self.MAX_RESUME_SIZE_BYTES:
            raise serializers.ValidationError("Resume file is too large (max 5 MB).")
        name = (value.name or "").lower()
        if not name.endswith(('.pdf', '.txt')):
            raise serializers.ValidationError("Only PDF or plain text resumes are supported.")
        if name.endswith('.pdf'):
            header = value.read(5)
            value.seek(0)
            if header != b'%PDF-':
                raise serializers.ValidationError("File does not look like a valid PDF.")
        return value

    def get_has_resume(self, obj):
        # resume_text is the reliable gate — it's always set after PDF extraction
        return bool(obj.profile.resume_text)

    def get_portfolio_is_public(self, obj):
        # Portfolio was added after some users already existed, so it may be missing.
        portfolio = getattr(obj, 'portfolio', None)
        return bool(portfolio.is_public) if portfolio else False

    def get_signed_in_with_google(self, obj):
        return bool(obj.profile.google_id)

    def validate_username(self, value):
        # Case-insensitive, matching CheckExistenceView's pre-check — otherwise
        if User.objects.exclude(pk=self.instance.pk).filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})

        # Update User fields
        instance.username = validated_data.get('username', instance.username)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.save()

        # Update Profile fields
        profile = instance.profile
        if 'phone' in profile_data:
            profile.phone = profile_data['phone']
        if 'linkedin_url' in profile_data:
            profile.linkedin_url = profile_data['linkedin_url']
        
        if 'resume' in profile_data:
            resume_file = profile_data['resume']

            if resume_file:
                if resume_file.name.lower().endswith('.pdf'):
                    new_resume_text = extract_text_from_pdf(resume_file)
                else:
                    new_resume_text = resume_file.read().decode('utf-8', errors='ignore')

                # Don't silently accept an upload we couldn't read anything from —
                # a corrupt/scanned-image PDF would otherwise save a blank resume
                # and quietly break ATS scoring / CV tailoring downstream.
                if not new_resume_text.strip():
                    raise serializers.ValidationError({
                        'resume': 'Could not extract any text from this file. Please upload a text-based PDF.'
                    })

                if profile.resume and profile.resume != resume_file:
                    try:
                        profile.resume.delete(save=False)
                    except Exception:
                        logger.exception("Error deleting old resume")

                profile.resume = resume_file
                profile.resume_text = new_resume_text
                profile.resume_parsed = parse_resume_with_groq(new_resume_text)
            else:
                if profile.resume:
                    try:
                        profile.resume.delete(save=False)
                    except Exception:
                        logger.exception("Error deleting old resume")
                profile.resume = resume_file
                profile.resume_text = ""
                profile.resume_parsed = None

        if 'is_subscribed' in profile_data:
            profile.is_subscribed = profile_data['is_subscribed']
        if 'subscription_expires_at' in profile_data:
            profile.subscription_expires_at = profile_data['subscription_expires_at']
        profile.save()

        return instance

class ChangePasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value, user=self.context['request'].user)
        return value

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        user = self.context['request'].user
        if not _email_recently_verified(user.email):
            raise serializers.ValidationError({'non_field_errors': 'Please verify your email with the code sent before changing your password.'})

        return data

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user

class AdminSetPasswordSerializer(serializers.Serializer):
    """Lets an admin set a user's password directly — no current password
    needed, since IsAdminUser already gates access to this."""
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value, user=self.context.get('user'))
        return value

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return data

class RegisterSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    linkedin_url = serializers.URLField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'confirm_password', 'first_name', 'last_name', 'phone', 'linkedin_url')
        extra_kwargs = {'password': {'write_only': True}}

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        if not _email_recently_verified(data['email']):
            raise serializers.ValidationError({"email": "Please verify your email address before signing up."})

        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        phone = validated_data.pop('phone', '')
        linkedin_url = validated_data.pop('linkedin_url', '')
        
        user = User.objects.create_user(
            validated_data['username'],
            validated_data['email'],
            validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        
        # Profile is created automatically by signal, just update it
        user.profile.phone = phone
        user.profile.linkedin_url = linkedin_url
        user.profile.save()
        
        return user

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            'id', 'name', 'domain', 'career_url', 'contact_url', 'contact_email',
            'address', 'linkedin_url', 'logo_url', 'is_active', 'last_scraped_at', 'created_at',
        ]
        read_only_fields = ['last_scraped_at', 'created_at']

def _resolve_job_location_name(obj):
    name = obj.location_name
    if name and str(name).strip().lower() not in ('', 'nan', 'none'):
        return name.strip()
    # Fall back to the plain city/state/country fields
    parts = [p for p in [obj.city, obj.state, obj.country] if p]
    return ', '.join(parts) if parts else None

class JobSerializer(serializers.ModelSerializer):
    match_score = serializers.SerializerMethodField()
    is_bookmarked = serializers.BooleanField(read_only=True)
    location_name = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()

    DESCRIPTION_PREVIEW_LENGTH = 220

    class Meta:
        model = Job
        # id_from_site excluded (internal dedup key only). description is a large
        # TextField, so `description` here is a truncated preview, not the raw field.
        fields = [
            'id', 'title', 'company', 'location_name', 'country',
            'is_remote', 'job_type', 'job_url', 'site', 'company_logo',
            'date_posted', 'created_at', 'latitude', 'longitude',
            'is_bookmarked', 'match_score', 'category',
            'experience_required', 'salary', 'description',
        ]

    def get_location_name(self, obj):
        return _resolve_job_location_name(obj)

    def get_description(self, obj):
        text = (obj.description or '').strip()
        if len(text) <= self.DESCRIPTION_PREVIEW_LENGTH:
            return text
        return text[:self.DESCRIPTION_PREVIEW_LENGTH].rsplit(' ', 1)[0] + '…'

    def get_match_score(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return 0
        if not hasattr(request.user, 'profile'):
            return 0
        resume_text = request.user.profile.resume_text
        if not resume_text:
            return 0
        return calculate_match(resume_text, obj.title, getattr(obj, 'description', '') or '')

class RecentJobSerializer(JobSerializer):
    class Meta(JobSerializer.Meta):
        fields = [f for f in JobSerializer.Meta.fields if f != 'site']

class AdminJobSerializer(serializers.ModelSerializer):
    """Read-only, per-user-agnostic job listing for the admin dashboard —
    unlike JobSerializer, this carries no match_score/is_bookmarked so it
    doesn't need a resume or bookmark lookup per row."""
    location_name = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            'id', 'title', 'company', 'location_name', 'city', 'state', 'country',
            'is_remote', 'job_type', 'job_url', 'site', 'company_logo',
            'date_posted', 'created_at', 'category', 'experience_required', 'salary',
            'latitude', 'longitude',
        ]

    def get_location_name(self, obj):
        return _resolve_job_location_name(obj)

class BookmarkSerializer(serializers.ModelSerializer):
    job = JobSerializer(read_only=True)

    class Meta:
        model = Bookmark
        fields = ['id', 'job', 'status', 'status_updated_at', 'created_at']

class JobMapPinSerializer(serializers.ModelSerializer):
    """Lightweight job shape for map markers — no match_score/is_bookmarked computation."""
    location_name = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = ['id', 'title', 'company', 'location_name', 'job_type', 'job_url', 'latitude', 'longitude']

    def get_location_name(self, obj):
        return _resolve_job_location_name(obj)

class FeedbackSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)

    class Meta:
        model = Feedback
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'rating', 'message', 'created_at', 'updated_at']
        read_only_fields = ['id', 'username', 'email', 'first_name', 'last_name', 'created_at', 'updated_at']

    def validate_rating(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value

class ScrapeSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScrapeSession
        fields = '__all__'

class ScrapeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScrapeLog
        fields = '__all__'


class PortfolioSettingsSerializer(serializers.ModelSerializer):
    """For authenticated user to GET/PATCH their own portfolio settings."""
    has_resume = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = ['is_public', 'template', 'theme', 'has_resume']
        read_only_fields = ['has_resume']

    def get_has_resume(self, obj):
        # resume_text is the reliable gate — it's always set after PDF extraction
        return bool(obj.user.profile.resume_text)


class PublicPortfolioSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    resume_parsed = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = ['username', 'resume_parsed', 'template', 'theme']

    def get_resume_parsed(self, obj):
        profile = obj.user.profile
        # If Groq already parsed, return it
        if profile.resume_parsed:
            return profile.resume_parsed
        # Fallback: parse on-demand for users who uploaded before Groq was added
        if profile.resume_text:
            parsed = parse_resume_with_groq(profile.resume_text)
            if parsed:
                profile.resume_parsed = parsed
                profile.save(update_fields=['resume_parsed'])
            return parsed
        return {}


class PortfolioViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortfolioView
        fields = ['ip_address', 'country', 'country_code', 'device', 'browser', 'operating_system', 'viewed_at']


class CustomCVSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomCV
        fields = [
            'id', 'label', 'target_role', 'template', 'content',
            'ats_score', 'ats_breakdown', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'ats_score', 'ats_breakdown', 'created_at', 'updated_at']

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        if 'content' in validated_data:
            instance.ats_score, instance.ats_breakdown = score_cv(instance.content, instance.target_role or None)
            instance.save(update_fields=['ats_score', 'ats_breakdown'])
        return instance


class CustomCVCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomCV
        fields = ['id', 'label', 'template', 'target_role']

    def create(self, validated_data):
        user = self.context['request'].user
        content = user.profile.resume_parsed or {}
        target_role = validated_data.get('target_role') or None
        ats_score, ats_breakdown = score_cv(content, target_role)
        return CustomCV.objects.create(
            user=user,
            content=content,
            ats_score=ats_score,
            ats_breakdown=ats_breakdown,
            **validated_data,
        )


class JobApplicationKitSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source='job.title', read_only=True)
    company = serializers.CharField(source='job.company', read_only=True)

    class Meta:
        model = JobApplicationKit
        fields = ['id', 'job', 'job_title', 'company', 'cover_letter', 'qa', 'created_at', 'updated_at']
        read_only_fields = ['id', 'job_title', 'company', 'created_at', 'updated_at']
