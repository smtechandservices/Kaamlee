import random

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.constants import JOB_CATEGORIES
from companies.models import CompanyAccount, CompanyMember
from hiring.models import JobPosting

# Kept in sync with seed_demo_data's pools — duplicated rather than imported
# so this command works standalone against any approved company, including
# ones (like a real signup) that seed_demo_data never touched.
CITIES = [
    ('Bengaluru', 'Karnataka', 'India', 12.9716, 77.5946, False),
    ('Mumbai', 'Maharashtra', 'India', 19.0760, 72.8777, False),
    ('Delhi', 'Delhi', 'India', 28.6139, 77.2090, False),
    ('Hyderabad', 'Telangana', 'India', 17.3850, 78.4867, False),
    ('Pune', 'Maharashtra', 'India', 18.5204, 73.8567, False),
    ('Chennai', 'Tamil Nadu', 'India', 13.0827, 80.2707, False),
    ('Kolkata', 'West Bengal', 'India', 22.5726, 88.3639, False),
    ('Ahmedabad', 'Gujarat', 'India', 23.0225, 72.5714, False),
    ('Gurugram', 'Haryana', 'India', 28.4595, 77.0266, False),
    ('Noida', 'Uttar Pradesh', 'India', 28.5355, 77.3910, False),
    ('Jaipur', 'Rajasthan', 'India', 26.9124, 75.7873, False),
    ('Kochi', 'Kerala', 'India', 9.9312, 76.2673, False),
    ('Indore', 'Madhya Pradesh', 'India', 22.7196, 75.8577, False),
    ('San Francisco', 'California', 'USA', 37.7749, -122.4194, True),
    ('London', 'England', 'UK', 51.5074, -0.1278, True),
    ('Singapore', '', 'Singapore', 1.3521, 103.8198, True),
    ('Dubai', 'Dubai', 'UAE', 25.2048, 55.2708, True),
    ('Berlin', 'Berlin', 'Germany', 52.5200, 13.4050, True),
]

JOB_TITLES = [
    'Software Engineer', 'Senior Backend Engineer', 'Frontend Developer', 'Full Stack Developer',
    'DevOps Engineer', 'Site Reliability Engineer', 'Machine Learning Engineer', 'Cloud Architect',
    'QA Engineer', 'Data Analyst', 'Data Scientist', 'Product Manager', 'Product Designer',
    'UX Researcher', 'UI Designer', 'Marketing Manager', 'Growth Marketer', 'Content Writer',
    'Sales Executive', 'Account Manager', 'Customer Support Specialist', 'Customer Success Manager',
    'HR Business Partner', 'Talent Acquisition Specialist', 'Financial Analyst', 'Accountant',
    'Business Analyst', 'Management Consultant', 'Operations Manager', 'Administrative Assistant',
    'Legal Counsel', 'Compliance Officer', 'Mechanical Engineer', 'Electrical Engineer',
    'Registered Nurse', 'Physician Assistant', 'Teacher', 'Instructional Designer',
    'Real Estate Agent', 'Property Manager',
]

SCREENING_QUESTIONS_POOL = [
    'Why are you interested in this role?',
    'How many years of relevant experience do you have?',
    "What's your notice period?",
    "What's your expected salary range?",
    'Can you describe a challenging project you’ve worked on?',
    'Are you comfortable with our office location / remote setup?',
    'What tools or technologies are you most proficient in?',
    'Why do you want to work at our company?',
]

FORM_FIELD_POOL = [
    {'key': 'portfolio_link', 'label': 'Portfolio / LinkedIn URL', 'type': 'url', 'required': False},
    {'key': 'cover_note', 'label': 'Brief cover note', 'type': 'textarea', 'required': False},
    {'key': 'current_ctc', 'label': 'Current CTC', 'type': 'text', 'required': False},
    {'key': 'years_experience', 'label': 'Years of experience', 'type': 'number', 'required': False},
]

EMPLOYMENT_TYPES = ['full_time', 'full_time', 'full_time', 'part_time', 'contract', 'internship']
EXPERIENCE_LEVELS = ['entry', 'mid', 'mid', 'senior', 'lead']


class Command(BaseCommand):
    help = (
        "Tops every approved company up to a handful of published job postings — including real "
        "companies (like a manual signup) that seed_demo_data never touched. Safe to re-run — only "
        "tops up companies below the target range."
    )

    def add_arguments(self, parser):
        parser.add_argument('--min-postings', type=int, default=3, help='Minimum postings per company. Default 3.')
        parser.add_argument('--max-postings', type=int, default=7, help='Maximum postings per company. Default 7.')

    def handle(self, *args, **options):
        min_postings = options['min_postings']
        max_postings = options['max_postings']
        companies = CompanyAccount.objects.filter(kyc_status='approved').order_by('id')
        total_added = 0

        with transaction.atomic():
            for company in companies:
                existing = JobPosting.objects.filter(company=company).count()
                target = random.randint(min_postings, max_postings)
                to_add = max(0, target - existing)
                if to_add == 0:
                    continue

                # created_by is informational — prefer the owner, fall back to
                # any member (or None) so a company with no members at all
                # doesn't block seeding.
                member = (
                    CompanyMember.objects.filter(company=company, role='owner').first()
                    or CompanyMember.objects.filter(company=company).first()
                )

                for _ in range(to_add):
                    title = random.choice(JOB_TITLES)
                    city, state, country, lat, lng, is_remote_city = random.choice(CITIES)
                    is_remote = (is_remote_city and random.random() < 0.5) or random.random() < 0.15
                    salary_min = random.choice([None, 600000, 900000, 1200000, 1800000])
                    salary_max = (salary_min + random.choice([300000, 500000, 800000])) if salary_min else None
                    questions = random.sample(SCREENING_QUESTIONS_POOL, k=random.randint(0, 3))
                    form_schema = random.sample(FORM_FIELD_POOL, k=random.randint(0, 2))

                    JobPosting.objects.create(
                        company=company, created_by=member, title=title,
                        description=(
                            f'{company.name} is hiring a {title}. You will work closely with a small, '
                            f'fast-moving team to ship real product. We value ownership, clear '
                            f'communication, and a bias toward action.'
                        ),
                        employment_type=random.choice(EMPLOYMENT_TYPES),
                        salary_min=salary_min, salary_max=salary_max, salary_currency='INR',
                        city=city, state=state, country=country,
                        latitude=lat, longitude=lng, is_remote=is_remote,
                        experience_level=random.choice(EXPERIENCE_LEVELS),
                        category=random.choice(JOB_CATEGORIES),
                        status='published',
                        application_form_schema=form_schema,
                        screening_questions=[{'id': f'q{i+1}', 'question': q} for i, q in enumerate(questions)],
                        published_at=timezone.now(),
                    )
                    total_added += 1

                self.stdout.write(f'  {company.name}: {existing} -> {existing + to_add} postings')

        self.stdout.write(self.style.SUCCESS(f'\nDone. Added {total_added} job postings across {companies.count()} approved companies.\n'))
