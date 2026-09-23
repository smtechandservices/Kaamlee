import re

from django.db.models import Q, F, Count, Max, Exists, OuterRef
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, views, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from employers.permissions import IsEmployerMember, IsApprovedEmployer
from api.models import Bookmark
from api.permissions import IsSubscribed, is_user_subscribed
from api.groq_usage import GroqQuotaExceeded, usage_summary
from scripts.cv_export import render_cv_pdf, render_cv_docx
from .models import JobPosting, Application, ApplicationStageChange, SavedJob, JobApplicationKit
from .serializers import (
    JobPostingSerializer, AdminJobPostingSerializer, AdminJobPostingCreateSerializer, SavedJobSerializer,
    ApplicationSerializer, ApplicationCreateSerializer, ApplicationKanbanSerializer, StageChangeSerializer,
    JobApplicationKitSerializer, generate_application_kit_with_groq,
)


class JobPostingPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ==========================================
# EMPLOYER SIDE
# ==========================================

class EmployerJobPostingListCreateView(generics.ListCreateAPIView):
    """GET/POST /hiring/jobs/ — an employer's own postings (any status),
    scoped to the caller's employer account."""
    serializer_class = JobPostingSerializer
    permission_classes = [IsEmployerMember, IsApprovedEmployer]
    pagination_class = JobPostingPagination

    def get_queryset(self):
        return JobPosting.objects.filter(
            employer=self.request.user.employer_membership.employer
        ).order_by('-created_at')

    def perform_create(self, serializer):
        membership = self.request.user.employer_membership
        serializer.save(employer=membership.employer, created_by=membership)


