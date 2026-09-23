"""Combined candidate job feed — scraped Jobs and employer JobPostings in
one shuffled list, plus the shared non-subscriber preview both map-pin
endpoints use, so the list and the map always agree on which 200 jobs a
free user can see.

Non-subscribers: one fixed pool of FREE_PREVIEW_TOTAL items across both
kinds — random postings (at most MAX_PREVIEW_POSTINGS), topped up with
random scraped jobs, picked per user per day before any filter — shuffled
together.
Filters (category, search, …) only narrow within that pool, so 200 is the
most a free user can ever see in total, not per filter.

Subscribers: every matching job of both kinds. Scraped jobs keep the
SQL-side shuffle JobViewSet already uses; postings are dropped into
random positions among them, so the merged order still pages cheaply
(only the page's slice of scraped jobs is ever fetched).
"""
import bisect
import random

from django.core.cache import cache
from django.db.models import Exists, OuterRef
from django.utils import timezone

from api.models import Job, Bookmark
from api.permissions import is_user_subscribed
from api.serializers import JobSerializer
from .models import JobPosting, Application, SavedJob
from .serializers import JobPostingSerializer

FREE_PREVIEW_TOTAL = 200
# Postings are a much smaller pool than scraped jobs, but capping them at
# half keeps the free preview a genuine mix as employer postings grow.
MAX_PREVIEW_POSTINGS = 100
FEED_PAGE_SIZE = 20
MAX_FEED_PAGE_SIZE = 50


def _job_viewset(request):
    # Reuse JobViewSet's filter/shuffle logic rather than duplicating it.
    # Imported lazily: api.views imports this module for map_pins.
    from api.views import JobViewSet
    viewset = JobViewSet()
    viewset.request = request
    viewset.format_kwarg = None
    return viewset


def _bookmarked_param(request):
    """True = bookmarked only, False = not bookmarked, None = either.
    ?bookmarked=true|false, with Explore's older ?bookmarked_only=true /
    ?saved_only=true still meaning "bookmarked only"."""
    params = request.query_params
    value = params.get('bookmarked')
    if value == 'true' or params.get('bookmarked_only') == 'true' or params.get('saved_only') == 'true':
        return True
    if value == 'false':
        return False
    return None


def scraped_queryset(request):
    user = request.user
    queryset = Job.objects.annotate(
        is_bookmarked=Exists(Bookmark.objects.filter(user=user, job_id=OuterRef('pk'))),
    )
    queryset = _job_viewset(request)._filter_queryset(queryset)
    bookmarked = _bookmarked_param(request)
    if bookmarked is True:
        queryset = queryset.filter(is_bookmarked=True)
    elif bookmarked is False:
        queryset = queryset.filter(is_bookmarked=False)
    return queryset


def postings_queryset(request):
    from .views import _filter_published_jobs  # views imports this module
    user = request.user
    queryset = (
        JobPosting.objects.filter(status='published')
        .select_related('employer')
        .annotate(
            is_saved_annotated=Exists(SavedJob.objects.filter(user=user, job_posting_id=OuterRef('pk'))),
            has_applied_annotated=Exists(Application.objects.filter(candidate=user, job_posting_id=OuterRef('pk'))),
        )
    )
    queryset = _filter_published_jobs(queryset, request.query_params)
    # One bookmark filter covers both kinds — postings save via SavedJob.
    bookmarked = _bookmarked_param(request)
    if bookmarked is True:
        queryset = queryset.filter(is_saved_annotated=True)
    elif bookmarked is False:
        queryset = queryset.filter(is_saved_annotated=False)
    return queryset


def _preview_pool(user):
    """The fixed 200 a non-subscriber may see, chosen at random with no
    filters applied: up to MAX_PREVIEW_POSTINGS random published postings,
    topped up with random scraped jobs. Seeded per user per day and cached
    for that day, so it's stable while they page and the list and map
    agree, but refreshing doesn't hand out a new 200 — it rotates daily.
    Filters then only narrow within this pool; otherwise every
    category/search/country would hand out a fresh 200."""
    day = timezone.localdate().isoformat()
    cache_key = f"free_preview_pool:{user.id}:{day}"
    pool = cache.get(cache_key)
    if pool is not None:
        return pool

    rng = random.Random(f"{day}:{user.id}")
    all_postings = sorted(JobPosting.objects.filter(status='published').values_list('id', flat=True))
    posting_ids = rng.sample(all_postings, min(len(all_postings), MAX_PREVIEW_POSTINGS))
    # ~20k ints — cheap enough, and only once per user per day thanks to the cache.
    all_scraped = sorted(Job.objects.values_list('id', flat=True))
    scraped_ids = rng.sample(all_scraped, min(len(all_scraped), FREE_PREVIEW_TOTAL - len(posting_ids)))

    pool = (posting_ids, scraped_ids)
    cache.set(cache_key, pool, 60 * 60 * 24)
    return pool


