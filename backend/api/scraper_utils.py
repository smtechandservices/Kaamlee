import pandas as pd
from jobspy import scrape_jobs
from scrapfly import ScrapflyClient, ScrapeConfig
from .models import Location, Job, ScrapeSession, ScrapeLog
import os
import json
import hashlib
import certifi
from django.conf import settings
from copy import deepcopy
from typing import List, Dict, Tuple, Optional, TypedDict

# Fix for macOS SSL certificate verification error
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()

import ssl
try:
    ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())
except Exception:
    pass

def _row_str(row, *keys, default=''):
    """Normalize pandas/JobSpy cell values for CharField (NaN → empty)."""
    for k in keys:
        val = row[k] if k in row.index else None
        if val is None:
            continue
        if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
            continue
        s = str(val).strip()
        if s.lower() in ('nan', 'none', ''):
            continue
        return s
    return default


def _job_external_id(row, site_key: str, loc_id: int) -> str:
    """
    Unique key for Job.id_from_site. JobSpy uses 'id' + 'job_url'; some rows lack id.
    """
    for key in ('id', 'job_id'):
        val = row[key] if key in row.index else None
        if val is None:
            continue
        if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
            continue
        s = str(val).strip()
        if s and s.lower() != 'nan':
            return f"{site_key}:{s}"[:255]

    url = _row_str(row, 'job_url', 'job_url_direct')
    if url:
        digest = hashlib.sha256(url.encode('utf-8', errors='ignore')).hexdigest()[:40]
        return f"{site_key}:{digest}"[:255]

    title = _row_str(row, 'title', default='job')
    company = _row_str(row, 'company', default='unknown')
    raw = f"{site_key}|{loc_id}|{title}|{company}"
    digest = hashlib.sha256(raw.encode('utf-8', errors='ignore')).hexdigest()[:48]
    return f"{site_key}:{digest}"[:255]


def unpack_node_references(node, graph, debug=False):
    """
    unpacks references in a graph node to a flat node structure
    """
    def flatten(value):
        try:
            if value["type"] != "id":
                return value
        except (KeyError, TypeError):
            return value
        
        ref_id = value["id"]
        if ref_id not in graph:
            return value
            
        data = deepcopy(graph[ref_id])
        # flatten nodes too:
        if isinstance(data, dict) and data.get("node"):
            data = flatten(data["node"])
        if debug and isinstance(data, dict):
            data["__reference"] = ref_id
        return data

    node = flatten(node)

    if isinstance(node, dict):
        for key, value in node.items():
            if isinstance(value, list):
                node[key] = [flatten(v) for v in value]
                for i, item in enumerate(node[key]):
                    if isinstance(item, dict):
                        node[key][i] = unpack_node_references(item, graph)
            elif isinstance(value, dict):
                node[key] = unpack_node_references(value, graph)
    return node


def _scrape_wellfound(client: ScrapflyClient, role: str, location: str, session_obj=None) -> List[Dict]:
    """Scrape Wellfound using Scrapfly"""
    # Wellfound uses slug-based URLs
    role_slug = role.lower().replace(" ", "-")
    loc_slug = location.lower().split(",")[0].strip().replace(" ", "-")
    
    url = f"https://wellfound.com/role/l/{role_slug}/{loc_slug}"
    log_to_db(session_obj, f"Scrapfly: Scraping Wellfound for {role} in {location}...", "info")
    
    try:
        result = client.scrape(ScrapeConfig(url=url, asp=True))
        data_text = result.selector.css("script#__NEXT_DATA__::text").get()
        if not data_text:
            log_to_db(session_obj, "Scrapfly: Wellfound __NEXT_DATA__ not found", "warning")
            return []
            
        data = json.loads(data_text)
        graph = data["props"]["pageProps"]["apolloState"]["data"]
        
        jobs = []
        for key, node in graph.items():
            if key.startswith("JobListingSearchResult"):
                flat_job = unpack_node_references(node, graph)
                
                # Find company for this job
                company = None
                for c_key, c_node in graph.items():
                    if c_key.startswith("StartupResult"):
                        # This is a bit simplified; in a real scenario we'd match IDs
                        # but for now we'll take the first company found in the same graph
                        company = unpack_node_references(c_node, graph)
                        break
                
                loc_names = flat_job.get("locationNames", {}).get("json", [])
                
                jobs.append({
                    'id': flat_job.get("id"),
                    'title': flat_job.get("title"),
                    'company': company.get("name") if company else "Unknown",
                    'location': ", ".join(loc_names) if loc_names else location,
                    'is_remote': flat_job.get("remote", False),
                    'job_type': flat_job.get("jobType"),
                    'job_url': f"https://wellfound.com/jobs/{flat_job.get('id')}",
                    'description': flat_job.get("description"),
                    'company_logo': company.get("logoUrl") if company else None,
                    'site': 'wellfound'
                })
        return jobs
    except Exception as e:
        log_to_db(session_obj, f"Scrapfly: Wellfound error: {e}", "error")
        return []


