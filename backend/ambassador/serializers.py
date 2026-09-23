from django.contrib.auth.models import User
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

    def validate_email(self, value):
        """Applying is only open to existing Kaamlee candidates (matched by
        email — applications have no FK to User), and only one live
        application per email: a rejected applicant may apply again, but a
        pending or approved one can't stack duplicates."""
        email = value.strip().lower()
        is_candidate = User.objects.filter(
            email__iexact=email, is_staff=False, is_superuser=False, employer_membership__isnull=True,
        ).exists()
        if not is_candidate:
            raise serializers.ValidationError(
                "No Kaamlee account uses this email. Sign up on Kaamlee first, then apply with the same email."
            )
        existing = (
            AmbassadorApplication.objects.filter(email__iexact=email, status__in=['pending', 'approved'])
            .order_by('-created_at').first()
        )
        if existing:
            raise serializers.ValidationError(
                "You're already a Kaamlee campus ambassador." if existing.status == 'approved'
                else "You've already applied with this email — your application is under review."
            )
        return email


class AmbassadorApplicationAdminSerializer(AmbassadorApplicationSerializer):
    """Admin list only: there's no FK from an application to a Kaamlee
    account, so a matching login (by email) is surfaced here — lets the
    admin page offer "delete their account too" when removing an
    application."""
    account_username = serializers.SerializerMethodField()

    class Meta(AmbassadorApplicationSerializer.Meta):
        fields = AmbassadorApplicationSerializer.Meta.fields + ['account_username']

    def get_account_username(self, obj):
        user = User.objects.filter(email__iexact=obj.email, is_superuser=False).first()
        return user.username if user else None


class AmbassadorApplicationStatusSerializer(serializers.ModelSerializer):
    """Admin-only: review an application — set its status and leave a note."""
    class Meta:
        model = AmbassadorApplication
        fields = ['id', 'status', 'reviewer_notes']
        read_only_fields = ['id']
