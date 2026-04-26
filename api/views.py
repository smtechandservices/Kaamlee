from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from django.conf import settings
import os
import json
try:
    import PyPDF2
except ImportError:
    pass

from .models import User, Job, SearchQuery, Resume, ATSUsage
from .serializers import UserSerializer, JobSerializer, ResumeSerializer

# --- Auth & Users ---
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserSerializer

class ContactHRView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        message = request.data.get('message', '')
        if not message:
            return Response({"error": "Message is required."}, status=status.HTTP_400_BAD_REQUEST)
        hr_email = getattr(settings, 'HR_EMAIL', 'hr@kaamlee.com')
        try:
            send_mail(
                subject=f"New Candidate Inquiry: {user.first_name} {user.last_name}",
                message=f"Candidate Email: {user.email}\n\nMessage:\n{message}",
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@kaamlee.com'),
                recipient_list=[hr_email],
                fail_silently=False,
            )
            return Response({"message": "HR has been notified successfully."})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        bio = request.data.get('bio')
        if bio is not None:
            profile = request.user.profile
            profile.bio = bio
            profile.save()
        return Response(UserSerializer(request.user).data)

# --- Jobs ---
class JobSearchView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '').strip().lower()
        if not query:
            # If no query, return recent generic jobs
            jobs = Job.objects.filter(is_expired=False).order_by('-created_at')[:20]
            serializer = JobSerializer(jobs, many=True)
            return Response({"results": serializer.data, "count": jobs.count(), "scraping_triggered": False})

        jobs = Job.objects.filter(
            Q(title__icontains=query) | Q(company__icontains=query) | Q(description__icontains=query),
            is_expired=False
        ).order_by('-created_at')

        search_query, created = SearchQuery.objects.get_or_create(query=query)
        should_scrape = False
        if created or (timezone.now() - search_query.last_scraped_at) > timedelta(hours=24) or jobs.count() == 0:
            should_scrape = True

        if should_scrape:
            search_query.save()
            from .tasks import trigger_scrape_for_query
            trigger_scrape_for_query.delay(query)

        serializer = JobSerializer(jobs, many=True)
        return Response({"results": serializer.data, "count": jobs.count(), "scraping_triggered": should_scrape})

# --- Resumes & ATS ---
class ResumeUploadView(generics.CreateAPIView):
    queryset = Resume.objects.all()
    serializer_class = ResumeSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ATSCheckView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        usage, _ = ATSUsage.objects.get_or_create(user=user)
        if usage.free_checks_used >= 2:
            return Response({"error": "You have exhausted your 2 free ATS checks."}, status=status.HTTP_403_FORBIDDEN)

        resume = user.resumes.order_by('-uploaded_at').first()
        if not resume:
            return Response({"error": "No resume found. Please upload one first."}, status=status.HTTP_404_NOT_FOUND)

        job_description = request.data.get('job_description', '')
        if not job_description:
            return Response({"error": "No job description provided."}, status=status.HTTP_400_BAD_REQUEST)

        resume_text = ""
        try:
            reader = PyPDF2.PdfReader(resume.file.path)
            for page in reader.pages:
                resume_text += page.extract_text() + "\n"
        except Exception as e:
            return Response({"error": f"Failed to parse resume: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from groq import Groq
            client = Groq(api_key=os.environ.get("GROQ_API_KEY", "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"))
            prompt = f"""
            You are an expert ATS (Applicant Tracking System). Compare the following candidate's resume with the job description.
            Return ONLY a JSON object exactly with these keys: 
            "ats_score" (an integer from 0-100), 
            "missing_keywords" (a list of short strings),
            "feedback" (a brief string explaining why).
            
            Job Description: {job_description}
            
            Resume: {resume_text}
            """
            completion = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant",
                response_format={"type": "json_object"}
            )
            response_data = json.loads(completion.choices[0].message.content)
            usage.free_checks_used += 1
            usage.save()
            response_data["checks_remaining"] = 2 - usage.free_checks_used
            return Response(response_data)
        except Exception as e:
            return Response({"error": f"AI Parsing failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