class EmployerJobPostingDetailView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /hiring/jobs/<id>/ — employer-side edit, scoped to own employer account."""
    serializer_class = JobPostingSerializer
    permission_classes = [IsEmployerMember, IsApprovedEmployer]

    def get_queryset(self):
        return JobPosting.objects.filter(employer=self.request.user.employer_membership.employer)


class EmployerJobPostingPublishView(views.APIView):
    """POST /hiring/jobs/<id>/publish/"""
    permission_classes = [IsEmployerMember, IsApprovedEmployer]

    def post(self, request, pk):
        job = get_object_or_404(JobPosting, pk=pk, employer=request.user.employer_membership.employer)
        job.status = 'published'
        if not job.published_at:
            job.published_at = timezone.now()
        job.save(update_fields=['status', 'published_at'])
        return Response(JobPostingSerializer(job).data)


class EmployerJobApplicationsView(generics.ListAPIView):
    """GET /hiring/jobs/<id>/applications/ — Kanban data for one posting,
    grouped client-side by `stage`."""
    serializer_class = ApplicationKanbanSerializer
    permission_classes = [IsEmployerMember, IsApprovedEmployer]

    def get_queryset(self):
        job = get_object_or_404(
            JobPosting, pk=self.kwargs['pk'], employer=self.request.user.employer_membership.employer
        )
        return (
            Application.objects.filter(job_posting=job)
            .select_related('candidate', 'candidate__profile', 'candidate__portfolio', 'cv')
            .prefetch_related('stage_changes')
            .order_by('-applied_at')
        )


class EmployerApplicationStageView(views.APIView):
    """PATCH /hiring/applications/<id>/stage/ — move a card. Rejecting
    without a note 400s (see StageChangeSerializer)."""
    permission_classes = [IsEmployerMember, IsApprovedEmployer]

    def patch(self, request, pk):
        membership = request.user.employer_membership
        application = get_object_or_404(Application, pk=pk, job_posting__employer=membership.employer)

        serializer = StageChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        to_stage = serializer.validated_data['to_stage']
        note = serializer.validated_data.get('note', '')

        from_stage = application.stage
        application.stage = to_stage
        application.save(update_fields=['stage', 'stage_updated_at'])
        ApplicationStageChange.objects.create(
            application=application, from_stage=from_stage, to_stage=to_stage,
            changed_by=membership, note=note,
        )
        return Response(ApplicationKanbanSerializer(application).data)


def _render_application_cv(application, fmt):
    """Shared by the employer- and admin-side CV views — renders the CV
    attached to `application` the same way the candidate's own
    CustomCVExportView does, but without that view's subscription gate:
    the CV was legitimately attached at application time, so neither an
    employer nor an admin's ability to see it should hinge on whether the
    candidate later lets a subscription lapse."""
    cv = application.cv
    if not cv:
        return Response({'error': "This applicant didn't attach a CV."}, status=404)

    name = (cv.content.get('name') or application.candidate.get_full_name() or application.candidate.username or 'resume').strip()
    role = (cv.target_role or cv.content.get('role') or '').strip()
    filename = '_'.join(p for p in [name, role, 'CV'] if p).replace(' ', '_')

    if fmt == 'docx':
        data = render_cv_docx(cv.content)
        response = HttpResponse(
            data,
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}.docx"'
        return response
    elif fmt == 'pdf':
        data = render_cv_pdf(cv.content, cv.template)
        if data is None:
            return Response({'error': 'Failed to generate PDF.'}, status=500)
        response = HttpResponse(data, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}.pdf"'
        return response
    else:
        return Response({'error': 'format must be pdf or docx.'}, status=400)


class EmployerApplicationCVView(views.APIView):
    """GET /hiring/applications/<id>/cv/?type=pdf|docx — the CV a candidate
    attached to this specific application, scoped the same way stage
    changes are (job_posting__employer must be the caller's employer)."""
    permission_classes = [IsEmployerMember, IsApprovedEmployer]

    def get(self, request, pk):
        membership = request.user.employer_membership
        application = get_object_or_404(
            Application.objects.select_related('cv', 'candidate'),
            pk=pk, job_posting__employer=membership.employer,
        )
        return _render_application_cv(application, request.query_params.get('type', 'pdf'))


# ==========================================
# ADMIN SIDE
# ==========================================

class AdminJobPostingListView(generics.ListCreateAPIView):
    """GET /hiring/admin/jobs/ — every posting from every employer, for the
    admin Postings page. ?status=, ?category=, ?employer=<id>, ?search=
    (title or employer name).

    POST /hiring/admin/jobs/ — an admin posting a job directly, choosing
    which employer it belongs to (see AdminJobPostingCreateSerializer)."""
    permission_classes = [permissions.IsAdminUser]
    pagination_class = JobPostingPagination

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AdminJobPostingCreateSerializer
        return AdminJobPostingSerializer

    def create(self, request, *args, **kwargs):
        # Re-serialize with the read shape (employer_name/logo/kyc_status/
        # applications_count) so the frontend gets back the same object
        # shape the list view gives it, not the bare write-serializer fields.
        response = super().create(request, *args, **kwargs)
        job = JobPosting.objects.select_related('employer').annotate(
            applications_count=Count('applications')
        ).get(pk=response.data['id'])
        response.data = AdminJobPostingSerializer(job).data
        return response

    def get_queryset(self):
        queryset = (
            self._filtered(JobPosting.objects.all())
            .select_related('employer')
            .annotate(applications_count=Count('applications'))
            .order_by('-created_at')
        )
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Summary cards: follow category/employer/search but deliberately
        # ignore ?status=, so the per-status breakdown stays meaningful
        # while a status tab is selected.
        base = self._filtered(JobPosting.objects.all())
        stats = base.aggregate(
            total=Count('id'),
            published=Count('id', filter=Q(status='published')),
            draft=Count('id', filter=Q(status='draft')),
            paused=Count('id', filter=Q(status='paused')),
            closed=Count('id', filter=Q(status='closed')),
            most_recent_created=Max('created_at'),
        )
        stats['applications'] = Application.objects.filter(job_posting__in=base).count()
        stats['employers'] = base.values('employer_id').distinct().count()
        response.data['stats'] = stats
        return response

    def _filtered(self, queryset):
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category__iexact=category)

        employer_id = self.request.query_params.get('employer')
        if employer_id:
            queryset = queryset.filter(employer_id=employer_id)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(employer__name__icontains=search))

        return queryset


