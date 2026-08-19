from rest_framework import serializers
from .models import AmbassadorApplication

class AmbassadorApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AmbassadorApplication
        fields = [
            'id', 'full_name', 'email', 'phone',
            'college_name', 'college_city', 'college_state',
            'course', 'degree_level', 'graduation_year',
            'id_card_image', 'status', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'created_at']

    MAX_ID_CARD_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB — matches the resume upload limit

    def validate_id_card_image(self, value):
        if value.size > self.MAX_ID_CARD_SIZE_BYTES:
            raise serializers.ValidationError("Image is too large (max 5 MB).")
        return value


class AmbassadorApplicationStatusSerializer(serializers.ModelSerializer):
    """Admin-only: review an application — set its status and leave a note."""
    class Meta:
        model = AmbassadorApplication
        fields = ['id', 'status', 'reviewer_notes']
        read_only_fields = ['id']
