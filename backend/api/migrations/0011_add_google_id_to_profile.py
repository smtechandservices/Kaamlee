from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_add_custom_theme_to_portfolio'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='google_id',
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
    ]
