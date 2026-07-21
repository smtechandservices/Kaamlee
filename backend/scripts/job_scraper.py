"""Scrape job listings directly from company career pages.

Companies are managed via the Company model (name, domain, career_url,
contact_url, contact_email, address, linkedin_url, is_active). For each
company we:

1. Detect whether career_url is a known ATS (Greenhouse, Lever, Ashby,
   SmartRecruiters, Workday) and pull postings via that platform's public API.
2. If the URL itself isn't a known ATS, fetch the page and check whether it
   links out to one (common for custom "careers" pages that embed an ATS
   board) — the most-referenced ATS link on the page wins.
3. Otherwise fall back to a generic heuristic scrape of the page's links.

Salary and experience are extracted from posting text on a best-effort basis
(these fields aren't always present or structured).
"""
import html
import re
import ssl
import time
from datetime import datetime, timedelta
from urllib.parse import urljoin

import certifi
import requests
from bs4 import BeautifulSoup
from django.db import models
from django.db.models import Q
from django.utils import timezone
from geopy.geocoders import Nominatim

from api.models import Job, ScrapeLog, Company
from scripts.job_categorizer import categorize_job

# geopy's default geocoder uses urllib/ssl directly (not requests, which bundles
# certifi automatically) — on hosts without a properly configured system CA
# store (common with python.org installers on macOS) every geocode call fails
# silently with a cert-verification error. Pin it to certifi's bundle instead.
_GEOCODER_SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())

USER_AGENT = "Mozilla/5.0 (compatible; KaamleeBot/1.0; +https://kaamlee.com/bot)"
REQUEST_TIMEOUT = 15
DEFAULT_LIMIT = 60

GREENHOUSE_RE = re.compile(r'(?:boards|job-boards)\.greenhouse\.io/([^/?#]+)', re.I)
LEVER_RE = re.compile(r'jobs\.lever\.co/([^/?#]+)', re.I)
ASHBY_RE = re.compile(r'jobs\.ashbyhq\.com/([^/?#]+)', re.I)
SMARTRECRUITERS_RE = re.compile(r'(?:careers|jobs)\.smartrecruiters\.com/([^/?#]+)', re.I)
WORKDAY_RE = re.compile(r'([a-z0-9\-]+)\.(wd\d+)\.myworkdayjobs\.com(/[^?#]*)', re.I)

EXPERIENCE_RE = re.compile(
    r'\d{1,2}\+?\s*(?:-|to|–)\s*\d{1,2}\+?\s*years?|\d{1,2}\+\s*years?', re.I,
)
SALARY_RE = re.compile(
    r'(?:₹|\$|£|€|Rs\.?)\s?[\d][\d,\.]*\s*(?:k|K|lpa|LPA|/hr|/hour|/yr|/year)?'
    r'\s*(?:-|–|to)\s*(?:₹|\$|£|€|Rs\.?)?\s?[\d][\d,\.]*\s*(?:k|K|lpa|LPA|/hr|/hour|/yr|/year)?',
)

JOB_LINK_HINT_RE = re.compile(r'(job|career|position|opening|req|vacan)', re.I)
SKIP_LINK_TEXT_RE = re.compile(
    r'^(home|about|contact|careers?|apply now|login|sign in|blog|privacy|terms)$', re.I,
)
_REMOTE_WORDS = ('remote', 'anywhere', 'work from home', 'wfh')

# Raw location strings often put a US state or Canadian province where a naive
# 2-part split ("City, XX") expects a country — e.g. "San Francisco, CA" would
# otherwise store country="CA". These let us recognize that and correct it.
US_STATES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
    'DC': 'District of Columbia',
}
CA_PROVINCES = {
    'AB': 'Alberta', 'BC': 'British Columbia', 'MB': 'Manitoba', 'NB': 'New Brunswick',
    'NL': 'Newfoundland and Labrador', 'NS': 'Nova Scotia', 'NT': 'Northwest Territories',
    'NU': 'Nunavut', 'ON': 'Ontario', 'PE': 'Prince Edward Island', 'QC': 'Quebec',
    'SK': 'Saskatchewan', 'YT': 'Yukon',
}
_US_STATE_NAMES = {v.lower() for v in US_STATES.values()} | {k.lower() for k in US_STATES}
_CA_PROVINCE_NAMES = {v.lower() for v in CA_PROVINCES.values()} | {k.lower() for k in CA_PROVINCES}

