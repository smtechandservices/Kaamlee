from jobspy import scrape_jobs
from .models import Job
import math, random
import time
from geopy.geocoders import Nominatim

geolocator = Nominatim(user_agent="kaamlee")
location_cache = {}

def get_coordinates(loc_str, company):
    if not loc_str or str(loc_str).lower() in ['nan', 'none']:
        return (20.5937 + random.uniform(-2, 2), 78.9629 + random.uniform(-2, 2))
    clean_loc = str(loc_str).replace("Remote", "").strip(", ")
    if not clean_loc: clean_loc = "India"
    
    queries = [f"{company.strip()}, {clean_loc}"] if company and str(company).lower() not in ['nan', 'none'] else []
    queries.append(clean_loc)
    
    for q in queries:
        if q in location_cache: return location_cache[q]
    
    for q in queries:
        try:
            time.sleep(0.5)
            location = geolocator.geocode(q, timeout=5)
            if location:
                coords = (location.latitude, location.longitude)
                location_cache[q] = coords
                return coords
        except Exception:
            pass
            
    fallback = (20.5937 + random.uniform(-3, 3), 78.9629 + random.uniform(-3, 3))
    location_cache[clean_loc] = fallback
    return fallback

def run_dynamic_scrape(query, results_wanted=10):
    try:
        jobs_df = scrape_jobs(
            site_name=["indeed", "linkedin", "google"], 
            search_term=query, location="India",
            results_wanted=results_wanted, hours_old=72,
            country_indeed="India", linkedin_fetch_description=True, is_remote=True
        )
        saved_count = 0
        if not jobs_df.empty:
            for _, row in jobs_df.iterrows():
                url = row.get('job_url')
                if not url or isinstance(url, float) and math.isnan(url): continue
                if Job.objects.filter(url=str(url)).exists(): continue
                
                company = str(row.get('company', 'Unknown Company'))
                coords = get_coordinates(row.get('location'), company)
                
                company_logo = row.get('company_logo')
                if isinstance(company_logo, float) and math.isnan(company_logo):
                    company_logo = f"https://logo.clearbit.com/{''.join(e for e in company.split()[0] if e.isalnum()).lower()}.com" if company else None
                
                Job.objects.create(
                    title=str(row.get('title', 'Unknown Title')),
                    company=company,
                    company_logo=company_logo,
                    location=str(row.get('location', '')),
                    is_remote=bool(row.get('is_remote', False)),
                    job_type=str(row.get('job_type', '')),
                    site=str(row.get('site', '')),
                    url=str(url),
                    description=str(row.get('description', '') if not isinstance(row.get('description'), float) else ''),
                    latitude=coords[0] + random.uniform(-0.02, 0.02),
                    longitude=coords[1] + random.uniform(-0.02, 0.02)
                )
                saved_count += 1
        return saved_count
    except Exception as e:
        print(f"Scrape error: {e}")
        return 0
