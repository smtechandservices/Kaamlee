from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Application, ApplicationEvent, ResumeVersion, ApplicationAnswer
from .serializers import (
    ApplicationSerializer, 
    ApplicationEventSerializer, 
    ResumeVersionSerializer, 
    ApplicationAnswerSerializer
)

class ApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Application.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def add_event(self, request, pk=None):
        application = self.get_object()
        serializer = ApplicationEventSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(application=application)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ResumeVersionViewSet(viewsets.ModelViewSet):
    serializer_class = ResumeVersionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ResumeVersion.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ApplicationAnswerViewSet(viewsets.ModelViewSet):
    serializer_class = ApplicationAnswerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ApplicationAnswer.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