def _scrape_glassdoor(client: ScrapflyClient, role: str, location: str, session_obj=None) -> List[Dict]:
    """Scrape Glassdoor using Scrapfly"""
    # Glassdoor search URL
    query = f"{role} in {location}"
    url = f"https://www.glassdoor.com/Job/jobs.htm?sc.keyword={query.replace(' ', '+')}"
    log_to_db(session_obj, f"Scrapfly: Scraping Glassdoor for {query}...", "info")
    
    try:
        result = client.scrape(ScrapeConfig(url=url, asp=True))
        
        # Extract Apollo cache
        data_text = result.selector.css("script#__NEXT_DATA__::text").get()
        if not data_text:
            # Try direct apolloState
            data_text = re.findall(r'apolloState":\s*({.+})};', result.content)
            if data_text:
                data_text = data_text[0]
            else:
                log_to_db(session_obj, "Scrapfly: Glassdoor data not found in HTML", "warning")
                return []
                
        data = json.loads(data_text)
        # Handle different potential structures
        cache = data.get("props", {}).get("pageProps", {}).get("apolloCache", data)
        
        def resolve_refs(d, root):
            if isinstance(d, dict):
                if "__ref" in d:
                    ref = d["__ref"]
                    return resolve_refs(root.get(ref, d), root)
                return {k: resolve_refs(v, root) for k, v in d.items()}
            if isinstance(d, list):
                return [resolve_refs(i, root) for i in d]
            return d

        unpacked = resolve_refs(cache, cache)
        
        # Find job listings in the unpacked cache
        job_listings = []
        for key, val in unpacked.items():
            if key.startswith("jobListings") and isinstance(val, dict) and "jobListings" in val:
                job_listings = val["jobListings"]
                break
        
        jobs = []
        for item in job_listings:
            header = item.get("jobview", {}).get("header", {})
            employer = header.get("employer", {})
            
            jobs.append({
                'id': str(header.get("jobListingId") or item.get("jobListingId")),
                'title': header.get("jobTitleText"),
                'company': employer.get("shortName") or employer.get("name"),
                'location': header.get("locationName") or location,
                'is_remote': "remote" in (header.get("locationName") or "").lower(),
                'job_type': None,
                'job_url': urljoin("https://www.glassdoor.com", header.get("jobLink")) if header.get("jobLink") else None,
                'description': None, # Description often requires separate fetch
                'company_logo': item.get("overview", {}).get("squareLogoUrl"),
                'site': 'glassdoor'
            })
        return jobs
    except Exception as e:
        log_to_db(session_obj, f"Scrapfly: Glassdoor error: {e}", "error")
        return []


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
            
    except Exception as e:
        if session: log_to_db(session, f"Error syncing locations: {e}", "error")
        
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


def run_background_scraping(search_term="frontend developer", results_wanted=5):
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
    
    # Initialize Scrapfly Client
    scrapfly_key = os.getenv('SCRAPFLY_API_KEY')
    scrapfly_client = None
    if scrapfly_key:
        scrapfly_client = ScrapflyClient(key=scrapfly_key, verify=certifi.where())
    else:
        log_to_db(session, "SCRAPFLY_API_KEY not found in environment. Glassdoor and Wellfound will be skipped.", "warning")

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
                sites = ["indeed", "linkedin", "zip_recruiter", "google", "glassdoor", "wellfound"]
                for site in sites:
                    # Check stop before each site
                    session.refresh_from_db()
                    if session.stop_requested or session.status != 'running':
                        raise InterruptedError("Stop requested or status changed")
                        
                    log_to_db(session, f"Searching {site} for {loc.city}...")
                    
                    try:
                        scraped_jobs = []
                        
                        if site in ["glassdoor", "wellfound"]:
                            if not scrapfly_client:
                                log_to_db(session, f"Skipping {site} (no Scrapfly client)", "warning")
                                continue
                            
                            if site == "glassdoor":
                                scraped_jobs = _scrape_glassdoor(scrapfly_client, search_term, f"{loc.city}, {loc.country}", session)
                            else:
                                scraped_jobs = _scrape_wellfound(scrapfly_client, search_term, f"{loc.city}, {loc.country}", session)
                                
                            if scraped_jobs:
                                log_to_db(session, f"Found {len(scraped_jobs)} jobs on {site}", "success")
                                site_found = 0
                                for job_data in scraped_jobs:
                                    # Check stop frequently
                                    session.refresh_from_db()
                                    if session.stop_requested or session.status != 'running':
                                        raise InterruptedError("Stop requested or status changed")

                                    ext_id = f"{site}:{job_data['id']}"
                                    
                                    # Fallback coordinates
                                    lat, lon = get_coordinates(
                                        job_data.get('location', ''),
                                        job_data.get('company'),
                                        fallback_lat=loc.latitude,
                                        fallback_lon=loc.longitude
                                    )
                                    if lat is not None and lon is not None:
                                        lat += random.uniform(-0.015, 0.015)
                                        lon += random.uniform(-0.015, 0.015)

                                    Job.objects.update_or_create(
                                        id_from_site=ext_id,
                                        defaults={
                                            'title': job_data.get('title', 'Untitled')[:255],
                                            'company': job_data.get('company', 'Unknown')[:255],
                                            'location_name': job_data.get('location', loc.city)[:255],
                                            'location': loc,
                                            'is_remote': job_data.get('is_remote', False),
                                            'job_type': job_data.get('job_type'),
                                            'job_url': (job_data.get('job_url') or '')[:1000],
                                            'description': job_data.get('description'),
                                            'site': site,
                                            'company_logo': (job_data.get('company_logo') or '')[:1000],
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
                                
                        else:
                            # Original JobSpy logic
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
