from rest_framework import serializers
from .models import Location, Job, ScrapeSession, ScrapeLog
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(source='profile.phone', required=False)
    linkedin_url = serializers.URLField(source='profile.linkedin_url', required=False)
    is_subscribed = serializers.BooleanField(source='profile.is_subscribed', required=False)
    subscription_expires_at = serializers.DateTimeField(source='profile.subscription_expires_at', required=False, allow_null=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'phone', 'linkedin_url', 'is_subscribed', 'subscription_expires_at', 'is_superuser', 'is_staff')
        read_only_fields = ('id', 'username', 'email', 'is_superuser', 'is_staff') # Don't allow changing core account info here

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
    class Meta:
        model = Job
        fields = '__all__'

class ScrapeSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScrapeSession
        fields = '__all__'

class ScrapeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScrapeLog
        fields = '__all__'