class AdminJobPostingDetailView(generics.RetrieveDestroyAPIView):
    """GET /hiring/admin/jobs/<id>/ — full posting detail (same shape as the
    list, no separate detail serializer needed since nothing here is huge
    like the employer KYC documents are). DELETE — remove a posting outright;
    there's no "hide"/"flag" state on JobPosting today, so this is the only
    moderation action available until one gets added."""
    queryset = JobPosting.objects.all().select_related('employer').annotate(applications_count=Count('applications'))
    serializer_class = AdminJobPostingSerializer
    permission_classes = [permissions.IsAdminUser]


class AdminJobApplicationsView(generics.ListAPIView):
    """GET /hiring/admin/jobs/<id>/applications/ — every applicant for a
    posting, for the admin Postings page. Same shape (ApplicationKanbanSerializer)
    the employer's own applicant board uses, but not scoped to a particular
    employer — an admin can inspect any posting's applicants."""
    serializer_class = ApplicationKanbanSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        job = get_object_or_404(JobPosting, pk=self.kwargs['pk'])
        return (
            Application.objects.filter(job_posting=job)
            .select_related('candidate', 'candidate__profile', 'candidate__portfolio', 'cv')
            .prefetch_related('stage_changes')
            .order_by('-applied_at')
        )


class AdminApplicationCVView(views.APIView):
    """GET /hiring/admin/applications/<id>/cv/?type=pdf|docx — admin
    equivalent of EmployerApplicationCVView, not scoped to an employer."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        application = get_object_or_404(Application.objects.select_related('cv', 'candidate'), pk=pk)
        return _render_application_cv(application, request.query_params.get('type', 'pdf'))


# ==========================================
# CANDIDATE SIDE
# ==========================================

def _filter_published_jobs(queryset, params):
    """Shared by the list and map-pins views so both respect the same
    ?search=/?category=/?country=/?location=/?is_remote=/?employment_type= filters."""
    search = params.get('search')
    if search:
        queryset = queryset.filter(Q(title__icontains=search) | Q(employer__name__icontains=search))

    category = params.get('category')
    if category and category != 'All':
        queryset = queryset.filter(category__iexact=category)

    country = params.get('country')
    if country and country != 'All':
        queryset = queryset.filter(country__iexact=country)

    location = params.get('location')
    if location:
        queryset = queryset.filter(
            Q(city__icontains=location) | Q(state__icontains=location) | Q(country__icontains=location)
        )

    is_remote = params.get('is_remote')
    if is_remote == 'true':
        queryset = queryset.filter(is_remote=True)

    employment_type = params.get('employment_type')
    if employment_type:
        queryset = queryset.filter(employment_type=employment_type)

    return queryset


# Non-subscribers get a capped, most-recent-first taste of the map/list —
# same free-preview pattern the old scraped-job browser used (see api.permissions).
FREE_PREVIEW_LIMIT = 200


class PublicJobPostingListView(generics.ListAPIView):
    """GET /hiring/jobs/public/ — published postings only. ?search=, ?category=,
    ?country=, ?is_remote=, ?employment_type=. Requires login; non-subscribers
    get a capped, most-recent-first preview instead of the full set."""
    serializer_class = JobPostingSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = JobPostingPagination

    def get_queryset(self):
        user = self.request.user
        queryset = (
            JobPosting.objects.filter(status='published')
            .select_related('employer')
            .annotate(
                is_saved_annotated=Exists(SavedJob.objects.filter(user=user, job_posting_id=OuterRef('pk'))),
                has_applied_annotated=Exists(Application.objects.filter(candidate=user, job_posting_id=OuterRef('pk'))),
            )
            .order_by('-published_at')
        )
        queryset = _filter_published_jobs(queryset, self.request.query_params)
        if self.request.query_params.get('saved_only') == 'true':
            queryset = queryset.filter(saved_by__user=user)
        if not is_user_subscribed(user):
            return queryset[:FREE_PREVIEW_LIMIT]
        return queryset


_WORD_RE = re.compile(r"[a-z][a-z0-9+#.]{1,}")
_STOPWORDS = {
    'and', 'the', 'for', 'with', 'senior', 'junior', 'lead', 'staff', 'intern', 'sr', 'jr',
    'manager', 'engineer', 'associate', 'specialist', 'executive', 'officer', 'head', 'of',
}


def _words(text):
    return {w for w in _WORD_RE.findall((text or '').lower()) if w not in _STOPWORDS}


class SuggestedJobPostingsView(views.APIView):
    """GET /hiring/jobs/suggested/ — published employer postings the
    candidate hasn't applied to yet, ranked for them. Signals, cheapest
    first: categories they've applied to / saved (Kaamlee postings and
    tracked scraped jobs alike), their resume's role, and their resume
    skills. Falls back to the newest postings when there's nothing to go on.
    Each result carries a short match_reason for the card."""
    permission_classes = [permissions.IsAuthenticated]
    LIMIT = 5
    CANDIDATE_POOL = 500

    def get(self, request):
        user = request.user
        profile = getattr(user, 'profile', None)
        parsed = (profile.resume_parsed if profile else None) or {}

        categories = set(
            Application.objects.filter(candidate=user).values_list('job_posting__category', flat=True)
        ) | set(
            SavedJob.objects.filter(user=user).values_list('job_posting__category', flat=True)
        ) | set(
            Bookmark.objects.filter(user=user).values_list('job__category', flat=True)
        )
        categories = {c.lower() for c in categories if c and c.lower() != 'other'}

        role_words = _words(parsed.get('role'))
        for exp in (parsed.get('experience') or [])[:2]:
            if isinstance(exp, dict):
                role_words |= _words(exp.get('role'))
        skills = set()
        for group in parsed.get('skills') or []:
            if isinstance(group, dict):
                for item in group.get('items') or []:
                    if isinstance(item, str) and 1 < len(item) <= 30:
                        skills.add(item.strip().lower())

        pool = list(
            JobPosting.objects.filter(status='published')
            .exclude(applications__candidate=user)
            .select_related('employer')
            .annotate(
                is_saved_annotated=Exists(SavedJob.objects.filter(user=user, job_posting_id=OuterRef('pk'))),
                has_applied_annotated=Exists(Application.objects.filter(candidate=user, job_posting_id=OuterRef('pk'))),
            )
            .order_by('-published_at')[:self.CANDIDATE_POOL]
        )

        scored = []
        for job in pool:
            title_words = _words(job.title)
            haystack = f"{job.title} {job.description}".lower()
            score, reasons = 0, []
            if job.category and job.category.lower() in categories:
                score += 3
                reasons.append(f"You're into {job.category}")
            role_hits = role_words & title_words
            if role_hits:
                score += 2 * len(role_hits)
                reasons.append('Fits your role')
            skill_hits = [s for s in skills if s in haystack]
            if skill_hits:
                score += min(len(skill_hits), 4)
                reasons.append(f"Matches {', '.join(skill_hits[:2])}")
            scored.append((score, job, reasons))

        # Stable sort keeps newest-first within equal scores.
        scored.sort(key=lambda row: row[0], reverse=True)
        results = []
        for score, job, reasons in scored[:self.LIMIT]:
            data = JobPostingSerializer(job, context={'request': request}).data
            data['match_reason'] = reasons[0] if reasons else 'New on Kaamlee'
            data['match_score'] = score
            results.append(data)
        return Response({'results': results, 'personalized': any(row[0] > 0 for row in scored[:self.LIMIT])})


class PublicJobMapPinsView(views.APIView):
    """GET /hiring/jobs/public/map_pins/ — every matching posting with
    coordinates, unpaginated (the map needs the full set to draw clusters).
    Postings without lat/long are omitted — nothing to plot yet. Same
    free-preview cap as the list view for non-subscribers."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = (
            JobPosting.objects.filter(status='published', latitude__isnull=False, longitude__isnull=False)
            .select_related('employer')
            .order_by('-published_at')
        )
        queryset = _filter_published_jobs(queryset, request.query_params)
        if request.query_params.get('saved_only') == 'true':
            queryset = queryset.filter(saved_by__user=request.user)
        if not is_user_subscribed(request.user):
            queryset = queryset[:FREE_PREVIEW_LIMIT]
        rows = queryset.values(
            'id', 'title', 'latitude', 'longitude', 'city', 'state', 'country', 'is_remote',
            employer_name=F('employer__name'),
        )
        return Response(list(rows))


