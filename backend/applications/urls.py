from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ApplicationViewSet, ResumeVersionViewSet, ApplicationAnswerViewSet

router = DefaultRouter()
router.register(r'applications', ApplicationViewSet, basename='application')
router.register(r'resumes', ResumeVersionViewSet, basename='resume-version')
router.register(r'answers', ApplicationAnswerViewSet, basename='application-answer')

urlpatterns = [
    path('', include(router.urls)),
]
