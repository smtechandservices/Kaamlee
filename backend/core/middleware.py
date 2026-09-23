"""Project middleware.

RequestLogMiddleware writes every API request (as a replayable curl command)
and its response to logs/requests.log — passwords, tokens, OTP codes and
auth headers redacted — for `./tail_logs.sh`. Streaming and binary
responses are noted but not dumped.
"""
import json
import logging
import re
import time

logger = logging.getLogger('request_log')

_REDACTED = '***REDACTED***'
_SENSITIVE_HEADERS = {'authorization', 'cookie'}
_SENSITIVE_BODY_KEYS = {
    'password', 'confirm_password', 'old_password', 'new_password', 'current_password',
    'token', 'access', 'refresh', 'key', 'razorpay_signature', 'razorpay_key_secret',
    'code', 'otp', 'credential',  # email OTP codes, Google ID tokens
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

    if request.META.get('CONTENT_TYPE', '').startswith('multipart/'):
        parts.append('-F <multipart form data — not logged>')
        return ' \\\n     '.join(parts)
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


class DisableGzipForStreamingMiddleware:
    """GZipMiddleware wraps a StreamingHttpResponse's generator in zlib
    compression, but zlib doesn't flush its internal buffer on small writes
    — so a live NDJSON log stream (short lines, seconds apart) ends up fully
    buffered until the response closes, defeating the whole point of
    streaming. Stripping Accept-Encoding for these paths before GZipMiddleware
    sees the request keeps it from wrapping the response at all.
    """
    STREAMING_PATHS = {'/api/admin/run-script/'}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path in self.STREAMING_PATHS:
            request.META.pop('HTTP_ACCEPT_ENCODING', None)
        return self.get_response(request)


class RequestLogMiddleware:
    # Hit every 1.5-3s by the admin dashboard's polling (Active Runs card,
    # in-flight run status) — logging every one of these, even tersely,
    # drowns out everything else in the request log within minutes. Successful
    # polls are skipped entirely; a failure still gets the full dump so it's
    # not silently lost.
    QUIET_PATHS = {
        '/api/admin/run-script/running/',
        '/api/admin/run-script/status/',
    }
    # Framework/static noise, never interesting in a request log.
    SKIP_PREFIXES = ('/static/', '/media/', '/favicon.ico')

    def __init__(self, get_response):
        self.get_response = get_response

    # Bodies up to this size are read before the view runs (DRF consumes the
    # stream, after which request.body can't be read). Uploads are skipped:
    # reading a multipart body here would hit DATA_UPLOAD_MAX_MEMORY_SIZE.
    MAX_LOGGED_BODY_BYTES = 256 * 1024

    def __call__(self, request):
        start = time.monotonic()
        content_type = request.META.get('CONTENT_TYPE', '')
        try:
            length = int(request.META.get('CONTENT_LENGTH') or 0)
        except ValueError:
            length = 0
        if 0 < length <= self.MAX_LOGGED_BODY_BYTES and not content_type.startswith('multipart/'):
            try:
                request.body  # cache it; the view then reads from the cached copy
            except Exception:
                pass
        response = self.get_response(request)
        duration_ms = int((time.monotonic() - start) * 1000)

        if request.path.startswith(self.SKIP_PREFIXES):
            return response
        if request.path in self.QUIET_PATHS and response.status_code < 400:
            return response

        ip = get_client_ip(request)
        user = request.user.username if hasattr(request, 'user') and request.user.is_authenticated else 'unknown'

        logger.info(
            '%s %s %s %s status=%d %dms\n%s\n-- response --\n%s\n%s',
            ip,
            user,
            request.method,
            request.get_full_path(),
            response.status_code,
            duration_ms,
            build_curl_command(request),
            build_response_body(response),
            '-' * 80,
            extra={'status_code': response.status_code},
        )

        return response
