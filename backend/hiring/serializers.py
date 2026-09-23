import json
import logging

from django.utils import timezone
from rest_framework import serializers

from api.serializers import _groq_chat_completion, _GROQ_MODEL
from api.groq_usage import GroqQuotaExceeded
from .models import JobPosting, Application, ApplicationStageChange, SavedJob, JobApplicationKit, APPLICATION_STAGE_CHOICES

logger = logging.getLogger(__name__)


class JobPostingSerializer(serializers.ModelSerializer):
    """Used for both the employer's own CRUD and the public browse/detail
    endpoints — status/employer are read-only from the client's side; the
    view sets them (employer CRUD) or filters on them (public browse)."""
    employer_name = serializers.CharField(source='employer.name', read_only=True)
    employer_logo = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    has_applied = serializers.SerializerMethodField()

    class Meta:
        model = JobPosting
        fields = [
            'id', 'employer', 'employer_name', 'employer_logo', 'title', 'description',
            'employment_type', 'salary_min', 'salary_max', 'salary_currency',
            'city', 'state', 'country', 'latitude', 'longitude', 'is_remote', 'experience_level', 'category',
            'status', 'application_form_schema', 'screening_questions', 'is_saved', 'has_applied',
            'created_at', 'updated_at', 'published_at', 'closes_at',
        ]
        read_only_fields = [
            'id', 'employer', 'employer_name', 'employer_logo', 'is_saved', 'has_applied',
            'created_at', 'updated_at', 'published_at',
        ]

    def get_employer_logo(self, obj):
        return obj.employer.logo_src

    def get_is_saved(self, obj):
        # Annotated by the list/map-pins views (Exists subquery) to avoid an
        # N+1 — this falls back to a direct query for the detail view.
        if hasattr(obj, 'is_saved_annotated'):
            return bool(obj.is_saved_annotated)
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return SavedJob.objects.filter(user=request.user, job_posting=obj).exists()

    def get_has_applied(self, obj):
        if hasattr(obj, 'has_applied_annotated'):
            return bool(obj.has_applied_annotated)
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return Application.objects.filter(candidate=request.user, job_posting=obj).exists()


class AdminJobPostingSerializer(serializers.ModelSerializer):
    """Read-only shape for the admin Postings page — every field an
    employer can set, plus employer_kyc_status (a quick trust signal: an
    employer normally can't post at all until KYC-approved — see
    IsApprovedEmployer — so this mainly matters if their KYC is later
    revoked) and applications_count (annotated by the view, avoids an
    N+1 vs. calling .applications.count() per row)."""
    employer_name = serializers.CharField(source='employer.name', read_only=True)
    employer_logo = serializers.SerializerMethodField()
    employer_kyc_status = serializers.CharField(source='employer.kyc_status', read_only=True)
    applications_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = JobPosting
        fields = [
            'id', 'employer', 'employer_name', 'employer_logo', 'employer_kyc_status',
            'title', 'description', 'employment_type', 'salary_min', 'salary_max', 'salary_currency',
            'city', 'state', 'country', 'latitude', 'longitude', 'is_remote', 'experience_level', 'category',
            'status', 'application_form_schema', 'screening_questions', 'applications_count',
            'created_at', 'updated_at', 'published_at', 'closes_at',
        ]
        read_only_fields = fields

    def get_employer_logo(self, obj):
        return obj.employer.logo_src


class AdminJobPostingCreateSerializer(serializers.ModelSerializer):
    """POST /hiring/admin/jobs/ — an admin posting a job directly under a
    chosen employer, bypassing the employer-side KYC-gated create flow
    (EmployerJobPostingListCreateView). `employer` has to be provided
    explicitly here since there's no request.user.employer_membership to
    infer it from; `created_by` stays null (no EmployerMember to attribute
    it to — the model already allows that)."""
    class Meta:
        model = JobPosting
        fields = [
            'id', 'employer', 'title', 'description', 'employment_type',
            'salary_min', 'salary_max', 'salary_currency',
            'city', 'state', 'country', 'latitude', 'longitude', 'is_remote',
            'experience_level', 'category', 'status',
            'application_form_schema', 'screening_questions',
            'published_at', 'closes_at',
        ]
        read_only_fields = ['id', 'published_at']

    def create(self, validated_data):
        # Mirrors EmployerJobPostingPublishView: posting straight to
        # 'published' should stamp published_at the same way going through
        # the employer's own publish step would.
        if validated_data.get('status') == 'published':
            validated_data['published_at'] = timezone.now()
        return super().create(validated_data)


class SavedJobSerializer(serializers.ModelSerializer):
    job_posting = JobPostingSerializer(read_only=True)

    class Meta:
        model = SavedJob
        fields = ['id', 'job_posting', 'created_at']


class ApplicationSerializer(serializers.ModelSerializer):
    """Candidate's own read-only view of an application — 'my applications'."""
    job_posting_title = serializers.CharField(source='job_posting.title', read_only=True)
    employer_name = serializers.CharField(source='job_posting.employer.name', read_only=True)
    employer_logo = serializers.SerializerMethodField()
    rejection_note = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            'id', 'job_posting', 'job_posting_title', 'employer_name', 'employer_logo',
            'cv', 'portfolio_public_snapshot', 'form_responses', 'screening_answers',
            'stage', 'stage_updated_at', 'applied_at', 'rejection_note',
        ]
        read_only_fields = fields

    def get_employer_logo(self, obj):
        return obj.job_posting.employer.logo_src

    def get_rejection_note(self, obj):
        if obj.stage != 'rejected':
            return None
        change = obj.stage_changes.filter(to_stage='rejected').order_by('-created_at').first()
        return change.note if change else None


