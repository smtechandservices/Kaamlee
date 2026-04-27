import os
import django
import sys
import time
from geopy.geocoders import Nominatim

# Set up Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import Location

def geocode_locations():
    geolocator = Nominatim(user_agent="kaamlee_setup")
    locations = Location.objects.filter(latitude__isnull=True)
    print(f"Geocoding {locations.count()} locations...")
    
    for loc in locations:
        query = f"{loc.city}, {loc.state}, {loc.country}" if loc.state else f"{loc.city}, {loc.country}"
        print(f"Geocoding: {query}")
        try:
            time.sleep(1.2)
            res = geolocator.geocode(query)
            if res:
                loc.latitude = res.latitude
                loc.longitude = res.longitude
                loc.save()
                print(f"  Result: {res.latitude}, {res.longitude}")
            else:
                print(f"  Failed to geocode {query}")
        except Exception as e:
            print(f"  Error: {e}")

if __name__ == "__main__":
    geocode_locations()
