import pandas as pd
from jobspy import scrape_jobs
from .models import Location, Job, ScrapeSession, ScrapeLog

def log_to_db(session, message, level='info'):
    print(f"[{level.upper()}] {message}")
    try:
        ScrapeLog.objects.create(session=session, message=message, level=level)
    except Exception as e:
        print(f"Failed to log to DB: {e}")
        
from django.utils import timezone
from datetime import timedelta
import numpy as np
import time
import random
from geopy.geocoders import Nominatim
import re

def enrich_logo(row):
    if row.get('company_logo') and str(row['company_logo']) != 'nan' and row['company_logo'] is not None:
        return row['company_logo']
    company_val = row.get('company')
    if company_val and str(company_val).lower() not in ['nan', 'none', '']:
        company_name = str(company_val).split()[0].lower()
        company_name = re.sub(r'[^a-z0-9]', '', company_name)
        if company_name:
            return f"https://logo.clearbit.com/{company_name}.com"
    return None

def get_coordinates(loc_str, company=None, fallback_lat=None, fallback_lon=None):
    geolocator = Nominatim(user_agent="kaamlee_backend")
    if not loc_str or str(loc_str).lower() in ['nan', 'none']:
        return (fallback_lat, fallback_lon)

    clean_loc = str(loc_str).replace("Remote", "").strip(", ")
    if not clean_loc:
        return (fallback_lat, fallback_lon)

    queries = []
    if company:
        queries.append(f"{company}, {clean_loc}")
    queries.append(clean_loc)
    
    for q in queries:
        try:
            time.sleep(1.1) # Be more respectful to Nominatim
            location = geolocator.geocode(q, timeout=10)
            if location:
                return (location.latitude, location.longitude)
        except Exception:
            pass
    
    return (fallback_lat, fallback_lon)


def run_background_scraping():
    # Delete jobs older than 72 hours
    threshold_dt = timezone.now() - timedelta(hours=72)
    threshold_date = threshold_dt.date()
    
    from django.db.models import Q
    old_jobs = Job.objects.filter(
        Q(date_posted__lt=threshold_date) | 
        Q(date_posted__isnull=True, created_at__lt=threshold_dt)
    )
    deleted_count, _ = old_jobs.delete()
    
    # Log cleanup: Keep only the last 100 logs to prevent DB bloat
    log_count = ScrapeLog.objects.count()
    if log_count > 100:
        # Get the ID of the 100th log (latest)
        try:
            last_keep_log = ScrapeLog.objects.order_by('-timestamp')[999]
            ScrapeLog.objects.filter(timestamp__lt=last_keep_log.timestamp).delete()
        except IndexError:
            pass

    session = ScrapeSession.objects.create(status='running')
    log_to_db(session, f"Global scrape session initialized. Cleaned up {deleted_count} old jobs.", "success")
    total_found = 0
    
    try:
        from django.db.models import F
        locations = Location.objects.all().order_by(F('last_scraped').asc(nulls_first=True))
        
        if not locations.exists():
            log_to_db(session, "No locations found in database. Terminating.", "error")
            session.status = 'failed'
            session.error_message = "No locations found in database"
            session.save()
            return

        log_to_db(session, f"Starting scrape for {locations.count()} locations")


        for loc in locations:
            # Check if stop was requested
            session.refresh_from_db()
            if session.stop_requested:
                log_to_db(session, f"Stop signal detected for Session {session.id}. Terminating...", "warning")
                session.status = 'stopped'
                session.current_location = None
                session.end_time = timezone.now()
                session.save()
                return


            session.current_location = f"{loc.city}, {loc.country}"
            session.save()
            log_to_db(session, f"Switching target to: {loc.city}, {loc.country}")

            search_params = {
                "search_term": "frontend developer",
                "location": f"{loc.city}, {loc.country}",
                "results_wanted": 5,
                "hours_old": 72,
                "country_indeed": loc.country,
                "verbose": 0
            }

            try:
                sites = ["indeed", "linkedin", "zip_recruiter", "google"]
                for site in sites:
                    # Check stop before each site
                    session.refresh_from_db()
                    if session.stop_requested:
                        raise InterruptedError("Stop requested")
                        
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
                                if session.stop_requested:
                                    raise InterruptedError("Stop requested")


                                logo = enrich_logo(row)
                                lat = row.get('latitude')
                                lon = row.get('longitude')
                                
                                if lat is None or lon is None:
                                    # Use city coordinates as fallback
                                    lat, lon = get_coordinates(
                                        row.get('location'), 
                                        row.get('company'),
                                        fallback_lat=loc.latitude,
                                        fallback_lon=loc.longitude
                                    )
                                    # Add jitter if we use any coordinates to avoid overlap
                                    if lat is not None and lon is not None:
                                        lat += random.uniform(-0.015, 0.015)
                                        lon += random.uniform(-0.015, 0.015)

                                if lat is not None and lon is not None:
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
                                            'company_logo': logo,
                                            'date_posted': row.get('date_posted'),
                                            'latitude': lat,
                                            'longitude': lon,
                                        }
                                    )
                                    site_found += 1
                                    total_found += 1
                                    
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


        session.status = 'completed'
        session.current_location = None
        session.jobs_found = total_found
        session.end_time = timezone.now()
        session.save()
        log_to_db(session, f"Session completed successfully. Total jobs found: {total_found}", "success")
        
    except Exception as e:
        session.status = 'failed'
        session.error_message = str(e)
        session.save()
        log_to_db(session, f"Scraping session failed: {e}", "error")
