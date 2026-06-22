from api.models import Job
from applications.models import ResumeVersion, ApplicationAnswer

class AIApplyService:
    def __init__(self, user):
        self.user = user

    def tailor_resume(self, job_id):
        """
        Placeholder for AI resume tailoring logic.
        In a real scenario, this would use an LLM to modify the resume text
        based on the job description and save it as a new ResumeVersion.
        """
        try:
            job = Job.objects.get(id=job_id)
        except Job.DoesNotExist:
            return {'error': 'Job not found'}

        # Mock tailoring
        resume_name = f"Tailored Resume - {job.company} - {job.title}"
        # For now, just link to the original if it exists, or create a dummy entry
        # In production, we'd generate a PDF/Docx and save it to 'file'
        
        # Check if already tailored
        existing = ResumeVersion.objects.filter(user=self.user, job=job).first()
        if existing:
            return {'resume_id': existing.id, 'name': existing.name, 'status': 'already_exists'}

        new_version = ResumeVersion.objects.create(
            user=self.user,
            job=job,
            name=resume_name,
            is_tailored=True
        )
        
        return {
            'resume_id': new_version.id,
            'name': new_version.name,
            'status': 'created'
        }

    def generate_answers(self, questions, job_id=None):
        """
        Placeholder for AI question answering logic.
        questions: list of strings or dicts containing question text.
        """
        answers = []
        for q in questions:
            q_text = q if isinstance(q, str) else q.get('text', '')
            
            # Check for saved answers first
            saved = ApplicationAnswer.objects.filter(user=self.user, question_text__icontains=q_text[:50]).first()
            if saved:
                answers.append({
                    'question': q_text,
                    'answer': saved.answer_text,
                    'source': 'saved'
                })
                continue

            # Mock AI generation
            mock_answer = f"Generated answer for: {q_text}"
            answers.append({
                'question': q_text,
                'answer': mock_answer,
                'source': 'ai'
            })
            
        return answers