def preview_ids(request):
    """(posting_ids, scraped_ids) a non-subscriber may see for the current
    filters: the user's fixed random preview pool, narrowed by the
    request's filters, newest first within each kind (the feed shuffles
    them together anyway). The single source of truth for the free
    preview — the feed, both map-pin endpoints, the postings list and the
    suggestions all use it."""
    pool_postings, pool_scraped = _preview_pool(request.user)
    posting_ids = list(
        postings_queryset(request).filter(id__in=pool_postings)
        .order_by('-published_at').values_list('id', flat=True)
    )
    scraped_ids = list(
        scraped_queryset(request).filter(id__in=pool_scraped)
        .order_by('-created_at').values_list('id', flat=True)
    )
    return posting_ids, scraped_ids


def _seed(request):
    # Same rotation window as JobViewSet's shuffle, and per user, so paging
    # is stable for a couple of minutes without everyone seeing one order.
    from api.views import _JOBS_CACHE_TTL
    bucket = int(timezone.now().timestamp() // _JOBS_CACHE_TTL)
    return f"{bucket}:{request.user.id}"


def _serialize(request, kind, obj):
    if kind == 'posting':
        return {'kind': 'posting', 'data': JobPostingSerializer(obj, context={'request': request}).data}
    return {'kind': 'job', 'data': JobSerializer(obj, context={'request': request}).data}


def build_feed_page(request, page, page_size=FEED_PAGE_SIZE):
    """Returns (total_count, [ {kind, data}, ... ]) for one page."""
    rng = random.Random(_seed(request))
    start = (page - 1) * page_size

    if not is_user_subscribed(request.user):
        posting_ids, scraped_ids = preview_ids(request)
        items = [('posting', pk) for pk in posting_ids] + [('job', pk) for pk in scraped_ids]
        rng.shuffle(items)
        window = items[start:start + page_size]
        postings = postings_queryset(request).in_bulk([pk for kind, pk in window if kind == 'posting'])
        jobs = scraped_queryset(request).in_bulk([pk for kind, pk in window if kind == 'job'])
        page_items = []
        for kind, pk in window:
            obj = (postings if kind == 'posting' else jobs).get(pk)
            if obj is not None:
                page_items.append(_serialize(request, kind, obj))
        return len(items), page_items

    scraped = _job_viewset(request)._shuffle(scraped_queryset(request))
    posting_ids = list(postings_queryset(request).values_list('id', flat=True))
    scraped_total = scraped.count()
    total = scraped_total + len(posting_ids)

    rng.shuffle(posting_ids)
    # Sorted random slots for the postings within the merged sequence.
    posting_slots = sorted(rng.sample(range(total), len(posting_ids))) if total else []

    end = min(start + page_size, total)
    if start >= end:
        return total, []
    # Scraped items in [start, end) are contiguous in the scraped order:
    # index = position minus the postings slotted before it.
    first_scraped = start - bisect.bisect_left(posting_slots, start)
    last_scraped = end - bisect.bisect_left(posting_slots, end)
    scraped_page = list(scraped[first_scraped:last_scraped])

    slot_start = bisect.bisect_left(posting_slots, start)
    slot_end = bisect.bisect_left(posting_slots, end)
    page_posting_ids = posting_ids[slot_start:slot_end]
    postings = postings_queryset(request).in_bulk(page_posting_ids)

    page_items, scraped_iter, posting_iter = [], iter(scraped_page), iter(page_posting_ids)
    slots_in_page = set(posting_slots[slot_start:slot_end])
    for position in range(start, end):
        if position in slots_in_page:
            obj = postings.get(next(posting_iter))
            if obj is not None:
                page_items.append(_serialize(request, 'posting', obj))
        else:
            obj = next(scraped_iter, None)
            if obj is not None:
                page_items.append(_serialize(request, 'job', obj))
    return total, page_items
