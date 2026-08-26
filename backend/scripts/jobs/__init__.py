from datetime import timedelta

from django.db import connection
from django.utils import timezone

from api.models import Job
from .translate import translate_non_english_jobs

# A posting open this long is unlikely to still be worth surfacing, and
# without a cutoff the table only ever grows — see remove_old_jobs.
MAX_JOB_AGE_DAYS = 30

# Every Job field the per-ATS scripts populate on each posting, excluding
# id_from_site (the upsert conflict target) and fields Django manages itself
# (pk, created_at). Passed as bulk_create's update_fields so a re-sync
# overwrites exactly what update_or_create used to via its `defaults=` dict.
JOB_UPDATE_FIELDS = [
    'title', 'company', 'location_name', 'city', 'state', 'country',
    'is_remote', 'job_type', 'job_url', 'description', 'site',
    'company_logo', 'date_posted', 'salary', 'category',
]

# SQLite's SQLITE_MAX_VARIABLE_NUMBER can be as low as 999 on older builds —
# chunk the existence-check query defensively rather than assume a modern
# default, since a single board can have thousands of postings (Lever's own
# FETCH_LIMIT alone allows up to 10,000).
_EXISTENCE_CHECK_CHUNK = 500


def bulk_upsert_jobs(job_objs, update_fields=JOB_UPDATE_FIELDS):
    """Upsert a batch of unsaved Job(...) instances in as few write
    transactions as possible, instead of one update_or_create() per row —
    each of those was its own SQLite write-lock acquisition, so a board
    with a few thousand postings meant a few thousand separate lock
    acquisitions competing with anything else touching the same file (the
    dev server, another board's sync, a concurrent scrape). bulk_create
    still issues multiple INSERT statements under the hood for very large
    batches, but wraps them all in a single transaction.

    Returns (created_count, updated_count) — computed from one extra
    SELECT (chunked the same way) so callers keep the same stats they'd
    have gotten from update_or_create's per-row return value.
    """
    if not job_objs:
        return 0, 0

    # A source occasionally repeats the same id_from_site within one fetch
    # (e.g. a duplicate listing) — a single INSERT ... ON CONFLICT DO UPDATE
    # errors if it would touch the same row twice, so keep only the last
    # occurrence, same as what a run of update_or_create() calls would have
    # left behind anyway.
    deduped = list({obj.id_from_site: obj for obj in job_objs}.values())

    # Translate non-English postings (e.g. a company's China/Japan-office
    # listings) to English before they ever hit the DB, so every future
    # scrape stays normalized instead of needing a manual backfill.
    if 'title' in update_fields or 'description' in update_fields:
        translate_non_english_jobs(deduped)

    ids = [obj.id_from_site for obj in deduped]
    existing = set()
    for i in range(0, len(ids), _EXISTENCE_CHECK_CHUNK):
        existing.update(
            Job.objects.filter(id_from_site__in=ids[i:i + _EXISTENCE_CHECK_CHUNK])
            .values_list('id_from_site', flat=True)
        )

    Job.objects.bulk_create(
        deduped, update_conflicts=True, unique_fields=['id_from_site'], update_fields=update_fields,
    )

    updated = len(existing)
    created = len(deduped) - updated
    return created, updated


def remove_stale_jobs(prefix, fetched_ids):
    """Deletes every Job row whose id_from_site starts with `prefix` (e.g.
    "greenhouse:stripe:") but isn't in `fetched_ids` — i.e. postings that
    were synced from this board on a previous run but weren't returned at
    all this time (closed, removed, or — for Ashby — explicitly unlisted).

    Without this, a closed posting scraped once stays visible forever: the
    "no coordinates" cleanup each script also runs only catches
    freshly-fetched postings that couldn't be geocoded, never ones that
    simply disappeared from the source. Callers should skip calling this
    on a run that was stopped early or came back with zero postings —
    either way there's no trustworthy full picture of what's currently
    listed, and deleting on an incomplete view would wipe out live postings
    rather than stale ones.

    Returns the number of rows deleted. Chunked the same way as
    bulk_upsert_jobs's existence check — SQLite's SQLITE_MAX_VARIABLE_NUMBER
    can be as low as 999, and a big board can have thousands of postings.
    """
    existing_ids = set(
        Job.objects.filter(id_from_site__startswith=prefix).values_list('id_from_site', flat=True)
    )
    stale_ids = list(existing_ids - fetched_ids)
    removed = 0
    for i in range(0, len(stale_ids), _EXISTENCE_CHECK_CHUNK):
        removed += Job.objects.filter(id_from_site__in=stale_ids[i:i + _EXISTENCE_CHECK_CHUNK]).delete()[0]
    return removed


def remove_old_jobs(prefix, max_age_days=MAX_JOB_AGE_DAYS):
    """Deletes every Job row whose id_from_site starts with `prefix` and
    whose date_posted is more than `max_age_days` old — independent of
    whether the posting is still listed on the source. remove_stale_jobs
    only catches postings that vanished from the source entirely; this
    catches postings the source is still happily serving but that are
    simply old, which would otherwise stick around forever since nothing
    else ever revisits a job once it's been synced.

    Jobs with no date_posted at all are left alone — there's no age to
    judge them by, and deleting on a missing field would be guessing.
    Safe to call regardless of whether this run's fetch was complete,
    partial, or empty: unlike remove_stale_jobs, this only looks at what's
    already saved, never at what this run did or didn't see.

    Returns the number of rows deleted.
    """
    cutoff = timezone.now().date() - timedelta(days=max_age_days)
    return Job.objects.filter(id_from_site__startswith=prefix, date_posted__lt=cutoff).delete()[0]


def checkpoint_sqlite():
    """Truncate db.sqlite3-wal back to empty after a batch of writes.

    In WAL mode, sqlite only reclaims the -wal/-shm files on its own when
    the *last* open connection to the database closes — but the dev server
    holds a persistent connection (CONN_MAX_AGE), so that never happens
    while it's running and the -wal file just grows. Each script's
    run_many() calls this once its writes are done so a scrape run doesn't
    leave that file behind. No-op on Postgres.
    """
    if connection.vendor != 'sqlite':
        return
    with connection.cursor() as cursor:
        cursor.execute('PRAGMA wal_checkpoint(TRUNCATE);')
