import random

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from companies.models import CompanyAccount, CompanyMember

DEMO_PASSWORD = 'DemoPass123!'
DEMO_EMAIL_DOMAIN = 'demo.kaamlee.test'

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

ROLES = ['admin', 'recruiter', 'recruiter']  # weighted toward recruiter, one likely admin


class Command(BaseCommand):
    help = (
        "Tops every existing company up to a handful of team members (owner + a few admin/recruiter "
        "accounts) so the Team pages have something real to show while testing. Safe to re-run — "
        "only adds members to companies that don't already have enough."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--min-members', type=int, default=3,
            help='Minimum total members (including the owner) each company should end up with. Default 3.',
        )
        parser.add_argument(
            '--max-members', type=int, default=5,
            help='Maximum total members (including the owner) each company should end up with. Default 5.',
        )

    def handle(self, *args, **options):
        min_members = options['min_members']
        max_members = options['max_members']
        companies = CompanyAccount.objects.all().order_by('id')
        total_added = 0

        with transaction.atomic():
            for company in companies:
                existing = CompanyMember.objects.filter(company=company).count()
                target = random.randint(min_members, max_members)
                to_add = max(0, target - existing)
                if to_add == 0:
                    continue

                slug = slugify(company.name).replace('-', '')[:20] or f'company{company.id}'
                existing_count = existing
                for _ in range(to_add):
                    first, last = random.choice(FIRST_NAMES), random.choice(LAST_NAMES)
                    role = random.choice(ROLES)
                    existing_count += 1
                    username = f'demo_{slug}_{role}{existing_count}'
                    email = f'{first.lower()}.{last.lower()}{existing_count}@{slug}.{DEMO_EMAIL_DOMAIN}'
                    if User.objects.filter(username=username).exists():
                        continue
                    user = User.objects.create_user(username, email, DEMO_PASSWORD, first_name=first, last_name=last)
                    CompanyMember.objects.create(company=company, user=user, role=role)
                    total_added += 1

                self.stdout.write(f'  {company.name}: {existing} -> {existing + to_add} members')

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. Added {total_added} team members across {companies.count()} companies.\n'
            f'All demo accounts share the password: {DEMO_PASSWORD}\n'
        ))
