from django.urls import path
from .views import TailorResumeView, AnswerQuestionsView

urlpatterns = [
    path('tailor/', TailorResumeView.as_view(), name='tailor-resume'),
    path('answer-questions/', AnswerQuestionsView.as_view(), name='answer-questions'),
]
