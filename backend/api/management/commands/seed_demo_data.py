import random

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.constants import JOB_CATEGORIES
from api.models import CustomCV, Portfolio
from companies.models import CompanyAccount, CompanyMember, KYCDocument
from hiring.models import Application, ApplicationStageChange, JobPosting, SavedJob

DEMO_PASSWORD = 'DemoPass123!'
DEMO_EMAIL_DOMAIN = 'demo.kaamlee.test'

COMPANIES = [
    ('Acme Robotics', 'Technology'), ('Northwind Labs', 'Technology'), ('Fernbridge Analytics', 'Technology'),
    ('Skyloom Cloud', 'Technology'), ('Verdant Foods', 'Operations & Administration'), ('Haven Health', 'Healthcare'),
    ('Bluepeak Systems', 'Engineering'), ('Cobalt Finance', 'Finance & Accounting'), ('Lumen Studio', 'Design'),
    ('Everline Logistics', 'Operations & Administration'), ('Crestwave Media', 'Marketing'),
    ('Orbital Devices', 'Engineering'), ('Wildflower Commerce', 'Sales'), ('Ironclad Security', 'Technology'),
    ('Nimbus Data', 'Technology'), ('Solstice Energy', 'Engineering'), ('Ashgrove Education', 'Education'),
    ('Ripple Payments', 'Finance & Accounting'), ('Granite Construction', 'Engineering'),
    ('Pinecrest Realty', 'Real Estate'), ('Quantum Mobility', 'Engineering'), ('Harborlight Insurance', 'Finance & Accounting'),
    ('Vantage Retail', 'Sales'), ('Meridian Biotech', 'Healthcare'), ('Copperleaf Consulting', 'Business & Consulting'),
]

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

FIRST_NAMES = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan',
    'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Myra', 'Aarohi', 'Anika', 'Kavya', 'Priya', 'Neha',
    'Rahul', 'Karan', 'Nikhil', 'Varun', 'Amit', 'Sneha', 'Pooja', 'Riya', 'Sanya', 'Tanvi',
    'James', 'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia',
]
LAST_NAMES = [
    'Sharma', 'Verma', 'Gupta', 'Kumar', 'Singh', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Rao',
    'Mehta', 'Joshi', 'Kapoor', 'Malhotra', 'Chatterjee', 'Bose', 'Pillai', 'Menon', 'Desai', 'Shah',
    'Smith', 'Johnson', 'Brown', 'Davis', 'Wilson',
]

