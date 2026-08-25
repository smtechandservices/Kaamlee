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
