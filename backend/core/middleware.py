import logging
import time

logger = logging.getLogger('request_log')


def get_client_ip(request):
    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '-')


class RequestLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        response = self.get_response(request)
        duration_ms = int((time.monotonic() - start) * 1000)

        ip = get_client_ip(request)
        user = request.user.username if hasattr(request, 'user') and request.user.is_authenticated else 'anon'

        logger.info(
            '%s %s %s %s %dms',
            ip,
            user,
            request.method,
            request.get_full_path(),
            duration_ms,
            extra={'status_code': response.status_code},
        )

        return response
