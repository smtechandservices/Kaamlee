import json
import logging
import re
import time

logger = logging.getLogger('request_log')

_REDACTED = '***REDACTED***'
_SENSITIVE_HEADERS = {'authorization', 'cookie'}
_SENSITIVE_BODY_KEYS = {
    'password', 'confirm_password', 'old_password', 'new_password',
    'token', 'access', 'refresh', 'razorpay_signature', 'razorpay_key_secret',
}
# Fallback for non-JSON bodies (form-encoded, etc.) — redacts key=value or "key":"value" pairs.
_SENSITIVE_BODY_RE = re.compile(
    r'(["\']?(?:' + '|'.join(_SENSITIVE_BODY_KEYS) + r')["\']?\s*[:=]\s*["\']?)[^"\'&\s]*',
    re.IGNORECASE,
)


def _redact_json(value):
    if isinstance(value, dict):
        return {
            k: (_REDACTED if k.lower() in _SENSITIVE_BODY_KEYS else _redact_json(v))
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_redact_json(v) for v in value]
    return value


def redact_body_text(text):
    """Best-effort redaction of sensitive fields (passwords, tokens) in a raw
    request/response body string before it's written to the log file."""
    try:
        return json.dumps(_redact_json(json.loads(text)), ensure_ascii=False)
    except ValueError:
        return _SENSITIVE_BODY_RE.sub(r'\1' + _REDACTED, text)


class DefaultStatusCodeFilter(logging.Filter):
    """django.request log records (e.g. unhandled exceptions) don't go through
    RequestLogMiddleware, so they never get a status_code — give them a placeholder
    so the shared formatter can reference {status_code} unconditionally."""
    def filter(self, record):
        if not hasattr(record, 'status_code'):
            record.status_code = '-'
        return True


def get_client_ip(request):
    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '-')


def build_curl_command(request):
    """Reconstruct the equivalent curl command for a request, for log readability."""
    parts = [f"curl -X {request.method} '{request.build_absolute_uri()}'"]

    for key, value in request.META.items():
        if key.startswith('HTTP_') and key != 'HTTP_COOKIE':
            header_name = key[5:].replace('_', '-').title()
            if header_name.lower() in _SENSITIVE_HEADERS:
                value = _REDACTED
            parts.append(f"-H '{header_name}: {value}'")
    content_type = request.META.get('CONTENT_TYPE')
    if content_type:
        parts.append(f"-H 'Content-Type: {content_type}'")

    try:
        body = request.body
    except Exception:
        body = None
    if body:
        try:
            parts.append(f"-d '{redact_body_text(body.decode('utf-8'))}'")
        except UnicodeDecodeError:
            parts.append('-d <binary data>')

    return ' \\\n     '.join(parts)


def build_response_body(response, max_chars=4000):
    """Best-effort text dump of a response body, for log readability."""
    if getattr(response, 'streaming', False):
        return '<streaming response — body not logged>'

    content_type = response.get('Content-Type', '')
    if not any(t in content_type for t in ('json', 'text', 'xml')):
        return f"<{content_type or 'binary'} response, {len(response.content)} bytes — body not logged>"

    try:
        body = response.content.decode('utf-8')
    except UnicodeDecodeError:
        return '<non-utf8 response body>'

    body = redact_body_text(body)

    if 'json' in content_type:
        try:
            body = json.dumps(json.loads(body), indent=2, ensure_ascii=False)
        except ValueError:
            pass

    if len(body) > max_chars:
        return f'{body[:max_chars]}\n... [truncated, {len(body)} chars total]'
    return body


class RequestLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        response = self.get_response(request)
        duration_ms = int((time.monotonic() - start) * 1000)

        ip = get_client_ip(request)
        user = request.user.username if hasattr(request, 'user') and request.user.is_authenticated else 'unknown'

        logger.info(
            '%s %s %s %s %dms\n%s\n-- response --\n%s\n%s',
            ip,
            user,
            request.method,
            request.get_full_path(),
            duration_ms,
            build_curl_command(request),
            build_response_body(response),
            '-' * 80,
            extra={'status_code': response.status_code},
        )

        return response