class PublicJobPostingDetailView(generics.RetrieveAPIView):
    """GET /hiring/jobs/public/<id>/ — fetching a specific known posting (e.g.
    to apply) is free regardless of subscription; only browsing volume is
    gated, same precedent as bookmarking in the old JobViewSet."""
    serializer_class = JobPostingSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = JobPosting.objects.filter(status='published').select_related('employer')


class PublicCountriesView(views.APIView):
    """Distinct countries derived from currently published postings."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        countries = list(
            JobPosting.objects.filter(status='published').exclude(country='')
            .values_list('country', flat=True).distinct().order_by('country')
        )
        return Response(countries)


class ApplyToJobView(views.APIView):
    """POST /hiring/jobs/<id>/apply/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        job = get_object_or_404(JobPosting, pk=pk, status='published')
        if Application.objects.filter(job_posting=job, candidate=request.user).exists():
            return Response({'error': 'You already applied to this job.'}, status=400)

        serializer = ApplicationCreateSerializer(
            data=request.data, context={'request': request, 'job_posting': job}
        )
        serializer.is_valid(raise_exception=True)
        application = serializer.save()
        return Response(ApplicationSerializer(application).data, status=201)


class MyApplicationsView(generics.ListAPIView):
    """GET /hiring/applications/mine/ — read-only, replaces the old
    Bookmark-based ApplicationsView."""
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Application.objects.filter(candidate=self.request.user)
            .select_related('job_posting', 'job_posting__employer')
            .prefetch_related('stage_changes')
            .order_by('-applied_at')
        )


