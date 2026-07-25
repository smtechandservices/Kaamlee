from django.urls import path
from .views import (
    InterviewSessionListCreateView,
    InterviewSessionDetailView,
    InterviewAnswerView,
    InterviewProctoringEventView,
    InterviewReportView,
)

urlpatterns = [
    path('sessions/', InterviewSessionListCreateView.as_view(), name='interview-sessions'),
    path('sessions/<int:session_id>/', InterviewSessionDetailView.as_view(), name='interview-session-detail'),
    path('sessions/<int:session_id>/answer/', InterviewAnswerView.as_view(), name='interview-answer'),
    path('sessions/<int:session_id>/proctoring-event/', InterviewProctoringEventView.as_view(), name='interview-proctoring-event'),
    path('sessions/<int:session_id>/report/', InterviewReportView.as_view(), name='interview-report'),
]
