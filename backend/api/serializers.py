from rest_framework import serializers
from .models import Location, Job, ScrapeSession, ScrapeLog
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(source='profile.phone', required=False)
    linkedin_url = serializers.URLField(source='profile.linkedin_url', required=False)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'phone', 'linkedin_url')
        read_only_fields = ('id', 'username', 'email') # Don't allow changing core account info here

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        phone = profile_data.get('phone')
        linkedin_url = profile_data.get('linkedin_url')

        # Update User fields
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.save()

        # Update Profile fields
        profile = instance.profile
        if phone is not None:
            profile.phone = phone
        if linkedin_url is not None:
            profile.linkedin_url = linkedin_url
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

