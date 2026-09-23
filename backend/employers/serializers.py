from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .models import Employer, EmployerMember, KYCDocument


class KYCDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = KYCDocument
        fields = ['id', 'doc_type', 'file', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']


class LogoFallbackMixin:
    """`logo` falls back to `logo_url` when no file has been uploaded, so
    every client can keep rendering a single `logo` field."""
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not data.get('logo'):
            data['logo'] = instance.logo_url or None
        return data


class EmployerSerializer(LogoFallbackMixin, serializers.ModelSerializer):
    """GET/PATCH /employers/me/ — the employer's own editable profile.
    KYC fields are read-only here; they only change via the admin review
    endpoint or a new KYCDocument submission."""
    role = serializers.SerializerMethodField()
    kyc_documents = KYCDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = Employer
        fields = [
            'id', 'name', 'legal_name', 'industry', 'size', 'website', 'logo', 'logo_url',
            'address', 'contact_email', 'contact_phone',
            'kyc_status', 'kyc_rejection_reason', 'kyc_documents', 'role', 'created_at',
        ]
        read_only_fields = ['id', 'kyc_status', 'kyc_rejection_reason', 'kyc_documents', 'role', 'created_at']

    def get_role(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        membership = getattr(request.user, 'employer_membership', None)
        return membership.role if membership else None


class EmployerMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)

    class Meta:
        model = EmployerMember
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'created_at']
        read_only_fields = ['id', 'username', 'email', 'first_name', 'last_name', 'created_at']


class EmployerMemberRoleUpdateSerializer(serializers.ModelSerializer):
    """PATCH /employers/team/<id>/ — owner-only, and never onto/off the
    owner role itself (see EmployerTeamMemberDetailView)."""
    class Meta:
        model = EmployerMember
        fields = ['role']

    def validate_role(self, value):
        if value not in ('admin', 'recruiter'):
            raise serializers.ValidationError('Role must be admin or recruiter.')
        return value


class AdminEmployerCreateSerializer(serializers.Serializer):
    """POST /employers/admin/kyc/ — a platform admin creates the Employer
    together with its initial owner login. Employers can't self-sign-up;
    the owner then invites the rest of the team from the employer portal."""
    employer_name = serializers.CharField(max_length=255)
    contact_email = serializers.EmailField()
    contact_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    website = serializers.URLField(max_length=500, required=False, allow_blank=True)
    industry = serializers.CharField(max_length=100, required=False, allow_blank=True)
    logo_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    owner_username = serializers.CharField(max_length=150)
    owner_email = serializers.EmailField()
    owner_first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    owner_last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_contact_email(self, value):
        if Employer.objects.filter(contact_email__iexact=value).exists():
            raise serializers.ValidationError('Another employer already uses this contact email.')
        return value

    def validate_owner_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_owner_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('This email is already in use.')
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        user = User.objects.create_user(
            validated_data['owner_username'],
            validated_data['owner_email'],
            validated_data['password'],
            first_name=validated_data.get('owner_first_name', ''),
            last_name=validated_data.get('owner_last_name', ''),
        )
        employer = Employer.objects.create(
            name=validated_data['employer_name'],
            contact_email=validated_data['contact_email'],
            contact_phone=validated_data.get('contact_phone', ''),
            website=validated_data.get('website', ''),
            industry=validated_data.get('industry', ''),
            logo_url=validated_data.get('logo_url', ''),
        )
        EmployerMember.objects.create(employer=employer, user=user, role='owner')
        return employer


class EmployerTeamInviteSerializer(serializers.Serializer):
    """POST /employers/team/invite/ — an owner/admin creates a teammate's
    login directly (no separate invite-link/accept flow yet)."""
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=[('admin', 'Admin'), ('recruiter', 'Recruiter')], default='recruiter')

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('This email is already in use.')
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        employer = self.context['employer']
        user = User.objects.create_user(
            validated_data['username'], validated_data['email'], validated_data['password'],
        )
        return EmployerMember.objects.create(employer=employer, user=user, role=validated_data['role'])


class AdminEmployerSerializer(LogoFallbackMixin, serializers.ModelSerializer):
    """Read-only employer shape for the admin KYC queue, with documents nested
    so a reviewer doesn't need a second request to see what was submitted.
    Also nests team members — employer-affiliated logins are managed from here
    rather than the main admin Users list (see AdminUserViewSet)."""
    kyc_documents = KYCDocumentSerializer(many=True, read_only=True)
    members = EmployerMemberSerializer(many=True, read_only=True)

    class Meta:
        model = Employer
        fields = [
            'id', 'name', 'legal_name', 'industry', 'size', 'website', 'logo', 'logo_url',
            'address', 'contact_email', 'contact_phone',
            'kyc_status', 'kyc_reviewed_at', 'kyc_rejection_reason', 'kyc_documents', 'members', 'created_at',
        ]


class AdminEmployerKYCReviewSerializer(serializers.ModelSerializer):
    """PATCH /employers/admin/kyc/<id>/ — approve or reject."""
    class Meta:
        model = Employer
        fields = ['kyc_status', 'kyc_rejection_reason']

    def validate(self, data):
        if data.get('kyc_status') == 'rejected' and not data.get('kyc_rejection_reason'):
            raise serializers.ValidationError({'kyc_rejection_reason': 'A reason is required when rejecting.'})
        return data

    def update(self, instance, validated_data):
        from django.utils import timezone
        instance.kyc_status = validated_data['kyc_status']
        instance.kyc_rejection_reason = validated_data.get('kyc_rejection_reason', '')
        instance.kyc_reviewed_by = self.context['request'].user
        instance.kyc_reviewed_at = timezone.now()
        instance.save()
        return instance


class AdminEmployerMemberUpdateSerializer(serializers.Serializer):
    """PATCH /employers/admin/members/<id>/ — a platform admin editing a team
    member directly (unlike the owner-only self-service team management,
    this is a full override: any field, any role, including 'owner'). Every
    field is optional and left untouched if omitted — new_password included:
    blank/omitted means the password doesn't change."""
    username = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(required=False)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=[('owner', 'Owner'), ('admin', 'Admin'), ('recruiter', 'Recruiter')], required=False)
    new_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    confirm_password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.exclude(pk=self.instance.user_id).filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_email(self, value):
        if User.objects.exclude(pk=self.instance.user_id).filter(email__iexact=value).exists():
            raise serializers.ValidationError('This email is already in use.')
        return value

    def validate(self, data):
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')
        if new_password or confirm_password:
            if new_password != confirm_password:
                raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
            validate_password(new_password, user=self.instance.user)
        return data

    def update(self, instance, validated_data):
        user = instance.user
        for field in ('username', 'email', 'first_name', 'last_name'):
            if field in validated_data:
                setattr(user, field, validated_data[field])
        new_password = validated_data.get('new_password')
        if new_password:
            user.set_password(new_password)
        user.save()

        if 'role' in validated_data:
            instance.role = validated_data['role']
            instance.save(update_fields=['role'])
        return instance
