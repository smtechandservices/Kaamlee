from jobspy import scrape_jobs
from .models import Location, Job, ScrapeSession, ScrapeLog, Bookmark
from django.db import connection
from django.core.cache import cache
import os
import json
from django.conf import settings
from concurrent.futures import ThreadPoolExecutor, as_completed

def log_to_db(session, message, level='info'):
    print(f"[{level.upper()}] {message}")
    try:
        ScrapeLog.objects.create(session=session, message=message, level=level)
    except Exception as e:
        print(f"Failed to log to DB: {e}")
        
def sync_locations_from_json(session=None):
    path = os.path.join(settings.BASE_DIR, 'places.json')
    if not os.path.exists(path):
        if session: log_to_db(session, f"Places JSON not found at {path}", "error")
        return

    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        created_count = 0
        for country_data in data:
            country = country_data.get('country')
            code = country_data.get('code')
            for place_data in country_data.get('places', []):
                state = place_data.get('state')
                for city in place_data.get('cities', []):
                    _, created = Location.objects.get_or_create(
                        country=country,
                        country_code=code,
                        state=state,
                        city=city
                    )
                    if created:
                        created_count += 1

        if created_count > 0:
            if session: log_to_db(session, f"Synced {created_count} new locations from places.json", "success")
        else:
            if session: log_to_db(session, "All locations from places.json are already in DB", "info")

        # Geocode any locations that are still missing coordinates (runs once per new city)
        _geocode_new_locations(session)

    except Exception as e:
        if session: log_to_db(session, f"Error syncing locations: {e}", "error")
        
from django.utils import timezone
from datetime import timedelta
from geopy.geocoders import Nominatim
import numpy as np
import time
import random
import re

def _geocode_new_locations(session=None):
    """Geocode Location rows that are missing coordinates. Runs once per new city."""
    missing = Location.objects.filter(latitude__isnull=True)
    if not missing.exists():
        return

    count = missing.count()
    if session: log_to_db(session, f"Geocoding {count} new location(s) missing coordinates...", "info")

    geolocator = Nominatim(user_agent="kaamlee_locations")
    updated = 0
    for loc in missing:
        query = f"{loc.city}, {loc.state}, {loc.country}" if loc.state else f"{loc.city}, {loc.country}"
        try:
            time.sleep(1.1)
            result = geolocator.geocode(query, timeout=10)
            if result:
                loc.latitude = result.latitude
                loc.longitude = result.longitude
                loc.save(update_fields=['latitude', 'longitude'])
                updated += 1
        except Exception:
            pass

    if session: log_to_db(session, f"Location geocoding done: {updated}/{count} resolved.", "success")

def enrich_logo(row):
    # Logo fetching disabled — UI uses first-letter fallback
    # if row.get('company_logo') and str(row['company_logo']) != 'nan' and row['company_logo'] is not None:
    #     return row['company_logo']
    # company_val = row.get('company')
    # if company_val and str(company_val).lower() not in ['nan', 'none', '']:
    #     company_name = str(company_val).split()[0].lower()
    #     company_name = re.sub(r'[^a-z0-9]', '', company_name)
    #     if company_name:
    #         return f"https://logo.clearbit.com/{company_name}.com"
    return None


def geocode_missing_coordinates(session=None):
    """
    After scraping, geocode jobs that still have no coordinates.
    Uses city + country extracted from location_name for a clean, reliable query.
    Groups by unique query string — 1 Nominatim call per unique city.
    """
    geolocator = Nominatim(user_agent="kaamlee_jobs")

    jobs_missing = Job.objects.filter(latitude__isnull=True, longitude__isnull=True)
    total = jobs_missing.count()
    if not total:
        if session: log_to_db(session, "All jobs already have coordinates.", "info")
        return

    if session: log_to_db(session, f"Geocoding {total} jobs with missing coordinates...", "info")

    geo_cache = {}  # query_string → (lat, lon)
    updated = 0

    for job in jobs_missing:
        if session:
            session.refresh_from_db()
            if session.stop_requested or session.status != 'running':
                log_to_db(session, "Stop signal during geocoding. Halting.", "warning")
                return

        # Build a clean query from location_name: take first part (city) + last part (country)
        # e.g. "Greater Noida, Uttar Pradesh, India" → "Greater Noida, India"
        raw = str(job.location_name or '').replace("Remote", "").strip(", ").strip()
        if not raw or raw.lower() in ('nan', 'none', ''):
            # Fall back to the FK location city + country
            if job.location:
                raw = f"{job.location.city}, {job.location.country}"
            else:
                continue

        parts = [p.strip() for p in raw.split(",") if p.strip()]
        if len(parts) >= 2:
            query = f"{parts[0]}, {parts[-1]}"   # city, country
        else:
            query = parts[0] if parts else None

        if not query:
            continue

        if query not in geo_cache:
            try:
                time.sleep(1.1)
                result = geolocator.geocode(query, timeout=10)
                geo_cache[query] = (result.latitude, result.longitude) if result else (None, None)
            except Exception as e:
                if session: log_to_db(session, f"Geocode error for '{query}': {e}", "warning")
                geo_cache[query] = (None, None)

        lat, lon = geo_cache[query]
        if lat is not None and lon is not None:
            job.latitude = lat + random.uniform(-0.015, 0.015)
            job.longitude = lon + random.uniform(-0.015, 0.015)
            job.save(update_fields=['latitude', 'longitude'])
            updated += 1

    if session: log_to_db(session, f"Geocoding complete. Updated {updated}/{total} jobs.", "success")