# Some ATS APIs (e.g. SmartRecruiters) return raw ISO 3166-1 alpha-2 country
# codes ("us", "in") directly in the location text rather than a full name.
_COUNTRY_CODE_MAP = {
    'us': 'United States', 'usa': 'United States', 'gb': 'United Kingdom', 'uk': 'United Kingdom',
    'in': 'India', 'ca': 'Canada', 'au': 'Australia', 'de': 'Germany', 'fr': 'France',
    'ie': 'Ireland', 'nl': 'Netherlands', 'sg': 'Singapore', 'jp': 'Japan', 'br': 'Brazil',
    'mx': 'Mexico', 'es': 'Spain', 'it': 'Italy', 'pl': 'Poland', 'se': 'Sweden',
    'ch': 'Switzerland', 'at': 'Austria', 'be': 'Belgium', 'nz': 'New Zealand',
    'kr': 'South Korea', 'cn': 'China', 'hk': 'Hong Kong', 'tw': 'Taiwan',
}

# Strips noise suffixes like "New York, NY or Remote" -> "New York, NY" that
# otherwise get swallowed whole into the country slot.
_LOCATION_NOISE_RE = re.compile(r'\s*\bor\s+remote\b', re.I)

# Nominatim's free-text search fails outright (returns no match at all, not a
# fuzzy near-miss) on two common patterns in admin-entered company addresses:
# a legal-entity name before the street number ("Acme Corp 123 Main St...")
# and inline unit/floor info ("Floor 2", "Suite 100"). Stripping both first
# is the difference between a resolved pin and a silently-unset one.
_ADDRESS_UNIT_RE = re.compile(r',?\s*\b(?:floor|fl|suite|ste|unit|apt|room|rm)\.?\s*#?\s*[\w-]+\b', re.I)
_LEADING_NON_ADDRESS_RE = re.compile(r'^[^\d]+(?=\d)')


def _clean_address_for_geocoding(address):
    cleaned = _ADDRESS_UNIT_RE.sub('', address)
    cleaned = _LEADING_NON_ADDRESS_RE.sub('', cleaned, count=1)
    return cleaned.strip(' ,')

# A bare, delimiter-free location string that exactly matches one of these is a
# country, not a city (no city is ever literally named "Japan" or "India").
# Maps to a canonical name so "usa"/"USA"/"United States" all normalize the same.
_KNOWN_COUNTRY_NAMES = {n.lower(): n for n in [
    'United States', 'United Kingdom', 'Canada', 'India', 'Australia', 'Germany',
    'France', 'Ireland', 'Japan', 'China', 'Brazil', 'Mexico', 'Spain', 'Italy',
    'Poland', 'Sweden', 'Switzerland', 'Austria', 'Belgium', 'New Zealand',
    'South Korea', 'Netherlands', 'Singapore', 'Indonesia', 'Norway', 'Denmark',
    'Finland', 'Portugal', 'Greece', 'Israel', 'South Africa', 'Philippines',
    'Vietnam', 'Thailand', 'Malaysia', 'Taiwan', 'Hong Kong', 'Argentina', 'Chile',
    'Colombia', 'Peru', 'Egypt', 'Nigeria', 'Kenya', 'United Arab Emirates',
    'Saudi Arabia', 'Turkey', 'Russia', 'Ukraine', 'Romania', 'Czech Republic',
    'Hungary', 'Bulgaria', 'Croatia', 'Serbia', 'Slovakia', 'Slovenia', 'Estonia',
    'Latvia', 'Lithuania', 'Iceland', 'Luxembourg', 'Malta', 'Cyprus',
]}
_KNOWN_COUNTRY_NAMES.update({'usa': 'United States', 'uk': 'United Kingdom', 'uae': 'United Arab Emirates'})


def _normalize_region(state, country):
    """Fix the 2-part 'City, <State/Province>' case where the split heuristic
    put a US state or Canadian province in the country slot."""
    if not state and country:
        lowered = country.strip().lower()
        if lowered in _US_STATE_NAMES:
            return country, 'United States'
        if lowered in _CA_PROVINCE_NAMES:
            return country, 'Canada'
    if country:
        mapped = _COUNTRY_CODE_MAP.get(country.strip().lower())
        if mapped:
            return state, mapped
    return state, country