SKILL_POOL = [
    'Python', 'JavaScript', 'TypeScript', 'React', 'Django', 'Node.js', 'SQL', 'AWS', 'Docker',
    'Kubernetes', 'Figma', 'SEO', 'Salesforce', 'Excel', 'Public Speaking', 'Project Management',
    'Data Analysis', 'Java', 'Go', 'GraphQL',
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

REJECTION_NOTES = [
    "We've decided to move forward with candidates whose experience more closely matches this role.",
    "Thank you for applying — we're prioritizing candidates with more hands-on experience in this stack.",
    "We appreciate your interest, but we're moving forward with another candidate at this time.",
    "Your profile is impressive, but we're looking for someone with more domain-specific experience right now.",
    "We've paused hiring for this position for the moment.",
    'The role has been filled internally.',
    'We need someone who can join sooner given the timeline for this role.',
    'Your expected compensation is outside our budget range for this position.',
]

STAGE_WEIGHTS = [
    ('applied', 40), ('screening', 15), ('shortlisted', 15), ('interview', 10),
    ('offer', 5), ('hired', 5), ('rejected', 10),
]

EMPLOYMENT_TYPES = ['full_time', 'full_time', 'full_time', 'part_time', 'contract', 'internship']
EXPERIENCE_LEVELS = ['entry', 'mid', 'mid', 'senior', 'lead']


def weighted_choice(pairs):
    total = sum(w for _, w in pairs)
    r = random.uniform(0, total)
    upto = 0
    for value, weight in pairs:
        upto += weight
        if upto >= r:
            return value
    return pairs[-1][0]


def build_resume_content(name, role):
    skills = random.sample(SKILL_POOL, k=random.randint(4, 8))
    return {
        'name': name,
        'role': role,
        'contacts': [{'type': 'email', 'value': f'{name.lower().replace(" ", ".")}@{DEMO_EMAIL_DOMAIN}'}],
        'links': [],
        'summary': f'{role} with hands-on experience delivering results across fast-moving teams.',
        'skills': [{'category': 'Core', 'items': skills}],
        'experience': [{
            'company': random.choice(COMPANIES)[0],
            'location': random.choice(CITIES)[0],
            'period': '2021 – Present',
            'role': role,
            'bullets': [f'Worked on initiatives involving {skills[0]} and {skills[1]}.'],
        }],
        'education': [{
            'institution': 'State University',
            'degree': 'B.Tech',
            'period': '2017 – 2021',
            'location': random.choice(CITIES)[0],
        }],
        'projects': [],
        'certifications': [],
        'achievements': [],
    }


class Command(BaseCommand):
    help = 'Seeds the database with a large batch of demo companies, job postings, candidates, and applications for local development.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--flush', action='store_true',
            help='Delete previously seeded demo data (identified by the demo email domain) before seeding.',
        )

    def handle(self, *args, **options):
        if options['flush']:
            self._flush()

        with transaction.atomic():
            companies = self._seed_companies()
            candidates = self._seed_candidates()
            postings = self._seed_job_postings(companies)
            self._seed_applications(postings, candidates)

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. {len(companies)} companies, {sum(len(p) for p in postings.values())} job postings, '
            f'{len(candidates)} candidates seeded.\n'
            f'All demo accounts share the password: {DEMO_PASSWORD}\n'
            f'Example company login: {companies[0][1].username}\n'
            f'Example candidate login: {candidates[0].username}\n'
        ))

    def _flush(self):
        self.stdout.write('Flushing previous demo data...')
        User.objects.filter(email__iendswith=f'@{DEMO_EMAIL_DOMAIN}').delete()
        CompanyAccount.objects.filter(contact_email__iendswith=f'@{DEMO_EMAIL_DOMAIN}').delete()

    def _seed_companies(self):
        self.stdout.write('Seeding companies...')
        companies = []
        for i, (name, industry) in enumerate(COMPANIES):
            slug = name.lower().replace(' ', '')
            contact_email = f'owner@{slug}.{DEMO_EMAIL_DOMAIN}'
            if i < 18:
                kyc_status, kyc_reason = 'approved', ''
            elif i < 22:
                kyc_status, kyc_reason = 'pending', ''
            else:
                kyc_status, kyc_reason = 'rejected', random.choice(REJECTION_NOTES)

            company = CompanyAccount.objects.create(
                name=name, legal_name=f'{name} Pvt Ltd', industry=industry,
                size=random.choice(['1-10', '11-50', '51-200', '201-500', '500+']),
                website=f'https://{slug}.example.com',
                address=f'{random.choice(CITIES)[0]}, {random.choice(CITIES)[2]}',
                contact_email=contact_email, contact_phone=f'+91 9{random.randint(100000000, 999999999)}',
                kyc_status=kyc_status, kyc_rejection_reason=kyc_reason,
                kyc_reviewed_at=timezone.now() if kyc_status != 'pending' else None,
            )
            owner = User.objects.create_user(f'demo_{slug}_owner', contact_email, DEMO_PASSWORD)
            CompanyMember.objects.create(company=company, user=owner, role='owner')

            if kyc_status != 'approved':
                KYCDocument.objects.create(
                    company=company, doc_type='registration_certificate',
                    file=ContentFile(b'Demo KYC document content', name=f'{slug}_registration.pdf'),
                )

            companies.append((company, owner))
        return companies

    def _seed_candidates(self):
        self.stdout.write('Seeding candidates...')
        candidates = []
        used_names = set()
        for _ in range(60):
            while True:
                first, last = random.choice(FIRST_NAMES), random.choice(LAST_NAMES)
                full_name = f'{first} {last}'
                if full_name not in used_names:
                    used_names.add(full_name)
                    break
            username = f'demo_{first.lower()}{last.lower()}{random.randint(1, 999)}'
            email = f'{first.lower()}.{last.lower()}@{DEMO_EMAIL_DOMAIN}'
            user = User.objects.create_user(username, email, DEMO_PASSWORD, first_name=first, last_name=last)

            role = random.choice(JOB_TITLES)
            content = build_resume_content(full_name, role)
            user.profile.phone = f'+91 9{random.randint(100000000, 999999999)}'
            user.profile.resume_text = f'{full_name} — {role}'
            user.profile.resume_parsed = content
            user.profile.save()

            portfolio = user.portfolio
            portfolio.is_public = random.random() < 0.5
            portfolio.title = role
            portfolio.bio = content['summary']
            portfolio.theme = random.choice(['minimal', 'noir', 'noir-violet', 'minimal-violet', 'noir-blue', 'minimal-blue'])
            portfolio.save()

            CustomCV.objects.create(
                user=user, label=f'{role} CV', target_role=role, template='ats',
                content=content, ats_score=random.randint(58, 96),
            )
            candidates.append(user)
        return candidates

    def _seed_job_postings(self, companies):
        self.stdout.write('Seeding job postings...')
        postings = {}
        approved = [(c, o) for c, o in companies if c.kyc_status == 'approved']
        for company, owner in approved:
            member = CompanyMember.objects.get(company=company, user=owner)
            company_postings = []
            for _ in range(random.randint(3, 7)):
                title = random.choice(JOB_TITLES)
                city, state, country, lat, lng, is_remote_city = random.choice(CITIES)
                is_remote = is_remote_city and random.random() < 0.5 or random.random() < 0.15
                salary_min = random.choice([None, 600000, 900000, 1200000, 1800000])
                salary_max = (salary_min + random.choice([300000, 500000, 800000])) if salary_min else None
                questions = random.sample(SCREENING_QUESTIONS_POOL, k=random.randint(0, 3))
                form_schema = random.sample(FORM_FIELD_POOL, k=random.randint(0, 2))

                posting = JobPosting.objects.create(
                    company=company, created_by=member, title=title,
                    description=(
                        f'{company.name} is hiring a {title}. You will work closely with a small, '
                        f'fast-moving team to ship real product. We value ownership, clear communication, '
                        f'and a bias toward action.'
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
                company_postings.append(posting)
            postings[company.id] = company_postings
        return postings

    def _seed_applications(self, postings, candidates):
        self.stdout.write('Seeding applications...')
        applied_pairs = set()
        count = 0
        for company_postings in postings.values():
            for posting in company_postings:
                member = posting.created_by
                applicants = random.sample(candidates, k=min(len(candidates), random.randint(0, 10)))
                for candidate in applicants:
                    key = (posting.id, candidate.id)
                    if key in applied_pairs:
                        continue
                    applied_pairs.add(key)

                    stage = weighted_choice(STAGE_WEIGHTS)
                    cv = CustomCV.objects.filter(user=candidate).first()
                    form_responses = {f['key']: 'Demo response' for f in posting.application_form_schema}
                    screening_answers = [
                        {'question_id': q['id'], 'answer_text': 'This is a demo answer to the screening question.'}
                        for q in posting.screening_questions
                    ]

                    application = Application.objects.create(
                        job_posting=posting, candidate=candidate, cv=cv,
                        portfolio_public_snapshot=candidate.portfolio.is_public,
                        form_responses=form_responses, screening_answers=screening_answers,
                        stage=stage,
                    )

                    if stage != 'applied':
                        note = random.choice(REJECTION_NOTES) if stage == 'rejected' else ''
                        ApplicationStageChange.objects.create(
                            application=application, from_stage='applied', to_stage=stage,
                            changed_by=member, note=note,
                        )

                    if random.random() < 0.15:
                        SavedJob.objects.get_or_create(user=candidate, job_posting=posting)

                    count += 1
        self.stdout.write(f'  {count} applications created.')
