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
from .models import JobPosting, Application, ApplicationStageChange, SavedJob, JobApplicationKit, APPLICATION_STAGE_CHOICES
from .feed import build_feed_page, preview_ids, FEED_PAGE_SIZE, MAX_FEED_PAGE_SIZE
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


class EmployerDashboardView(views.APIView):
    """GET /hiring/dashboard/ — everything the employer portal's dashboard
    shows, in one request: postings by status, the application pipeline by
    stage, this week vs last week, a per-posting breakdown, the latest
    applicants, and the team. Works before KYC approval too (it just has
    no postings to report yet)."""
    permission_classes = [IsEmployerMember]
    RECENT_APPLICATIONS = 8
    TOP_POSTINGS = 6

    def get(self, request):
        from employers.models import EmployerMember

        employer = request.user.employer_membership.employer
        now = timezone.now()
        week_ago = now - timezone.timedelta(days=7)
        two_weeks_ago = now - timezone.timedelta(days=14)

        postings = JobPosting.objects.filter(employer=employer)
        posting_counts = postings.aggregate(
            total=Count('id'),
            published=Count('id', filter=Q(status='published')),
            draft=Count('id', filter=Q(status='draft')),
            paused=Count('id', filter=Q(status='paused')),
            closed=Count('id', filter=Q(status='closed')),
        )

        applications = Application.objects.filter(job_posting__employer=employer)
        stage_counts = dict(applications.values_list('stage').annotate(n=Count('id')).values_list('stage', 'n'))
        pipeline = [{'stage': key, 'label': label, 'count': stage_counts.get(key, 0)} for key, label in APPLICATION_STAGE_CHOICES]
        application_counts = {
            'total': sum(stage_counts.values()),
            'this_week': applications.filter(applied_at__gte=week_ago).count(),
            'last_week': applications.filter(applied_at__gte=two_weeks_ago, applied_at__lt=week_ago).count(),
            'in_progress': sum(stage_counts.get(s, 0) for s in ('applied', 'screening', 'shortlisted', 'interview', 'offer')),
            'hired': stage_counts.get('hired', 0),
            'rejected': stage_counts.get('rejected', 0),
        }

        top_postings = (
            postings.annotate(
                applications_count=Count('applications'),
                new_this_week=Count('applications', filter=Q(applications__applied_at__gte=week_ago)),
                in_progress=Count('applications', filter=~Q(applications__stage__in=['hired', 'rejected'])),
                hired=Count('applications', filter=Q(applications__stage='hired')),
            )
            .order_by('-applications_count', '-created_at')[:self.TOP_POSTINGS]
        )

        recent = (
            applications.select_related('candidate', 'job_posting')
            .order_by('-applied_at')[:self.RECENT_APPLICATIONS]
        )

        members = EmployerMember.objects.filter(employer=employer).select_related('user').order_by('created_at')

        return Response({
            'kyc_approved': employer.kyc_status == 'approved',
            'postings': posting_counts,
            'applications': application_counts,
            'pipeline': pipeline,
            'top_postings': [{
                'id': p.id,
                'title': p.title,
                'status': p.status,
                'category': p.category,
                'employment_type': p.employment_type,
                'location': ', '.join(x for x in [p.city, p.state] if x) or ('Remote' if p.is_remote else ''),
                'is_remote': p.is_remote,
                'published_at': p.published_at,
                'created_at': p.created_at,
                'applications_count': p.applications_count,
                'new_this_week': p.new_this_week,
                'in_progress': p.in_progress,
                'hired': p.hired,
            } for p in top_postings],
            'recent_applications': [{
                'id': a.id,
                'candidate_name': f"{a.candidate.first_name} {a.candidate.last_name}".strip() or a.candidate.username,
                'candidate_username': a.candidate.username,
                'job_posting_id': a.job_posting_id,
                'job_posting_title': a.job_posting.title,
                'stage': a.stage,
                'applied_at': a.applied_at,
            } for a in recent],
            'team': {
                'total': members.count(),
                'members': [{
                    'id': m.id,
                    'name': f"{m.user.first_name} {m.user.last_name}".strip() or m.user.username,
                    'username': m.user.username,
                    'email': m.user.email,
                    'role': m.role,
                    'is_you': m.user_id == request.user.id,
                } for m in members[:8]],
            },
        })