def log_to_db(session, message, level='info'):
    print(f"[{level.upper()}] {message}")
    try:
        ScrapeLog.objects.create(session=session, message=message, level=level)
    except Exception as e:
        print(f"Failed to log to DB: {e}")


def _geocode_missing_job_coordinates(session=None):
    """Geocode Job rows missing lat/lng, deduped by (city, state, country) so each
    unique city is only queried once even though many jobs share it."""
    missing_cities = (
        Job.objects.filter(latitude__isnull=True)
        .exclude(city='').exclude(city='Unspecified')
        .values('city', 'state', 'country')
        .distinct()
    )
    cities = list(missing_cities)

    geolocator = Nominatim(user_agent="kaamlee_locations", ssl_context=_GEOCODER_SSL_CONTEXT)
    updated_jobs = 0

    if cities:
        if session:
            log_to_db(session, f"Geocoding {len(cities)} new distinct location(s) missing coordinates...", "info")
        for c in cities:
            city, state, country = c['city'], c['state'], c['country']
            # "Unspecified" is our own placeholder, not a real place — querying with
            # it as a literal term only confuses the geocoder, so drop it from the query.
            query_parts = [p for p in (city, state, country) if p and p != 'Unspecified']
            query = ', '.join(query_parts)
            try:
                time.sleep(1.1)
                result = geolocator.geocode(query, timeout=10)
                if result:
                    updated_jobs += Job.objects.filter(
                        city=city, state=state, country=country, latitude__isnull=True,
                    ).update(latitude=result.latitude, longitude=result.longitude)
            except Exception:
                pass

    # Jobs with no scraped location fall back to the company's raw address as
    # location_name (city stays 'Unspecified' since that text isn't a "City,
    # State" pair — see scrape_company). Geocode those by the full address
    # text instead, deduped per distinct address so every job at the same
    # company shares one lookup.
    missing_addresses = (
        Job.objects.filter(latitude__isnull=True, city='Unspecified')
        .exclude(location_name='')
        .values_list('location_name', flat=True)
        .distinct()
    )
    addresses = list(missing_addresses)
    if addresses:
        if session:
            log_to_db(session, f"Geocoding {len(addresses)} company address(es) for jobs missing location...", "info")
        for address in addresses:
            try:
                time.sleep(1.1)
                result = geolocator.geocode(_clean_address_for_geocoding(address), timeout=10)
                if result:
                    updated_jobs += Job.objects.filter(
                        location_name=address, latitude__isnull=True,
                    ).update(latitude=result.latitude, longitude=result.longitude)
            except Exception:
                pass

    if session and (cities or addresses):
        log_to_db(session, f"Location geocoding done: {updated_jobs} job(s) across {len(cities) + len(addresses)} distinct location(s) resolved.", "success")


def _delete_stale_jobs(session=None):
    """Remove jobs older than 7 days — postings with a known date_posted past the
    cutoff, or (when the source never reported one) jobs first scraped over 7 days
    ago, since we've had no signal since then that they're still live."""
    cutoff_date = timezone.now().date() - timedelta(days=7)
    cutoff_dt = timezone.now() - timedelta(days=7)
    qs = Job.objects.filter(
        Q(date_posted__lt=cutoff_date) |
        Q(date_posted__isnull=True, created_at__lt=cutoff_dt)
    )
    # qs.delete()'s total count also includes cascaded Bookmark/JobApplicationKit
    # rows, so count jobs separately to keep jobs_deleted an accurate job count.
    job_count = qs.count()
    if job_count:
        qs.delete()
        if session:
            log_to_db(session, f"Removed {job_count} job(s) older than 7 days", "info")
    return job_count


def load_companies():
    """Active companies eligible for scraping, as plain dicts (kept dict-shaped
    so the rest of this module doesn't care whether it's fed by the DB or a file)."""
    return list(
        Company.objects.filter(is_active=True).values(
            'name', 'domain', 'career_url', 'contact_url', 'contact_email',
            'address', 'linkedin_url', 'logo_url',
        )
    )


def _clean_text(value, is_html=False):
    if not value:
        return ''
    text = html.unescape(value)
    if is_html or '<' in text:
        text = BeautifulSoup(text, 'html.parser').get_text(separator=' ')
    return re.sub(r'\s+', ' ', text).strip()


