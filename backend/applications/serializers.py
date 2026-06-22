from rest_framework import serializers
from .models import Application, ApplicationEvent, ResumeVersion, ApplicationAnswer
from api.models import Job

class ResumeVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResumeVersion
        fields = '__all__'

class ApplicationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationEvent
        fields = '__all__'

class ApplicationSerializer(serializers.ModelSerializer):
    events = ApplicationEventSerializer(many=True, read_only=True)
    job_details = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = '__all__'

    def get_job_details(self, obj):
        return {
            'title': obj.job.title,
            'company': obj.job.company,
            'job_url': obj.job.job_url,
        }

class ApplicationAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationAnswer
        fields = '__all__'