class EmployerJobPostingOverviewView(views.APIView):
    """GET /hiring/jobs/overview/ — every posting of the caller's employer
    with its applicant numbers and latest applicants, for the Job Postings
    page's card grid. Unpaginated: an employer's own postings are few."""
    permission_classes = [IsEmployerMember, IsApprovedEmployer]
    RECENT_PER_POSTING = 5

    def get(self, request):
        employer = request.user.employer_membership.employer
        week_ago = timezone.now() - timezone.timedelta(days=7)
        postings = list(
            JobPosting.objects.filter(employer=employer)
            .annotate(
                applications_count=Count('applications'),
                new_this_week=Count('applications', filter=Q(applications__applied_at__gte=week_ago)),
                in_progress=Count('applications', filter=~Q(applications__stage__in=['hired', 'rejected'])),
                hired=Count('applications', filter=Q(applications__stage='hired')),
            )
            .order_by('-created_at')
        )

        # Latest few applicants per posting, in one query.
        recent_by_posting = {}
        recent = (
            Application.objects.filter(job_posting__employer=employer)
            .select_related('candidate')
            .order_by('-applied_at')
        )
        for app in recent.iterator():
            bucket = recent_by_posting.setdefault(app.job_posting_id, [])
            if len(bucket) < self.RECENT_PER_POSTING:
                bucket.append({
                    'id': app.id,
                    'name': f"{app.candidate.first_name} {app.candidate.last_name}".strip() or app.candidate.username,
                    'stage': app.stage,
                    'applied_at': app.applied_at,
                })

        results = []
        for p in postings:
            data = JobPostingSerializer(p, context={'request': request}).data
            data.update({
                'applications_count': p.applications_count,
                'new_this_week': p.new_this_week,
                'in_progress': p.in_progress,
                'hired': p.hired,
                'recent_applicants': recent_by_posting.get(p.id, []),
            })
            results.append(data)
        return Response(results)


class EmployerJobPostingDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PATCH /hiring/jobs/<id>/ — employer-side edit, scoped to own employer account.
    DELETE — only for a posting nobody has applied to yet; one with
    applicants should be closed instead, so candidates keep their history."""
    serializer_class = JobPostingSerializer
    permission_classes = [IsEmployerMember, IsApprovedEmployer]

    def get_queryset(self):
        return JobPosting.objects.filter(employer=self.request.user.employer_membership.employer)

    def destroy(self, request, *args, **kwargs):
        job = self.get_object()
        if job.applications.exists():
            return Response(
                {'error': 'This posting has applicants, so it can\'t be deleted — close it instead.'},
                status=400,
            )
        job.delete()
        return Response(status=204)


class EmployerJobPostingDuplicateView(views.APIView):
    """POST /hiring/jobs/<id>/duplicate/ — copy a posting (same details,
    form and screening questions) as a new draft with no applicants."""
    permission_classes = [IsEmployerMember, IsApprovedEmployer]
    COPIED_FIELDS = [
        'title', 'description', 'employment_type', 'salary_min', 'salary_max', 'salary_currency',
        'city', 'state', 'country', 'latitude', 'longitude', 'is_remote', 'experience_level',
        'category', 'application_form_schema', 'screening_questions',
    ]

    def post(self, request, pk):
        membership = request.user.employer_membership
        source = get_object_or_404(JobPosting, pk=pk, employer=membership.employer)
        copy = JobPosting.objects.create(
            employer=membership.employer,
            created_by=membership,
            status='draft',
            **{field: getattr(source, field) for field in self.COPIED_FIELDS},
        )
        copy.title = f"{source.title} (copy)"[:255]
        copy.save(update_fields=['title'])
        return Response(JobPostingSerializer(copy, context={'request': request}).data, status=201)


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


class EmployerApplicantsPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


def _person_name(user):
    return f"{user.first_name} {user.last_name}".strip() or user.username


class EmployerApplicantsView(views.APIView):
    """GET /hiring/applicants/ — every application across the caller's
    employer's postings, for the portal's Applicants page.
    ?posting=<id>, ?stage=, ?search= (candidate name/username/email),
    ?applied_from=/?applied_to= (YYYY-MM-DD, inclusive), ?sort=newest|oldest|updated.
    Also returns per-stage counts for the current filters (ignoring
    ?stage= so the tabs stay meaningful) and the posting list for the
    filter dropdown."""
    permission_classes = [IsEmployerMember, IsApprovedEmployer]
    SORTS = {'newest': '-applied_at', 'oldest': 'applied_at', 'updated': '-stage_updated_at'}

    def get(self, request):
        employer = request.user.employer_membership.employer
        params = request.query_params
        queryset = (
            Application.objects.filter(job_posting__employer=employer)
            .select_related('candidate', 'candidate__profile', 'candidate__portfolio', 'cv', 'job_posting')
        )

        posting = params.get('posting')
        if posting:
            queryset = queryset.filter(job_posting_id=posting)
        search = (params.get('search') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(candidate__first_name__icontains=search) | Q(candidate__last_name__icontains=search)
                | Q(candidate__username__icontains=search) | Q(candidate__email__icontains=search)
            )
        if params.get('applied_from'):
            queryset = queryset.filter(applied_at__date__gte=params['applied_from'])
        if params.get('applied_to'):
            queryset = queryset.filter(applied_at__date__lte=params['applied_to'])

        stage_counts = dict(queryset.values_list('stage').annotate(n=Count('id')).values_list('stage', 'n'))

        stage = params.get('stage')
        if stage:
            queryset = queryset.filter(stage=stage)
        queryset = queryset.order_by(self.SORTS.get(params.get('sort'), '-applied_at'))

        paginator = EmployerApplicantsPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        results = []
        for app in page:
            data = ApplicationKanbanSerializer(app).data
            data.update({
                'candidate_name': _person_name(app.candidate),
                'job_posting_title': app.job_posting.title,
                'job_posting_status': app.job_posting.status,
                # So screening answers can be shown with their question text.
                'screening_questions': app.job_posting.screening_questions,
            })
            results.append(data)
        response = paginator.get_paginated_response(results)
        response.data['stage_counts'] = {key: stage_counts.get(key, 0) for key, _ in APPLICATION_STAGE_CHOICES}
        response.data['postings'] = list(
            JobPosting.objects.filter(employer=employer).order_by('-created_at').values('id', 'title', 'status')
        )
        return response


class EmployerApplicantsBulkStageView(views.APIView):
    """POST /hiring/applicants/bulk-stage/ {"ids": [...], "to_stage": "...", "note": "..."}
    — move many applications at once. Same rules as a single move:
    rejecting needs a note (the candidate sees it), and each move is
    recorded as an ApplicationStageChange by the caller."""
    permission_classes = [IsEmployerMember, IsApprovedEmployer]

    def post(self, request):
        membership = request.user.employer_membership
        ids = request.data.get('ids')
        if not isinstance(ids, list) or not ids:
            return Response({'error': 'ids must be a non-empty list.'}, status=400)
        serializer = StageChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        to_stage = serializer.validated_data['to_stage']
        note = serializer.validated_data.get('note', '')

        moved = 0
        applications = Application.objects.filter(id__in=ids, job_posting__employer=membership.employer).exclude(stage=to_stage)
        for application in applications:
            from_stage = application.stage
            application.stage = to_stage
            application.save(update_fields=['stage', 'stage_updated_at'])
            ApplicationStageChange.objects.create(
                application=application, from_stage=from_stage, to_stage=to_stage,
                changed_by=membership, note=note,
            )
            moved += 1
        return Response({'moved': moved})


class EmployerActivityView(views.APIView):
    """GET /hiring/activity/ — the employer's activity timeline, newest
    first, merged from: stage changes (with who made them), new
    applications, postings created and published, and teammates joining.
    ?type=stage_change|applied|posting_created|posting_published|member_joined,
    ?member=<EmployerMember id> (only that teammate's actions), ?page=."""
    permission_classes = [IsEmployerMember]
    PAGE_SIZE = 30
    TYPES = ('stage_change', 'applied', 'posting_created', 'posting_published', 'member_joined')

    def get(self, request):
        from employers.models import EmployerMember

        employer = request.user.employer_membership.employer
        try:
            page = max(int(request.query_params.get('page', 1)), 1)
        except ValueError:
            page = 1
        wanted = request.query_params.get('type')
        types = [wanted] if wanted in self.TYPES else list(self.TYPES)
        member_id = request.query_params.get('member')
        if member_id:
            # Only events a teammate performs themselves.
            types = [t for t in types if t in ('stage_change', 'posting_created', 'member_joined')]

        # Enough of each source to fill this page after merging.
        take = page * self.PAGE_SIZE
        events, total = [], 0

        def member_name(member):
            return _person_name(member.user) if member else 'A former teammate'

        if 'stage_change' in types:
            qs = ApplicationStageChange.objects.filter(application__job_posting__employer=employer)
            if member_id:
                qs = qs.filter(changed_by_id=member_id)
            total += qs.count()
            for c in qs.select_related('changed_by__user', 'application__candidate', 'application__job_posting').order_by('-created_at')[:take]:
                events.append({
                    'type': 'stage_change', 'at': c.created_at,
                    'actor': member_name(c.changed_by),
                    'candidate': _person_name(c.application.candidate),
                    'posting_id': c.application.job_posting_id,
                    'posting_title': c.application.job_posting.title,
                    'from_stage': c.from_stage, 'to_stage': c.to_stage, 'note': c.note,
                })
        if 'applied' in types:
            qs = Application.objects.filter(job_posting__employer=employer)
            total += qs.count()
            for a in qs.select_related('candidate', 'job_posting').order_by('-applied_at')[:take]:
                events.append({
                    'type': 'applied', 'at': a.applied_at,
                    'actor': _person_name(a.candidate),
                    'candidate': _person_name(a.candidate),
                    'posting_id': a.job_posting_id, 'posting_title': a.job_posting.title,
                })
        if 'posting_created' in types:
            qs = JobPosting.objects.filter(employer=employer)
            if member_id:
                qs = qs.filter(created_by_id=member_id)
            total += qs.count()
            for p in qs.select_related('created_by__user').order_by('-created_at')[:take]:
                events.append({
                    'type': 'posting_created', 'at': p.created_at,
                    'actor': member_name(p.created_by) if p.created_by_id else 'Kaamlee team',
                    'posting_id': p.id, 'posting_title': p.title,
                })
        if 'posting_published' in types:
            qs = JobPosting.objects.filter(employer=employer, published_at__isnull=False)
            total += qs.count()
            for p in qs.order_by('-published_at')[:take]:
                events.append({
                    'type': 'posting_published', 'at': p.published_at,
                    'actor': None, 'posting_id': p.id, 'posting_title': p.title,
                })
        if 'member_joined' in types:
            qs = EmployerMember.objects.filter(employer=employer)
            if member_id:
                qs = qs.filter(id=member_id)
            total += qs.count()
            for m in qs.select_related('user').order_by('-created_at')[:take]:
                events.append({
                    'type': 'member_joined', 'at': m.created_at,
                    'actor': _person_name(m.user), 'role': m.role,
                })

        events.sort(key=lambda e: e['at'], reverse=True)
        start = (page - 1) * self.PAGE_SIZE
        members = [
            {'id': m.id, 'name': _person_name(m.user), 'role': m.role}
            for m in EmployerMember.objects.filter(employer=employer).select_related('user').order_by('created_at')
        ]
        return Response({
            'count': total,
            'page': page,
            'has_more': start + self.PAGE_SIZE < total,
            'results': events[start:start + self.PAGE_SIZE],
            'members': members,
        })


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
    elif is_remote == 'false':
        queryset = queryset.filter(is_remote=False)

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
            # Only the postings inside the shared 200-job free preview
            # (see hiring.feed.preview_ids).
            posting_ids, _ = preview_ids(self.request)
            return queryset.filter(id__in=posting_ids)
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

        pool = (
            JobPosting.objects.filter(status='published')
            .exclude(applications__candidate=user)
            .select_related('employer')
            .annotate(
                is_saved_annotated=Exists(SavedJob.objects.filter(user=user, job_posting_id=OuterRef('pk'))),
                has_applied_annotated=Exists(Application.objects.filter(candidate=user, job_posting_id=OuterRef('pk'))),
            )
            .order_by('-published_at')
        )
        # Non-subscribers only suggest from the postings inside their shared
        # 200-job preview (hiring.feed.preview_ids).
        if is_user_subscribed(user):
            pool = pool[:self.CANDIDATE_POOL]
        else:
            pool = pool.filter(id__in=preview_ids(request)[0])

        scored = []
        for job in list(pool):
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


class CombinedJobFeedView(views.APIView):
    """GET /hiring/feed/?page=&page_size= — scraped jobs and employer postings mixed
    into one list, 20 per page by default (max 50), with Explore's filters (search, location,
    country, category, is_remote, bookmarked_only). Each item is
    {kind: 'job'|'posting', data}. Non-subscribers get the shared 200-job
    preview; see hiring.feed for how the two kinds are merged."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            page = max(int(request.query_params.get('page', 1)), 1)
        except ValueError:
            page = 1
        try:
            page_size = min(max(int(request.query_params.get('page_size', FEED_PAGE_SIZE)), 1), MAX_FEED_PAGE_SIZE)
        except ValueError:
            page_size = FEED_PAGE_SIZE
        total, results = build_feed_page(request, page, page_size)
        return Response({
            'count': total,
            'page_size': page_size,
            'subscribed': is_user_subscribed(request.user),
            'results': results,
        })


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
            posting_ids, _ = preview_ids(request)
            queryset = queryset.filter(id__in=posting_ids)
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