def _extract_salary(text):
    if not text:
        return None
    m = SALARY_RE.search(text)
    return m.group(0).strip() if m else None


def _extract_experience(text):
    if not text:
        return None
    for m in EXPERIENCE_RE.finditer(text):
        window = text[max(0, m.start() - 30):m.end() + 30].lower()
        if 'experience' in window:
            return m.group(0).strip()
    return None


# Structured employment-type values ATS APIs sometimes hand us directly
# (Lever's categories.commitment, Ashby's employmentType, SmartRecruiters'
# typeOfEmployment) — keyed by the raw value with spaces/hyphens stripped so
# "Full-time", "Full Time" and "FullTime" all normalize the same.
_JOB_TYPE_ALIASES = {
    'fulltime': 'Full-time', 'permanent': 'Full-time', 'employee': 'Full-time',
    'parttime': 'Part-time',
    'intern': 'Internship', 'internship': 'Internship', 'trainee': 'Internship',
    'freelance': 'Freelance', 'freelancer': 'Freelance', 'contract': 'Freelance',
    'contractor': 'Freelance', 'temporary': 'Freelance', 'consultant': 'Freelance',
}

def _normalize_job_type(raw):
    if not raw:
        return None
    key = re.sub(r'[\s\-]+', '', str(raw)).lower()
    return _JOB_TYPE_ALIASES.get(key)


# Fallback for postings with no structured employment-type field (generic,
# Workday, Greenhouse) — checked most-specific-first, since a title like
# "Full-time Marketing Intern" is an internship, not a regular full-time role.
_JOB_TYPE_PATTERNS = [
    ('Internship', re.compile(r'\bintern(?:ship)?\b|\btrainee\b', re.I)),
    ('Freelance', re.compile(r'\bfreelanc\w*\b|\bcontract(?:or)?\b|\bconsultant\b|\btemporary\b', re.I)),
    ('Part-time', re.compile(r'\bpart[\s-]?time\b', re.I)),
    ('Full-time', re.compile(r'\bfull[\s-]?time\b', re.I)),
]

def _extract_job_type(*texts):
    for text in texts:
        if not text:
            continue
        for label, pattern in _JOB_TYPE_PATTERNS:
            if pattern.search(text):
                return label
    return 'Full-time'


def _resolve_location(location_text):
    """Parse a scraped location string into (city, state, country, is_remote)."""
    location_text = (location_text or '').strip()
    location_text = _LOCATION_NOISE_RE.sub('', location_text).strip()
    if not location_text:
        return 'Unspecified', None, 'Unspecified', False

    lowered_full = location_text.lower()
    is_remote = any(w in lowered_full for w in _REMOTE_WORDS)

    # Multi-location postings (e.g. Ashby) list options bullet-separated —
    # "San Francisco, CA • New York, NY • United States" — take the first as
    # the primary location rather than mangling all of them together.
    if '•' in location_text:
        location_text = location_text.split('•', 1)[0].strip()

    lowered = location_text.lower()

    if lowered in _KNOWN_COUNTRY_NAMES:
        return 'Unspecified', None, _KNOWN_COUNTRY_NAMES[lowered], is_remote

    # Workday etc. use "Country - City" instead of "City, Country".
    splitter = ',' if ',' in location_text else ' - '
    parts = [p.strip() for p in location_text.split(splitter) if p.strip()]
    if splitter == ' - ' and len(parts) > 1:
        parts = parts[::-1]  # normalize to city-first order
    city = parts[0] if parts else location_text
    country = parts[-1] if len(parts) > 1 else ('Remote' if is_remote else 'Unspecified')
    state = parts[1] if len(parts) > 2 else None

    state, country = _normalize_region(state, country)

    return city, state, country, is_remote


def _detect_platform(url):
    m = GREENHOUSE_RE.search(url)
    if m:
        return 'greenhouse', m.group(1)
    m = LEVER_RE.search(url)
    if m:
        return 'lever', m.group(1)
    m = ASHBY_RE.search(url)
    if m:
        return 'ashby', m.group(1)
    m = SMARTRECRUITERS_RE.search(url)
    if m:
        return 'smartrecruiters', m.group(1)
    m = WORKDAY_RE.search(url)
    if m:
        tenant, wd_host, path = m.group(1), m.group(2), m.group(3)
        segments = [seg for seg in path.strip('/').split('/') if seg]
        locale, site = None, None
        for seg in segments:
            if re.match(r'^[a-z]{2}-[A-Z]{2}$', seg):
                locale = seg
            elif site is None:
                site = seg
        return 'workday', (tenant, wd_host, site or 'Careers', locale or 'en-US')
    return 'generic', None


