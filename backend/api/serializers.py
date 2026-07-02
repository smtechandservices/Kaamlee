import io
import os
import json
import PyPDF2
from groq import Groq
from rest_framework import serializers
from .models import Location, Job, ScrapeSession, ScrapeLog, Bookmark, Feedback, Portfolio
from django.contrib.auth.models import User

_groq = Groq(api_key=os.getenv('GROQ_API_KEY'))

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
    except Exception as e:
        print(f"Error extracting text: {e}")
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
    except Exception as e:
        print(f"Groq resume parse error: {e}")
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
    linkedin_url = serializers.URLField(source='profile.linkedin_url', required=False)
    resume = serializers.FileField(source='profile.resume', required=False, allow_null=True)
    resume_text = serializers.CharField(source='profile.resume_text', read_only=True)
    has_resume = serializers.SerializerMethodField()
    is_subscribed = serializers.BooleanField(source='profile.is_subscribed', required=False)
    subscription_expires_at = serializers.DateTimeField(source='profile.subscription_expires_at', required=False, allow_null=True)
    portfolio_is_public = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name', 'phone', 'linkedin_url',
            'resume', 'resume_text', 'has_resume', 'is_subscribed', 'subscription_expires_at',
            'is_superuser', 'is_staff', 'portfolio_is_public',
        )
        read_only_fields = ('id', 'username', 'email', 'is_superuser', 'is_staff', 'resume_text', 'has_resume', 'portfolio_is_public')

    def get_has_resume(self, obj):
        # resume_text is the reliable gate — it's always set after PDF extraction
        return bool(obj.profile.resume_text)

    def get_portfolio_is_public(self, obj):
        # Portfolio was added after some users already existed, so it may be missing.
        portfolio = getattr(obj, 'portfolio', None)
        return bool(portfolio.is_public) if portfolio else False

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        
        # Update User fields
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

            if profile.resume and profile.resume != resume_file:
                try:
                    profile.resume.delete(save=False)
                except Exception as e:
                    print(f"Error deleting old resume: {e}")

            profile.resume = resume_file
            if resume_file:
                if resume_file.name.endswith('.pdf'):
                    profile.resume_text = extract_text_from_pdf(resume_file)
                else:
                    profile.resume_text = resume_file.read().decode('utf-8', errors='ignore')
                profile.resume_parsed = parse_resume_with_groq(profile.resume_text)
            else:
                profile.resume_text = ""
                profile.resume_parsed = None

        if 'is_subscribed' in profile_data:
            profile.is_subscribed = profile_data['is_subscribed']
        if 'subscription_expires_at' in profile_data:
            profile.subscription_expires_at = profile_data['subscription_expires_at']
        profile.save()

        return instance

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

class LocationSerializer(serializers.ModelSerializer):
    job_count = serializers.IntegerField(read_only=True)
    accuracy_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = Location
        fields = ['id', 'country', 'country_code', 'state', 'city', 'last_scraped', 'job_count', 'accuracy_percentage']

    def get_accuracy_percentage(self, obj):
        jobs = obj.jobs.all()
        if not jobs:
            return 0
        accurate_jobs = sum(1 for job in jobs if obj.city.lower() in job.location_name.lower())
        return round((accurate_jobs / len(jobs)) * 100, 1)

def _resolve_job_location_name(obj):
    name = obj.location_name
    if name and str(name).strip().lower() not in ('', 'nan', 'none'):
        return name.strip()
    # Fall back to the FK location's city/country
    if obj.location_id:
        loc = obj.location
        parts = [p for p in [loc.city, loc.state, loc.country] if p]
        return ', '.join(parts)
    return None

class JobSerializer(serializers.ModelSerializer):
    match_score = serializers.SerializerMethodField()
    is_bookmarked = serializers.BooleanField(read_only=True)
    location_name = serializers.SerializerMethodField()

    class Meta:
        model = Job
        # description and id_from_site excluded — description is a large TextField
        # not needed for card/list/map views
        fields = [
            'id', 'title', 'company', 'location_name', 'location',
            'is_remote', 'job_type', 'job_url', 'site', 'company_logo',
            'date_posted', 'created_at', 'latitude', 'longitude',
            'is_bookmarked', 'match_score',
        ]

    def get_location_name(self, obj):
        return _resolve_job_location_name(obj)

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
    pass

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
