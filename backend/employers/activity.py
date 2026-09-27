"""Recording employer changes into EmployerActivityLog.

Call snapshot() before a change and diff() after it to get {field: [old, new]}
for just the fields that changed, then record() it. Recording never raises —
a logging problem must not break the edit it's describing.
"""
import logging

from django.db.models.fields.files import FieldFile

from .models import EmployerActivityLog

logger = logging.getLogger(__name__)

MAX_VALUE_CHARS = 2000  # long text (descriptions) is trimmed in the log


def person_name(user):
    if not user:
        return ''
    return f"{user.first_name} {user.last_name}".strip() or user.username


def _plain(value):
    """JSON-safe, readable form of a field value for the log."""
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, FieldFile):  # File/ImageField — just the stored name ('' when empty)
        return value.name or None
    text = str(value)
    return text if len(text) <= MAX_VALUE_CHARS else text[:MAX_VALUE_CHARS] + '…'


def snapshot(instance, fields):
    # Taken before an edit is saved, so it must never be what breaks the edit.
    values = {}
    for f in fields:
        try:
            values[f] = _plain(getattr(instance, f, None))
        except Exception:
            logger.exception('Could not snapshot %s.%s for the activity log', type(instance).__name__, f)
            values[f] = None
    return values


def diff(before, instance, fields):
    """{field: [old, new]} for the fields whose value changed."""
    after = snapshot(instance, fields)
    return {f: [before.get(f), after[f]] for f in fields if before.get(f) != after[f]}


def record(action, *, employer, actor=None, target_type='', target_id=None, target_label='', changes=None,
           employer_name=None):
    try:
        EmployerActivityLog.objects.create(
            employer=employer,
            employer_name=employer_name or (employer.name if employer else ''),
            actor=actor if actor and actor.pk else None,
            actor_name=person_name(actor),
            actor_is_admin=bool(actor and (actor.is_staff or actor.is_superuser)),
            action=action,
            target_type=target_type,
            target_id=target_id,
            target_label=(target_label or '')[:255],
            changes=changes or {},
        )
    except Exception:
        logger.exception('Could not record employer activity %s', action)
