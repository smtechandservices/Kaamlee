import io
import PyPDF2
from rest_framework import serializers
from .models import Location, Job, ScrapeSession, ScrapeLog
from django.contrib.auth.models import User

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
    is_subscribed = serializers.BooleanField(source='profile.is_subscribed', required=False)
    subscription_expires_at = serializers.DateTimeField(source='profile.subscription_expires_at', required=False, allow_null=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'phone', 'linkedin_url', 'resume', 'resume_text', 'is_subscribed', 'subscription_expires_at', 'is_superuser', 'is_staff')
        read_only_fields = ('id', 'username', 'email', 'is_superuser', 'is_staff', 'resume_text')

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
            
            # Physically delete the old file if it exists
            if profile.resume and profile.resume != resume_file:
                try:
                    profile.resume.delete(save=False)
                except Exception as e:
                    print(f"Error deleting old resume: {e}")

            profile.resume = resume_file
            # Extract text
            if resume_file:
                if resume_file.name.endswith('.pdf'):
                    profile.resume_text = extract_text_from_pdf(resume_file)
                else:
                    profile.resume_text = f"Resume file: {resume_file.name}"
            else:
                profile.resume_text = ""

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

class JobSerializer(serializers.ModelSerializer):
    match_score = serializers.SerializerMethodField()
    
    class Meta:
        model = Job
        fields = '__all__'

    def get_match_score(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not hasattr(request.user, 'profile'):
            return 0
        
        resume_text = request.user.profile.resume_text
        if not resume_text:
            return 0
            
        return calculate_match(resume_text, obj.title, obj.description)

class ScrapeSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScrapeSession
        fields = '__all__'

class ScrapeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScrapeLog
        fields = '__all__'

