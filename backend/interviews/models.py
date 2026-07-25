from django.db import models
from django.contrib.auth.models import User
from .constants import ROUND_CONFIG


class InterviewSession(models.Model):
    ROUND_CHOICES = [(r["round"], r["label"]) for r in ROUND_CONFIG]
    STATUS_CHOICES = (
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('abandoned', 'Abandoned'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='interview_sessions')
    target_role = models.CharField(max_length=200, blank=True, default='Software Engineer')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_progress')
    round_plan = models.JSONField(default=list)
    current_round_index = models.IntegerField(default=0)
    current_question_index = models.IntegerField(default=0)
    proctoring_flags = models.JSONField(default=list, blank=True)
    final_report = models.JSONField(null=True, blank=True)
    overall_score = models.IntegerField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"InterviewSession {self.id} - {self.user.username} - {self.status}"

    @property
    def current_round(self):
        if 0 <= self.current_round_index < len(self.round_plan):
            return self.round_plan[self.current_round_index]['round']
        return None


class InterviewTurn(models.Model):
    QUESTION_TYPE_CHOICES = (
        ('mcq', 'Multiple Choice'),
        ('open', 'Open Ended'),
    )

    session = models.ForeignKey(InterviewSession, on_delete=models.CASCADE, related_name='turns')
    round = models.CharField(max_length=20, choices=InterviewSession.ROUND_CHOICES)
    index_in_round = models.IntegerField()
    question = models.TextField()
    question_type = models.CharField(max_length=10, choices=QUESTION_TYPE_CHOICES)
    options = models.JSONField(null=True, blank=True)
    correct_index = models.IntegerField(null=True, blank=True)
    meta = models.JSONField(null=True, blank=True)  # round-specific extra data, e.g. the coding problem dict
    user_answer = models.TextField(blank=True, default='')
    is_correct = models.BooleanField(null=True)
    ai_score = models.IntegerField(null=True, blank=True)
    ai_feedback = models.TextField(blank=True, default='')
    answered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Turn {self.id} ({self.round} #{self.index_in_round}) - session {self.session_id}"