class ApplicationCreateSerializer(serializers.ModelSerializer):
    """POST /hiring/jobs/<id>/apply/ — job_posting and candidate come from the
    view/context, not the client."""
    make_portfolio_public = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Application
        fields = ['cv', 'form_responses', 'screening_answers', 'make_portfolio_public']

    def validate_cv(self, value):
        request = self.context['request']
        if value and value.user_id != request.user.id:
            raise serializers.ValidationError("That CV doesn't belong to you.")
        return value

    def create(self, validated_data):
        make_public = validated_data.pop('make_portfolio_public', False)
        request = self.context['request']
        job_posting = self.context['job_posting']

        portfolio = getattr(request.user, 'portfolio', None)
        if make_public and portfolio and not portfolio.is_public:
            portfolio.is_public = True
            portfolio.save(update_fields=['is_public'])

        return Application.objects.create(
            job_posting=job_posting,
            candidate=request.user,
            portfolio_public_snapshot=bool(portfolio and portfolio.is_public),
            **validated_data,
        )


class ApplicationKanbanSerializer(serializers.ModelSerializer):
    """Employer's view of one application on the Kanban board — candidate
    contact info, CV/portfolio pointers, and answers, but no ability to edit
    anything but `stage` (see StageChangeSerializer)."""
    candidate_username = serializers.CharField(source='candidate.username', read_only=True)
    candidate_email = serializers.CharField(source='candidate.email', read_only=True)
    candidate_phone = serializers.SerializerMethodField()
    cv = serializers.SerializerMethodField()
    portfolio_url = serializers.SerializerMethodField()
    latest_note = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            'id', 'job_posting', 'candidate_username', 'candidate_email', 'candidate_phone',
            'cv', 'portfolio_url', 'portfolio_public_snapshot', 'form_responses', 'screening_answers',
            'stage', 'stage_updated_at', 'applied_at', 'latest_note',
        ]
        read_only_fields = fields

    def get_candidate_phone(self, obj):
        profile = getattr(obj.candidate, 'profile', None)
        return profile.phone if profile else None

    def get_cv(self, obj):
        if not obj.cv:
            return None
        return {'id': obj.cv.id, 'label': obj.cv.label, 'target_role': obj.cv.target_role, 'ats_score': obj.cv.ats_score}

    def get_portfolio_url(self, obj):
        portfolio = getattr(obj.candidate, 'portfolio', None)
        if portfolio and portfolio.is_public:
            return f'/portfolio/{obj.candidate.username}'
        return None

    def get_latest_note(self, obj):
        change = obj.stage_changes.filter(to_stage='rejected').order_by('-created_at').first()
        return change.note if change else None


class StageChangeSerializer(serializers.Serializer):
    """PATCH /hiring/applications/<id>/stage/"""
    to_stage = serializers.ChoiceField(choices=APPLICATION_STAGE_CHOICES)
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data['to_stage'] == 'rejected' and not data.get('note', '').strip():
            raise serializers.ValidationError({'note': 'A reason is required when rejecting.'})
        return data


APPLICATION_KIT_QUESTIONS = [
    "How many years of experience do you have that are relevant to this role?",
    "Why do you want to leave your current job / why are you interested in this opportunity?",
    "What are you looking for in your next role?",
    "Why should we hire you for this position?",
    "What are your key strengths relevant to this job?",
]

_APPLICATION_KIT_PROMPT_TEMPLATE = """You are a career coach helping a candidate apply for a job. You will be given the candidate's resume as JSON, plus a job's title, employer, and description.

Using ONLY information grounded in the candidate's resume — do not invent employers, job titles, dates, degrees, projects, or skills not present in the resume — produce:

1. "cover_letter": a concise, personalized cover letter (3-4 short paragraphs, first person, professional but warm tone). Address it to the employer by name, reference the job title, and connect the candidate's real experience/skills to what the role likely needs based on the description. No placeholder text like "[Employer Name]".
2. "qa": short, natural, first-person answers (2-4 sentences each) to each of these common application questions, grounded in the resume and tailored to this specific job:
{questions}

Job title: {job_title}
Employer: {employer}
Job description: {job_description}

Return ONLY valid JSON, no markdown, with this exact structure:
{{
  "cover_letter": "...",
  "qa": [
    {{"question": "...", "answer": "..."}}
  ]
}}
"""

def generate_application_kit_with_groq(resume_content: dict, job_title: str, employer: str, job_description: str, profile) -> dict:
    prompt = _APPLICATION_KIT_PROMPT_TEMPLATE.format(
        questions="\n".join(f"- {q}" for q in APPLICATION_KIT_QUESTIONS),
        job_title=job_title,
        employer=employer or "the employer",
        job_description=(job_description or "")[:4000],
    )
    try:
        response = _groq_chat_completion(
            profile,
            model=_GROQ_MODEL,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps(resume_content)},
            ],
            temperature=0.4,
            max_tokens=2048,
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except GroqQuotaExceeded:
        raise
    except Exception:
        logger.exception("Groq application kit error")
        return {}


class JobApplicationKitSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source='job_posting.title', read_only=True)
    employer = serializers.CharField(source='job_posting.employer.name', read_only=True)

    class Meta:
        model = JobApplicationKit
        fields = ['id', 'job_posting', 'job_title', 'employer', 'cover_letter', 'qa', 'created_at', 'updated_at']
        read_only_fields = ['id', 'job_title', 'employer', 'created_at', 'updated_at']
