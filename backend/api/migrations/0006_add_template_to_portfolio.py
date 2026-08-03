from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_simplify_theme_choices'),
    ]

    operations = [
        migrations.AddField(
            model_name='portfolio',
            name='template',
            field=models.CharField(
                choices=[('classic', 'Classic'), ('bento', 'Bento')],
                default='classic',
                max_length=20,
            ),
        ),
    ]
