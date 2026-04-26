import pandas as pd
from jobspy import scrape_jobs

def run_scraping():
    """
    Scrapes job postings using python-jobspy and saves them to a CSV file.
    """
    try:
        print("Starting job search...")
        
        # Configure search parameters
        search_params = {
            "site_name": ["indeed", "linkedin", "zip_recruiter", "google"], # ["glassdoor", "naukri"]
            "search_term": "frontend developer",
            "google_search_term": "frontend developer nextjs jobs in India",
            "location": "India",
            "results_wanted": 10,
            "hours_old": 72,
            "country_indeed": "India",
            "linkedin_fetch_description": True, 
            "is_remote": True,
            "job_type": "fulltime",
            "verbose": 2
        }

        # Perform the scrape
        jobs = scrape_jobs(**search_params)
        
        print(f"Found {len(jobs)} jobs")
        
        if not jobs.empty:
            # Select columns requested by the user
            display_cols = ["site", "title", "company", "location", "is_remote", "job_type", "company_logo"]
            
            # Ensure columns exist and prepare data for display
            cols_to_show = [col for col in display_cols if col in jobs.columns]
            df_display = jobs[cols_to_show].copy()
            
            # Clean up logo URLs for console display (truncate)
            if "company_logo" in df_display.columns:
                df_display["company_logo"] = df_display["company_logo"].apply(
                    lambda x: (str(x)[:20] + "...") if x and len(str(x)) > 23 else x
                )
            
            # Use tabulate for a pretty console table
            from tabulate import tabulate
            
            print("\n" + "="*120)
            print(" JOB SEARCH RESULTS ".center(120, "="))
            print("="*120)
            
            # Format table for console
            try:
                print(tabulate(df_display, headers='keys', tablefmt='simple_grid', showindex=False))
            except UnicodeEncodeError:
                table_str = tabulate(df_display, headers='keys', tablefmt='simple_grid', showindex=False)
                print(table_str.encode('ascii', 'ignore').decode('ascii'))
            
            print("="*120)
            print(f"Total jobs found: {len(jobs)}")
            
            # Enrich missing logos with fallback
            def enrich_logo(row):
                if row.get('company_logo') and str(row['company_logo']) != 'nan' and row['company_logo'] is not None:
                    return row['company_logo']
                # Fallback to Clearbit if we have a valid company name
                company_val = row.get('company')
                if company_val and str(company_val).lower() not in ['nan', 'none', '']:
                    company_name = str(company_val).split()[0].lower()
                    import re
                    company_name = re.sub(r'[^a-z0-9]', '', company_name)
                    if company_name:
                        return f"https://logo.clearbit.com/{company_name}.com"
                return None

            # Apply enrichment
            if 'company_logo' in jobs.columns:
                jobs['company_logo'] = jobs.apply(enrich_logo, axis=1)

            # Geocode Locations
            print("\nGeocoding locations for the map...")
            from geopy.geocoders import Nominatim
            from geopy.exc import GeocoderTimedOut
            import time
            import random

            geolocator = Nominatim(user_agent="kaamlee")
            location_cache = {}

            def get_coordinates(row):
                loc_str = row.get('location')
                company = row.get('company')
                
                if not loc_str or str(loc_str).lower() in ['nan', 'none']:
                    return (20.5937 + random.uniform(-2, 2), 78.9629 + random.uniform(-2, 2)) # Random India center

                # Clean up "Remote, IN" or similar to just "India" or specific states if possible
                clean_loc = str(loc_str).replace("Remote", "").strip(", ")
                if not clean_loc:
                    clean_loc = "India"

                queries = []
                if company and str(company).lower() not in ['nan', 'none']:
                    clean_company = str(company).strip()
                    queries.append(f"{clean_company}, {clean_loc}")
                queries.append(clean_loc)
                
                for q in queries:
                    if q in location_cache:
                        return location_cache[q]

                for q in queries:
                    try:
                        time.sleep(0.5) # Respect Nominatim rate limits
                        location = geolocator.geocode(q, timeout=5)
                        if location:
                            coords = (location.latitude, location.longitude)
                            location_cache[q] = coords
                            return coords
                    except Exception as e:
                        pass
                
                # Fallback to random offset around center of India if geocoding fails
                fallback = (20.5937 + random.uniform(-3, 3), 78.9629 + random.uniform(-3, 3))
                location_cache[clean_loc] = fallback
                return fallback

            # Apply geocoding
            jobs['latitude'] = None
            jobs['longitude'] = None
            
            if 'location' in jobs.columns:
                coords = jobs.apply(get_coordinates, axis=1)
                # Add tiny jitter so markers don't exactly overlap
                jobs['latitude'] = coords.apply(lambda x: x[0] + random.uniform(-0.02, 0.02))
                jobs['longitude'] = coords.apply(lambda x: x[1] + random.uniform(-0.02, 0.02))
                print("Geocoding complete!")

            # Save to JSON for the frontend
            import json
            import os
            json_path = os.path.join("frontend", "src", "data", "jobs.json")
            os.makedirs(os.path.dirname(json_path), exist_ok=True)
            
            # Convert DataFrame to list of dicts, handling dates and NaN
            def json_serial(obj):
                if isinstance(obj, (pd.Timestamp, pd.Series, pd.DataFrame)):
                    return str(obj)
                if hasattr(obj, 'isoformat'):
                    return obj.isoformat()
                return None

            import numpy as np
            jobs_clean = jobs.replace({np.nan: None, np.inf: None, -np.inf: None})
            
            jobs_list = jobs_clean.to_dict(orient="records")
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(jobs_list, f, indent=2, ensure_ascii=False, default=json_serial)
            print(f"Data also saved to {json_path}")
            
        else:
            print("No jobs found matching the criteria.")

    except Exception as e:
        print(f"An error occurred during scraping: {e}")
        # Print detailed error if it's a library compatibility issue
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_scraping()
