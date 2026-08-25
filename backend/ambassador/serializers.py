from django.contrib.auth.models import User
from rest_framework import serializers
from .models import AmbassadorApplication, AmbassadorProfile

class AmbassadorApplicationSerializer(serializers.ModelSerializer):
    ambassador_username = serializers.SerializerMethodField()
    referral_code = serializers.SerializerMethodField()

    class Meta:
        model = AmbassadorApplication
        fields = [
            'id', 'full_name', 'email', 'phone',
            'college_name', 'college_city', 'college_state',
            'course', 'degree_level', 'graduation_year',
            'id_card_image', 'status', 'created_at',
            'ambassador_username', 'referral_code',
        ]
        read_only_fields = ['id', 'status', 'created_at']

    def get_ambassador_username(self, obj):
        profile = getattr(obj, 'ambassador_profile', None)
        return profile.user.username if profile else None

    def get_referral_code(self, obj):
        profile = getattr(obj, 'ambassador_profile', None)
        return profile.referral_code if profile else None

    MAX_ID_CARD_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB — matches the resume upload limit

    def validate_email(self, value):
        # Ambassador accounts are provisioned by reusing a candidate's existing
        # Kaamlee account on approval (see create_ambassador_account) — so the
        # applicant needs to have signed up on the main site first, with this
        # same email, before they can apply.
        if not User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "No Kaamlee account found with this email. Sign up on Kaamlee first, then apply."
            )
        return value

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


class ReferralSerializer(serializers.Serializer):
    """A candidate referred by an ambassador — sourced from api.Profile."""
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='user.email')
    joined_at = serializers.DateTimeField(source='user.date_joined')
    is_subscribed = serializers.BooleanField()
    subscription_expires_at = serializers.DateTimeField(allow_null=True)

    def get_name(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.username
