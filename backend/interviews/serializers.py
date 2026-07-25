from rest_framework import serializers
from .models import InterviewSession


class InterviewSessionSerializer(serializers.ModelSerializer):
    current_round = serializers.CharField(read_only=True)

    class Meta:
        model = InterviewSession
        fields = [
            'id', 'target_role', 'status', 'current_round', 'current_round_index',
            'overall_score', 'started_at', 'completed_at',
        ]
