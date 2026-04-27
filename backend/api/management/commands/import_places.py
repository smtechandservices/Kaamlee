import json
from django.core.management.base import BaseCommand
from api.models import Location
import os

class Command(BaseCommand):
    help = 'Import places from places.json'

    def handle(self, *args, **options):
        file_path = 'places.json'
        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f'File {file_path} not found'))
            return

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        count = 0
        for country_data in data:
            country = country_data.get('country')
            code = country_data.get('code')
            for place_data in country_data.get('places', []):
                state = place_data.get('state')
                for city in place_data.get('cities', []):
                    obj, created = Location.objects.get_or_create(
                        country=country,
                        country_code=code,
                        state=state,
                        city=city
                    )
                    if created:
                        count += 1

        self.stdout.write(self.style.SUCCESS(f'Successfully imported {count} new locations'))