def _fetch_greenhouse(token, limit=None):
    resp = requests.get(
        f'https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true',
        headers={'User-Agent': USER_AGENT}, timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    jobs = resp.json().get('jobs', [])
    if limit:
        jobs = jobs[:limit]
    return [{
        'title': j.get('title'),
        'job_url': j.get('absolute_url'),
        'location_name': (j.get('location') or {}).get('name', ''),
        'description': _clean_text(j.get('content'), is_html=True),
        'date_posted': (j.get('first_published') or '')[:10] or None,
        'external_id': str(j.get('id')),
        'department_hint': (j.get('departments') or [{}])[0].get('name'),
    } for j in jobs]


def _fetch_lever(token, limit=None):
    resp = requests.get(
        f'https://api.lever.co/v0/postings/{token}?mode=json',
        headers={'User-Agent': USER_AGENT}, timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    jobs = resp.json()
    if not isinstance(jobs, list):
        return []
    if limit:
        jobs = jobs[:limit]
    results = []
    for j in jobs:
        date_posted = None
        created_ms = j.get('createdAt')
        if created_ms:
            try:
                date_posted = datetime.utcfromtimestamp(created_ms / 1000).date().isoformat()
            except Exception:
                pass
        results.append({
            'title': j.get('text'),
            'job_url': j.get('hostedUrl'),
            'location_name': (j.get('categories') or {}).get('location', ''),
            'description': _clean_text(j.get('descriptionPlain') or j.get('description')),
            'date_posted': date_posted,
            'external_id': j.get('id'),
            'department_hint': (j.get('categories') or {}).get('team'),
            'job_type': (j.get('categories') or {}).get('commitment'),
        })
    return results


def _fetch_ashby(token, limit=None):
    resp = requests.get(
        f'https://api.ashbyhq.com/posting-api/job-board/{token}',
        headers={'User-Agent': USER_AGENT}, timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    jobs = resp.json().get('jobs', [])
    if limit:
        jobs = jobs[:limit]
    return [{
        'title': j.get('title'),
        'job_url': j.get('jobUrl'),
        'location_name': j.get('location', ''),
        'description': _clean_text(j.get('descriptionHtml'), is_html=True),
        'date_posted': (j.get('publishedAt') or '')[:10] or None,
        'external_id': j.get('id'),
        'department_hint': j.get('department') or j.get('team'),
        'job_type': j.get('employmentType'),
    } for j in jobs]


def _fetch_smartrecruiters(token, limit=None):
    limit = limit or 40
    resp = requests.get(
        f'https://api.smartrecruiters.com/v1/companies/{token}/postings',
        headers={'User-Agent': USER_AGENT}, timeout=REQUEST_TIMEOUT, params={'limit': limit},
    )
    resp.raise_for_status()
    postings = (resp.json().get('content') or [])[:limit]

    results = []
    for p in postings:
        detail = {}
        try:
            d_resp = requests.get(
                f'https://api.smartrecruiters.com/v1/companies/{token}/postings/{p["id"]}',
                headers={'User-Agent': USER_AGENT}, timeout=REQUEST_TIMEOUT,
            )
            if d_resp.ok:
                detail = d_resp.json()
        except requests.RequestException:
            pass
        time.sleep(0.25)

        loc = p.get('location') or {}
        location_name = ', '.join(b for b in (loc.get('city'), loc.get('region'), loc.get('country')) if b)

        sections = ((detail.get('jobAd') or {}).get('sections')) or {}
        description = ' '.join(
            _clean_text(s.get('text'), is_html=True) for s in sections.values() if s.get('text')
        ).strip() or None

        results.append({
            'title': p.get('name'),
            'job_url': detail.get('postingUrl') or f'https://jobs.smartrecruiters.com/{token}/{p["id"]}',
            'location_name': location_name,
            'description': description,
            'experience_required': (p.get('experienceLevel') or {}).get('label'),
            'date_posted': (p.get('releasedDate') or '')[:10] or None,
            'external_id': str(p.get('id')),
            'department_hint': (p.get('department') or {}).get('label') or (p.get('function') or {}).get('label'),
            'job_type': (p.get('typeOfEmployment') or {}).get('label'),
        })
    return results


def _fetch_workday(tenant, wd_host, site, locale='en-US', limit=None):
    limit = limit or 40
    base = f'https://{tenant}.{wd_host}.myworkdayjobs.com'
    api_url = f'{base}/wday/cxs/{tenant}/{site}/jobs'

    results = []
    offset = 0
    page_size = min(limit, 20)
    while len(results) < limit:
        resp = requests.post(
            api_url,
            headers={'User-Agent': USER_AGENT, 'Content-Type': 'application/json'},
            json={'appliedFacets': {}, 'limit': page_size, 'offset': offset, 'searchText': ''},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        postings = data.get('jobPostings') or []
        if not postings:
            break
        for p in postings:
            results.append({
                'title': p.get('title'),
                'job_url': base + f'/{locale}/{site}' + (p.get('externalPath') or ''),
                'location_name': p.get('locationsText', ''),
                'description': None,
                'date_posted': None,
                'external_id': (p.get('bulletFields') or [None])[0] or p.get('externalPath'),
            })
        offset += page_size
        if offset >= (data.get('total') or 0):
            break
        time.sleep(0.3)
    return results[:limit]


def _fetch_by_platform(platform, ident, limit=None):
    if platform == 'greenhouse':
        return _fetch_greenhouse(ident, limit=limit)
    if platform == 'lever':
        return _fetch_lever(ident, limit=limit)
    if platform == 'ashby':
        return _fetch_ashby(ident, limit=limit)
    if platform == 'smartrecruiters':
        return _fetch_smartrecruiters(ident, limit=limit)
    if platform == 'workday':
        tenant, wd_host, site, locale = ident
        return _fetch_workday(tenant, wd_host, site, locale=locale, limit=limit)
    return []


def _fetch_generic(career_url, limit=None):
    limit = limit or DEFAULT_LIMIT
    resp = requests.get(career_url, headers={'User-Agent': USER_AGENT}, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'html.parser')

    # A "custom" careers page often just embeds/links out to a known ATS board.
    # If most links point at one, prefer that platform's structured API.
    candidates = {}
    for a in soup.find_all('a', href=True):
        href = urljoin(career_url, a['href'])
        platform, ident = _detect_platform(href)
        if platform != 'generic':
            key = (platform, ident)
            candidates[key] = candidates.get(key, 0) + 1
    if candidates:
        (platform, ident), _ = max(candidates.items(), key=lambda kv: kv[1])
        return _fetch_by_platform(platform, ident, limit=limit)

    results = []
    seen_urls = set()
    for a in soup.find_all('a', href=True):
        text = a.get_text(strip=True)
        if not text or len(text) < 4 or len(text) > 140 or SKIP_LINK_TEXT_RE.match(text):
            continue
        href = urljoin(career_url, a['href'])
        if href in seen_urls or (not JOB_LINK_HINT_RE.search(href) and not JOB_LINK_HINT_RE.search(text)):
            continue
        seen_urls.add(href)
        results.append({
            'title': text,
            'job_url': href,
            'location_name': '',
            'description': None,
            'date_posted': None,
            'external_id': href,
        })
        if len(results) >= limit:
            break
    return results


def scrape_company(company, session=None, limit=None):
    name = (company.get('name') or 'Unknown').strip()
    domain = (company.get('domain') or '').strip()
    career_url = (company.get('career_url') or '').strip()

    if not career_url:
        if session:
            log_to_db(session, f"Skipping {name}: no career_url configured", "warning")
        return 0

    platform, ident = _detect_platform(career_url)
    try:
        postings = _fetch_by_platform(platform, ident, limit=limit) if platform != 'generic' \
            else _fetch_generic(career_url, limit=limit)
    except requests.RequestException as e:
        if session:
            log_to_db(session, f"Error fetching {name} career page: {e}", "error")
        return 0
    except Exception as e:
        if session:
            log_to_db(session, f"Unexpected error scraping {name}: {e}", "error")
        return 0

    if session:
        log_to_db(session, f"{name}: found {len(postings)} posting(s) via '{platform}'", "info")

    saved = 0
    for p in postings:
        title = (p.get('title') or '').strip()
        job_url = p.get('job_url')
        if not title or not job_url:
            continue

        description = p.get('description')
        experience_required = p.get('experience_required') or _extract_experience(description or title)
        salary = p.get('salary') or _extract_salary(description or '')
        # Fall back to the company's own address when the posting itself has no
        # location — better to show the HQ than an "Unspecified" placeholder.
        raw_location = (p.get('location_name') or '').strip()
        company_address = (company.get('address') or '').strip()
        if raw_location:
            location_name = raw_location
            city, state, country, is_remote = _resolve_location(raw_location)
        else:
            location_name = ''
            city, state, country, is_remote = _resolve_location('')

        # Remote postings have no single city of their own — anchor the map pin
        if (is_remote or not raw_location) and company_address:
            # _resolve_location's comma-split assumes ATS-style "City, State"
            # text; a free-form street address ("123 Main St, Springfield, IL")
            # would get mangled into a bogus city/state, so leave those as
            # Unspecified and let geocoding key off the full address text
            # instead (see the location_name-based pass below).
            location_name = company_address
            city, state, country = 'Unspecified', None, 'Unspecified'
        category = categorize_job(title, department_hint=p.get('department_hint'))
        job_type = _normalize_job_type(p.get('job_type')) or _extract_job_type(title, description)

        date_posted = None
        if p.get('date_posted'):
            try:
                date_posted = datetime.fromisoformat(p['date_posted']).date()
            except Exception:
                date_posted = None

        if date_posted and date_posted < (timezone.now().date() - timedelta(days=7)):
            continue

        Job.objects.update_or_create(
            id_from_site=f"career:{domain or name}:{p.get('external_id') or job_url}",
            defaults={
                'title': title,
                'company': name,
                'location_name': location_name,
                'city': city,
                'state': state,
                'country': country,
                'is_remote': is_remote,
                'job_type': job_type,
                'job_url': job_url,
                'description': description,
                'site': career_url,
                'company_logo': company.get('logo_url') or None,
                'date_posted': date_posted,
                'experience_required': experience_required,
                'salary': salary,
                'category': category,
            },
        )
        saved += 1

    return saved


def scrape_companies_by_names(names, session=None, limit_per_company=None):
    """Scrape a specific set of active companies (by name). Shared entry point for
    both the manual (user-picked) and auto-scrape (cron-picked) triggers, so the
    stale-job sweep below runs identically in either scenario."""
    all_companies = {c.get('name'): c for c in load_companies()}

    deleted = _delete_stale_jobs(session)
    if session:
        session.jobs_deleted = deleted
        session.save()

    total_saved = 0
    for name in names:
        company = all_companies.get(name)
        if not company:
            if session:
                log_to_db(session, f"Company '{name}' not found or inactive", "error")
            continue
        try:
            if session:
                session.current_location = name
                session.save()
            total_saved += scrape_company(company, session=session, limit=limit_per_company)
            Company.objects.filter(name=name).update(last_scraped_at=timezone.now())
            if session:
                session.jobs_found = total_saved
                session.save()
        except Exception as e:
            if session:
                log_to_db(session, f"Failed to scrape {name}: {e}", "error")

    _geocode_missing_job_coordinates(session)

    if session:
        log_to_db(session, f"Scrape complete for {', '.join(names)}: saved/updated {total_saved} job(s), removed {deleted} stale job(s).", "success")
    return total_saved


def run_random_companies_scraping(count=3, session=None, limit_per_company=None):
    """Pick the `count` least-recently-scraped active companies (never-scraped
    ones first) — used by the auto-scrape cron, so coverage rotates evenly
    instead of leaving some companies stale by pure bad luck."""
    ordered_names = list(
        Company.objects.filter(is_active=True)
        .order_by(models.F('last_scraped_at').asc(nulls_first=True))
        .values_list('name', flat=True)[:count]
    )
    if not ordered_names:
        if session:
            log_to_db(session, "No active companies configured", "warning")
        return 0

    if session:
        log_to_db(session, f"Auto-scrape picked {len(ordered_names)} least-recently-scraped compan{'y' if len(ordered_names) == 1 else 'ies'}: {', '.join(ordered_names)}", "info")

    return scrape_companies_by_names(ordered_names, session=session, limit_per_company=limit_per_company)