class SavedJobView(views.APIView):
    """POST/DELETE /hiring/saved/<job_id>/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, job_id):
        job = get_object_or_404(JobPosting, pk=job_id, status='published')
        SavedJob.objects.get_or_create(user=request.user, job_posting=job)
        return Response(status=201)

    def delete(self, request, job_id):
        SavedJob.objects.filter(user=request.user, job_posting_id=job_id).delete()
        return Response(status=204)


class MySavedJobsView(generics.ListAPIView):
    """GET /hiring/saved/mine/"""
    serializer_class = SavedJobSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavedJob.objects.filter(user=self.request.user).select_related('job_posting', 'job_posting__employer').order_by('-created_at')


class JobApplicationKitView(views.APIView):
    """GET/POST /hiring/jobs/<id>/application-kit/ — fetch or (re)generate a
    cover letter + common application Q&A, tailored to the candidate's resume.
    Premium: same IsSubscribed gate the old JobApplicationKitView used."""
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def get(self, request, pk):
        kit = JobApplicationKit.objects.filter(user=request.user, job_posting_id=pk).first()
        if not kit:
            return Response({'error': 'Not found.'}, status=404)
        return Response(JobApplicationKitSerializer(kit).data)

    def post(self, request, pk):
        job = get_object_or_404(JobPosting, pk=pk, status='published')

        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.resume:
            return Response({'error': 'Upload a resume before generating a cover letter.'}, status=400)

        content = profile.resume_parsed
        if not content:
            return Response(
                {'error': "We couldn't read your resume. Try re uploading it, or try again in a bit."},
                status=502,
            )

        try:
            generated = generate_application_kit_with_groq(content, job.title, job.employer.name, job.description, profile)
        except GroqQuotaExceeded:
            return Response(
                {'error': "You've hit your daily AI usage limit. It resets 24 hours after your first use today.",
                 'groq_usage': usage_summary(profile)},
                status=429,
            )
        if not generated or not generated.get('cover_letter'):
            return Response({'error': 'Failed to generate. Please try again.', 'groq_usage': usage_summary(profile)}, status=502)

        kit, _ = JobApplicationKit.objects.update_or_create(
            user=request.user, job_posting=job,
            defaults={'cover_letter': generated.get('cover_letter', ''), 'qa': generated.get('qa', [])},
        )
        data = JobApplicationKitSerializer(kit).data
        data['groq_usage'] = usage_summary(profile)
        return Response(data)
