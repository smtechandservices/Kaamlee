from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .services import AIApplyService

class TailorResumeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        job_id = request.data.get('job_id')
        if not job_id:
            return Response({'error': 'job_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Placeholder for AI tailoring logic
        service = AIApplyService(request.user)
        result = service.tailor_resume(job_id)
        
        return Response(result)

class AnswerQuestionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        questions = request.data.get('questions', [])
        job_id = request.data.get('job_id')
        
        if not questions:
            return Response({'error': 'questions list is required'}, status=status.HTTP_400_BAD_REQUEST)

        service = AIApplyService(request.user)
        answers = service.generate_answers(questions, job_id)
        
        return Response({'answers': answers})