def run_background_scraping(search_term="frontend developer", results_wanted=5, country=None):
    # Delete jobs older than 72 hours
    threshold_dt = timezone.now() - timedelta(hours=72)
    threshold_date = threshold_dt.date()
    
    from django.db.models import Q
    old_job_ids = list(
        Job.objects.filter(
            Q(date_posted__lt=threshold_date) |
            Q(date_posted__isnull=True, created_at__lt=threshold_dt)
        ).values_list('id', flat=True)
    )

    if old_job_ids:
        placeholders = ','.join(['%s'] * len(old_job_ids))
        # api_generatedresume exists in the DB but has no Django model (reverted
        # migration left the table behind). Delete its rows first so SQLite's FK
        # check doesn't block the job deletion.
        with connection.cursor() as cur:
            try:
                cur.execute(
                    f'DELETE FROM api_generatedresume WHERE job_id IN ({placeholders})',
                    old_job_ids,
                )
            except Exception:
                pass
        Bookmark.objects.filter(job_id__in=old_job_ids).delete()
        deleted_count, _ = Job.objects.filter(id__in=old_job_ids).delete()
    else:
        deleted_count = 0
    
    # Log cleanup: Keep only the last 100 logs to prevent DB bloat
    log_count = ScrapeLog.objects.count()
    if log_count > 100:
        # Get the ID of the 100th log (latest)
        try:
            last_keep_log = ScrapeLog.objects.order_by('-timestamp')[100]
            ScrapeLog.objects.filter(timestamp__lt=last_keep_log.timestamp).delete()
        except IndexError:
            pass

    session = ScrapeSession.objects.create(
        status='running', 
        search_term=search_term, 
        results_limit=results_wanted,
        jobs_deleted=deleted_count
    )
    log_to_db(session, f"Global scrape session initialized for '{search_term}' (limit: {results_wanted}). Cleaned up {deleted_count} old jobs.", "success")
    
    # Sync locations from JSON to DB
    sync_locations_from_json(session)
    
    total_found = 0
    
    try:
        from django.db.models import F
        locations_qs = Location.objects.all()
        if country:
            locations_qs = locations_qs.filter(country__iexact=country)
        locations = locations_qs.order_by(F('last_scraped').asc(nulls_first=True))
        
        if not locations.exists():
            log_to_db(session, "No locations found in database. Terminating.", "error")
            session.status = 'failed'
            session.error_message = "No locations found in database"
            session.save()
            return

        log_to_db(session, f"Starting scrape for {locations.count()} locations")


        for loc in locations:
            # Check if stop was requested or session was force-stopped
            session.refresh_from_db()
            if session.stop_requested or session.status != 'running':
                log_to_db(session, f"Stop signal or status change detected for Session {session.id}. Terminating...", "warning")
                if session.status == 'running':
                    session.status = 'stopped'
                session.current_location = None
                session.end_time = timezone.now()
                session.save()
                return


            session.current_location = f"{loc.city}, {loc.country}"
            session.save()
            log_to_db(session, f"Switching target to: {loc.city}, {loc.country}")

            search_params = {
                "search_term": search_term, 
                "location": f"{loc.city}, {loc.country}",
                "results_wanted": results_wanted,
                "hours_old": 72,
                "country_indeed": loc.country,
                "verbose": 0 # 0 for no output, 1 for some output, 2 for all output
            }

            try:
                sites = ["indeed", "linkedin", "zip_recruiter", "google"]
                # 12 platforms total: "indeed", "linkedin", "zip_recruiter", "google", "glassdoor", "google", "simplyhired", "craigslist", "angel_list", "remote_ok", "we_work_remotely", "stackoverflow"
                for site in sites:
                    # Check stop before each site
                    session.refresh_from_db()
                    if session.stop_requested or session.status != 'running':
                        raise InterruptedError("Stop requested or status changed")
                        
                    log_to_db(session, f"Searching {site} for {loc.city}...")
                    try:
                        jobs_df = scrape_jobs(site_name=[site], **search_params)
                        if not jobs_df.empty:
                            log_to_db(session, f"Found {len(jobs_df)} jobs on {site}", "success")
                            jobs_df = jobs_df.replace({np.nan: None, np.inf: None, -np.inf: None})
                            
                            site_found = 0
                            for _, row in jobs_df.iterrows():
                                # Check stop frequently inside processing
                                session.refresh_from_db()
                                if session.stop_requested or session.status != 'running':
                                    raise InterruptedError("Stop requested or status changed")

                                # logo = enrich_logo(row)
                                lat = row.get('latitude')
                                lon = row.get('longitude')

                                # Resolve to the most accurate DB location for this job
                                # Fall back to the search location's coordinates with jitter
                                if (lat is None or lon is None) and loc.latitude is not None and loc.longitude is not None:
                                    lat = loc.latitude + random.uniform(-0.015, 0.015)
                                    lon = loc.longitude + random.uniform(-0.015, 0.015)

                                Job.objects.update_or_create(
                                    id_from_site=row.get('id'),
                                    defaults={
                                        'title': row.get('title'),
                                        'company': row.get('company'),
                                        'location_name': row.get('location'),
                                        'location': loc,
                                        'is_remote': row.get('is_remote', False),
                                        'job_type': row.get('job_type'),
                                        'job_url': row.get('job_url'),
                                        'description': row.get('description'),
                                        'site': row.get('site'),
                                        'company_logo': None,
                                        'date_posted': row.get('date_posted'),
                                        'latitude': lat,
                                        'longitude': lon,
                                    }
                                )
                                site_found += 1
                                total_found += 1
                                    
                            session.jobs_found = total_found
                            session.save()
                            log_to_db(session, f"Successfully saved {site_found} jobs from {site} to database", "info")
                        else:
                            log_to_db(session, f"No jobs found on {site}", "warning")

                    except Exception as site_e:
                        log_to_db(session, f"Error scraping {site} in {loc.city}: {site_e}", "error")
                        continue
                    
                loc.last_scraped = timezone.now()
                loc.save()

            except InterruptedError:
                log_to_db(session, f"Stop signal detected for Session {session.id}. Terminating...", "warning")
                session.status = 'stopped'
                session.current_location = None
                session.end_time = timezone.now()
                session.save()
                return
            except Exception as e:
                log_to_db(session, f"Error scraping {loc.city}: {e}", "error")


        geocode_missing_coordinates(session)

        session.status = 'completed'
        session.current_location = None
        session.jobs_found = total_found
        session.end_time = timezone.now()
        session.save()
        cache.delete('api_stats')
        cache.delete('api_locations')
        log_to_db(session, f"Session completed successfully. Total jobs found: {total_found}", "success")

    except Exception as e:
        session.status = 'failed'
        session.error_message = str(e)
        session.save()
        cache.delete('api_stats')
        cache.delete('api_locations')
        log_to_db(session, f"Scraping session failed: {e}", "error")


def run_parallel_role_scraping(search_terms, results_wanted=5, country=None):
    """Scrape multiple job roles in parallel. Each role gets its own ScrapeSession."""
    if not search_terms:
        return

    print(f"[INFO] Starting parallel scrape for {len(search_terms)} roles: {search_terms}")

    with ThreadPoolExecutor(max_workers=len(search_terms)) as executor:
        futures = {
            executor.submit(run_background_scraping, term, results_wanted, country): term
            for term in search_terms
        }
        for future in as_completed(futures):
            term = futures[future]
            try:
                future.result()
            except Exception as e:
                print(f"[ERROR] Parallel scrape failed for '{term}': {e}")

    print(f"[INFO] Parallel scrape completed for all {len(search_terms)} roles.")
