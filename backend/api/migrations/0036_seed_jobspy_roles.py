from django.db import migrations

# Starting roles for the JobSpy feeder — broad enough to return jobs in most
# countries. Admins can edit, add or switch them off on the JobSpy scraper page.
DEFAULT_ROLES = [
    'Software Engineer',
    'Data Analyst',
    'Product Manager',
    'Sales Executive',
    'Marketing Manager',
    'Accountant',
    'HR Manager',
    'Customer Support',
    'Graphic Designer',
    'Business Analyst',
]


def seed_roles(apps, schema_editor):
    JobSpyRole = apps.get_model('api', 'JobSpyRole')
    for name in DEFAULT_ROLES:
        JobSpyRole.objects.get_or_create(name=name)


def unseed_roles(apps, schema_editor):
    apps.get_model('api', 'JobSpyRole').objects.filter(name__in=DEFAULT_ROLES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0035_jobspyfeederstate_jobspyrole_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_roles, unseed_roles),
    ]
