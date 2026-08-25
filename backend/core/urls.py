"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve
from django.conf import settings
from django.views.decorators.clickjacking import xframe_options_exempt

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('payments/', include('payments.urls')),
    path('ambassador/', include('ambassador.urls')),
    path('events/', include('events.urls')),
    # Serve user-uploaded media directly from Django. The deployment's nginx
    # has no location block for MEDIA_ROOT, so without this every /media/
    # request 404s at the app level regardless of DEBUG.
    # xframe_options_exempt: the profile page previews resumes in an <iframe>
    # from a different origin (frontend domain vs api.* backend domain) —
    # Django's default X-Frame-Options: DENY blocks that entirely, which
    # browsers surface as a bare "refused to connect" inside the frame.
    re_path(r'^media/(?P<path>.*)$', xframe_options_exempt(serve), {'document_root': settings.MEDIA_ROOT}),
]

