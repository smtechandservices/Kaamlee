from django.db import connection

from api.models import Job

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
