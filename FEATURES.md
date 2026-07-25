# Kaamlee — Feature & Architecture Reference

Developer reference for the Kaamlee platform: a job-search product that scrapes company career pages directly, matches/organizes applications for users, and layers AI-assisted resume/CV/portfolio tooling on top.

This document is a map of *what exists and where*, not a tutorial. Paths are relative to the repo root.

## Repo layout

| Path | What it is |
|---|---|
| `backend/` | Django 5 + DRF API (project package `core`, apps `api` and `payments`) |
| `frontend/` | Next.js 16 / React 19 — main user-facing app |
| `frontend-admin/` | Next.js 16 — internal admin panel |

---

## 1. Backend (`backend/`)

Django 5.0.2 + Django REST Framework. Auth is DRF **TokenAuthentication** (`Authorization: Token <key>`), not JWT.

### 1.1 Project config (`backend/core/`)

- **`settings.py`** — installed apps: `api`, `payments`, `rest_framework`, `rest_framework.authtoken`, `corsheaders`, `django_apscheduler`.
  - DB via `dj_database_url` (`DATABASE_URL` env), falls back to local `db.sqlite3`. SQLite gets a 30s `busy_timeout` because the in-process APScheduler writer competes with request threads.
  - Cache: in-memory `LocMemCache` — **per-process**, not shared across multiple gunicorn/uvicorn workers. Keep this in mind when debugging "stale data on one worker but not another."
  - `CORS_ALLOW_ALL_ORIGINS = True`.
  - `MEDIA_ROOT` = `backend/media` (resume uploads).
- **`middleware.py`** — custom `RequestLogMiddleware`: logs every request/response (method, path, duration, user, IP), reconstructs an equivalent `curl` command, dumps the response body, and redacts secrets (`password`, `token`, `razorpay_signature`, `Authorization`/`Cookie` headers) before writing to `backend/logs/requests.log` (rotating, 2.5MB × 1 backup). Viewable live in the admin panel's Logs page, or via `GET /api/admin/request-logs/`.
- **`urls.py`** — `/admin/` (Django admin), `/api/` → `api.urls`, `/payments/` → `payments.urls`.

### 1.2 App: `api` — jobs, users, portfolios, CV tools

#### Models (`backend/api/models.py`)

| Model | Purpose |
|---|---|
| `Profile` | 1:1 with `User` (auto-created via signal). `phone`, `linkedin_url`, `resume` file, `resume_text`, `resume_parsed` (JSON), `is_subscribed`, `subscription_expires_at`, `google_id`. |
| `EmailOTP` | Passwordless email OTP: `email`, `code_hash`, `attempts`, `is_used`, `expires_at`. |
| `Company` | Scrape target: `name`, `domain`, `career_url`, `contact_url/email`, `address`, `logo_url`, `is_active`, `last_scraped_at`. |
| `Job` | Scraped posting: title/company/location, `is_remote`, `job_type`, `job_url`, `description`, lat/lng, `experience_required`, `salary`, `category` (indexed), `date_posted`. |
| `ScrapeSession` / `ScrapeLog` | Per-run scrape status (`running/stop_requested/...`, `jobs_found`, `jobs_deleted`) and log lines (info/warning/error/success). |
| `Bookmark` | User↔Job (unique together), `status` = `saved / applied / interviewing / offered / rejected` — backs the Kanban tracker. |
| `Feedback` | 1:1 User, `rating` (1–5) + `message`. |
| `Portfolio` | 1:1 User (auto-created). `is_public`, `template` (`classic`/`bento`), `theme` (6 variants), `title`, `bio`, `github_url`. |
| `PortfolioView` | Analytics row per portfolio visit: IP, country/country_code, device/browser/OS, `viewed_at`. |
| `CustomCV` | AI-tailored resume: `label`, `target_role`, `template` (`modern`/`classic`/`ats`), `content` (JSON), `ats_score`, `ats_breakdown` (JSON). |
| `JobApplicationKit` | User+Job unique. AI-generated `cover_letter` + `qa` (JSON) for a specific job. |

#### Endpoints (`backend/api/views.py`, `backend/api/urls.py`)

**Auth**
- `POST /api/signup/`, `POST /api/login/` (DRF `obtain_auth_token`)
- `POST /api/auth/google/` — verifies a Google ID token, auto-provisions the user
- `POST /api/otp/request|verify|confirm/` — email OTP flow
- `POST /api/admin-login/` — superuser-only login for the admin panel
- `GET/PATCH /api/user/`, `POST /api/user/change-password/`
- `POST /api/check-existence/` — throttled username/email/phone dedupe check

**Jobs** (`JobViewSet`, gated by `IsAuthenticated + IsSubscribed`)
- `GET /api/jobs/` — filters: country, state, search, category, location, remote, bookmarked_only. Deterministic shuffle + 20/page pagination, 2-minute per-user response cache.
- `POST /api/jobs/{id}/toggle_bookmark/`, `POST /api/jobs/{id}/update_status/`
- `GET /api/jobs/map_pins/` — unpaginated lat/lng feed for the map view
- `POST /api/jobs/bulk-delete/` — admin only

**Applications / Kanban**
- `GET /api/applications/` — all of a user's bookmarks, grouped by status

**Portfolio**
- `GET /api/portfolio/<username>/` — public page, view-counted (dedupe window + IP geolocation)
- `GET/PATCH /api/portfolio/me/`, `GET/PATCH /api/portfolio/content/` (parsed resume JSON)
- `GET /api/portfolio/analytics/` — views by day/week/month, country/device/browser breakdown, 6-month trend

**Custom CV**
- `GET/POST /api/custom-cv/`, `GET/PATCH/DELETE /api/custom-cv/<id>/`
- `POST /api/custom-cv/<id>/tailor/` — Groq rewrite for a target role + re-scoring
- `GET /api/custom-cv/<id>/export/?type=pdf|docx`
- `GET /api/custom-cv/keywords/` — ATS keyword reference data

**Job Application Kit**
- `GET/POST /api/jobs/<job_id>/application-kit/` — Groq-generated cover letter + Q&A tailored to the user's parsed resume

**Scraper / admin surface**
- `GET /api/stats/`, `GET /api/logs/`
- `POST /api/trigger-company-scrape/` — cron-secret or superuser auth, spawns a background thread
- `/api/admin/companies/` (`CompanyViewSet`) — full CRUD + `bulk/` + `bulk-delete/`
- `GET /api/companies/` — paginated company cards with recent jobs (`light=true` mode)
- `GET /api/admin/jobs/` (`AdminJobsView`)
- `POST /api/stop-scrape/`, `POST /api/force-reset/`
- `/api/users/` (`AdminUserViewSet`) incl. `POST /users/{id}/set-password/`

**Misc**
- `GET /api/categories/` (fixed list), `GET /api/countries/` (distinct, cached)
- `GET/POST/DELETE /api/feedback/`, `GET /api/admin/feedback/`

#### Serializers & AI integration (`backend/api/serializers.py`)

`UserSerializer` handles resume upload (5MB max, PDF/TXT only, magic-byte validated) and triggers `parse_resume_with_groq`. Free functions `parse_resume_with_groq`, `tailor_resume_with_groq`, `generate_application_kit_with_groq` all call the **Groq LLM API** (`GROQ_API_KEY`).

#### Permissions (`backend/api/permissions.py`)

`IsSubscribed` — checks `profile.is_subscribed` + `subscription_expires_at`, lazily flips `is_subscribed=False` on expiry. Superusers always pass.

#### Background jobs & scraping

- **`backend/api/scheduler.py`** — in-process APScheduler `BackgroundScheduler`, job `auto_scrape_job` runs every **5 minutes**. Uses `fcntl.flock` on `/tmp/kaamlee_autoscrape.lock` so only one worker process ticks; skips if a `ScrapeSession` is already running; picks the 10 least-recently-scraped active companies.
- **`backend/api/apps.py`** — `ApiConfig.ready()` starts the scheduler, skipping it for non-serving management commands and de-duping the dev server's double `ready()` call via `RUN_MAIN`.
- **`backend/scripts/job_scraper.py`** — the scraper engine:
  - Detects known ATS platforms from `career_url` (Greenhouse, Lever, Ashby, SmartRecruiters, Workday) and pulls postings via each platform's public API; falls back to a generic BeautifulSoup heuristic scrape for custom career pages.
  - Normalizes location strings (US state / Canadian province / ISO country-code disambiguation), extracts salary/experience/job-type via regex heuristics.
  - **Geocodes missing job coordinates** via `geopy.Nominatim` (rate-limited 1.1s/query, deduped by city/state/country, pinned to `certifi`'s CA bundle for macOS SSL issues).
  - Deletes stale jobs (>7 days old, or unposted-but-scraped >7 days ago).
  - Entry points: `scrape_companies_by_names()` (manual/cron trigger) and `run_random_companies_scraping()` (auto-scrape rotation).
- **`backend/scripts/job_categorizer.py`** — rule-based title → category classifier across 16 categories (Technology, Design, Product & Project Management, Marketing, Sales, Customer Support, HR, Finance & Accounting, Business & Consulting, Operations & Administration, Legal & Compliance, Engineering, Healthcare, Education, Real Estate, Other); checks ATS-supplied department hints first.
- **`backend/scripts/ats_scoring.py`** — `score_cv`: weighted rule-based ATS score (contact info, summary, skills, experience, education, action verbs, quantified bullets, length, profession-keyword coverage from `profession_keywords.json`) → 0–100 + breakdown.
- **`backend/scripts/cv_export.py`** — renders `CustomCV.content` to PDF (`xhtml2pdf` + Django template `backend/api/templates/cv/resume.html`) or DOCX (`python-docx`).
- **`resolve_country()` / `get_device_info()`** (`views.py`) — portfolio-view geo lookup: free `ip-api.com` reverse-geo (cached 24h/IP, private IPs skipped) + `user_agents` device/browser/OS parsing, feeding `PortfolioView` and the analytics endpoint.

There's no `management/commands/` directory — all scheduled work is APScheduler-driven in-process, not OS cron or Django management commands.

### 1.3 App: `payments` — Razorpay subscription billing

- **`models.py`**: `Transaction` — `user` FK, `razorpay_order_id/payment_id/signature`, `amount` (paise), `status` (pending/success/failed).
- **`constants.py`**: `SUBSCRIPTION_PRICE_INR = 99`, `SUBSCRIPTION_PRICE_PAISE = 9900` (beta price; comment notes future plans start at ₹299).
- **Endpoints**:
  - `POST /payments/create-order/` — creates a Razorpay order + pending `Transaction`. ⚠️ **Currently hardcoded to a ₹1 testing price**, with the real ₹99 price commented out in the source — check before relying on pricing in this endpoint.
  - `POST /payments/verify-payment/` — HMAC-verifies the Razorpay signature inside a `select_for_update` transaction (idempotent against replay), extends `subscription_expires_at` by 30 days (stacking if still active), sets `is_subscribed=True`.
  - `POST /payments/check-status/` — reconciles via Razorpay's `order.payments` API for missed client-side callbacks.
  - `GET /payments/transactions/` — own transactions, or all + `?user_id=` for staff.
  - `GET /payments/admin/revenue-stats/` — total/monthly revenue, active-subscription count, total users, last 100 transactions.

Note: this is "renew on payment" billing, not true Razorpay Subscriptions — each successful order manually extends the expiry date.

### 1.4 Key third-party libraries (`backend/requirements.txt`)

Django 5.0.2, DRF 3.17.1, django-cors-headers, dj-database-url, python-dotenv, **geopy** (geocoding), **user-agents** (device parsing), python-jobspy, requests, beautifulsoup4, certifi, PyPDF2 (resume text extraction), pandas/numpy, **razorpay**, **google-auth** (Google Sign-In), **groq** (LLM), xhtml2pdf + python-docx (CV export).

---

## 2. Frontend — main app (`frontend/`)

Next.js 16 / React 19, App Router.

### 2.1 Routes (`frontend/src/app/`)

| Route | Purpose |
|---|---|
| `/` | Marketing landing page — animated globe map, live stats, recent-jobs marquee, feature spotlights, FAQ, pricing CTA |
| `/login`, `/signup` | Auth: username/password + Google Sign-In + email OTP |
| `/explore` | Main job-search app: split map/list view with resizable panel, search/filters, bookmarks |
| `/pricing` | Standalone pricing page (Razorpay flow via `PricingModal`) |
| `/profile` | User profile & resume management |
| `/applications` | Kanban application tracker (Saved / Applied / Interviewing / Offered) |
| `/custom-cv`, `/custom-cv/[id]` | AI-tailored CV list + editor/export |
| `/portfolio`, `/portfolio/[username]` | Portfolio builder (own) + public portfolio page |
| `/transactions` | User's payment history |
| `/revenue` | Revenue view embedded in the main app |
| `/terms`, `/privacy` | Static legal pages |
| `/api/otp/request/route.ts` | Next.js server route — proxies OTP requests to Django using the `OTP_INTERNAL_SECRET` bearer token, then sends the email itself via `lib/mailer.ts` (Nodemailer/SMTP) |

### 2.2 Key components (`frontend/src/components/`)

- **`Map.tsx`** + `components/ui/map.tsx` — job map on `maplibre-gl` via a `mapcn`-style `Map`/`MapMarker`/`MapClusterLayer` set (custom `@mapcn` registry, see `components.json`). Clusters below zoom 10, individual markers above; viewport-bounds filtering for perf; Haversine "Jobs Near Me" geolocation search; fly-to animation on job selection.
- **`Sidebar.tsx` / `SidebarToggle.tsx`** — persistent desktop nav rail.
- **`PricingModal.tsx`** — Razorpay checkout: creates order via backend → loads `checkout.razorpay.com` script (`lib/razorpay.ts`) → opens Razorpay checkout → verifies payment server-side → refreshes user → redirects to `/explore`.
- **`JobCard.tsx`** — job list item with bookmark toggle + status.
- **`GoogleSignInButton.tsx`** — `@react-oauth/google` `GoogleLogin`; uses a `ResizeObserver` on its container to measure width before mount (avoids re-initializing Google's iframe on resize); collects phone number post-signup since Google doesn't supply one.
- **`EmailOtpForm.tsx` / `OtpDigitInput.tsx` / `EmailVerificationGate.tsx`** — email OTP verification UI.
- **`CoverLetterModal.tsx`** — displays/generates the AI cover letter + Q&A (Job Application Kit).
- **`FeedbackModal.tsx`** — star-rating + message feedback widget.
- **`customcv/templates/`** — `AtsTemplate`, `ClassicCVTemplate`, `ModernTemplate`, `ResumeDocument` (matches backend `CV_TEMPLATE_CHOICES`).
- **`portfolio/templates/`** — `BentoTemplate`, `ClassicTemplate`, plus `PortfolioAnalyticsPanel.tsx`, `OwnerPreviewGate.tsx`, `OwnerResumeGate.tsx`.

### 2.3 State management & API access

- No Redux/Zustand/React Query — plain React Context (`context/AuthContext.tsx`, `context/SidebarContext.tsx`) + local `useState`/`useEffect`.
- Auth token stored in **`sessionStorage`** (`kaamlee_token`), sent as `Authorization: Token <token>`. No centralized API client — every page builds its own `fetch()` call against `NEXT_PUBLIC_API_URL`.
- Simple in-memory TTL cache (`_cache` + `getCached`/`setCache`, 2-minute TTL), duplicated across `page.tsx` and `explore/page.tsx` for jobs/stats/countries/categories.
- **`hooks/useSubscriptionGate.ts`** — redirects unauthenticated users to `/login`, authenticated-but-unsubscribed users to `/pricing`; gates rendering via `isReady`.
- **`lib/subscription.ts`** — `isSubscriptionActive(user)` helper.

### 2.4 Key libraries (`frontend/package.json`)

`next` 16.2.4, `react`/`react-dom` 19.2.4, `@react-oauth/google`, `maplibre-gl`, `framer-motion`, `lucide-react`, shadcn + `@base-ui/react` + `class-variance-authority`/`tailwind-merge`/`tw-animate-css` (UI system per `components.json`, custom `@mapcn` registry for map components), `nodemailer` (server-side SMTP for OTP emails).

---

## 3. Frontend Admin (`frontend-admin/`)

Next.js 16, lighter dependency set (no shadcn/map libs). Admin auth uses **`localStorage`** (`admin_token`, `admin_user`) — distinct from the main app's `sessionStorage` token; both hit the same Django token backend but through different views (`AdminLoginView` requires `is_superuser`).

### 3.1 Routes (`frontend-admin/src/app/`)

| Route | Purpose |
|---|---|
| `/login` | Admin login (superuser-only, `/api/admin-login/`) |
| `/` | Dashboard — system status, stats cards (total jobs / last success / last run), live-scrape polling every 10s (`/api/logs/`), company cards grid with per-company "Scrape" trigger + "Scrape by Company" picker (max 10), Logs modal for active/last `ScrapeSession` |
| `/companies` | Company CRUD — add/edit/delete, bulk create/delete, search, pagination |
| `/jobs` | Paginated/filterable/searchable job listing, bulk delete |
| `/revenue` | Revenue dashboard — total/monthly revenue, active subscriptions, Razorpay transaction table |
| `/users` | User management — profile details, subscription status, set-password |
| `/feedback` | User feedback list with star ratings |
| `/logs` | Live request-log viewer (search, line-count selector, auto-refresh every 5s, color-coded by status), backed by `GET /api/admin/request-logs/` |

`frontend-admin/src/lib/cache.ts` mirrors the main app's TTL cache pattern (`getCached`/`setCache`/`invalidatePrefix`) but is shared per-page rather than duplicated inline.

Scope: full operational control over the scraper, payments, and users — no content-moderation features beyond job/company deletion.

---

## 4. Integrations & environment variables

### 4.1 Integration summary

| Concern | Provider / mechanism |
|---|---|
| Payments | Razorpay — manual "renew on payment" subscription (not native Razorpay Subscriptions) |
| Auth | DRF Token auth + Google OAuth (`google-auth` / `@react-oauth/google`) + custom passwordless email-OTP (SMTP delivery) |
| AI / LLM | Groq — resume parsing → structured JSON, CV tailoring per target role, cover-letter/Q&A generation |
| Maps / Geo (frontend) | MapLibre GL + custom `mapcn` component registry |
| Maps / Geo (backend) | `geopy`/Nominatim geocoding (job coordinates) + `ip-api.com` IP geolocation (portfolio view analytics) |
| Job data source | First-party scraper hitting company career pages directly (Greenhouse/Lever/Ashby/SmartRecruiters/Workday APIs + generic HTML fallback), not third-party job-board APIs. Orchestrated by in-process APScheduler (every 5 min) plus manual/admin/CRON_SECRET-triggered runs. |

### 4.2 Environment variables (names only — see each `.env` for actual values)

**Backend (`backend/.env`)**
- `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `DATABASE_URL`
- `CRON_SECRET` — bearer auth for external cron/CI to trigger `TriggerCompanyScrapeView`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- `GROQ_API_KEY`
- `GOOGLE_CLIENT_ID` — referenced in code, not currently set in `backend/.env`
- `OTP_INTERNAL_SECRET` — shared secret between Django and the Next.js OTP proxy route; referenced in code, not currently set in `backend/.env`

**Frontend (`frontend/`)**
- `NEXT_PUBLIC_API_URL` — Django backend base URL (only one declared in `.env.local`; rest are set in the deployment env, e.g. Vercel per `vercel.json`)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `OTP_INTERNAL_SECRET` — server-side only, used by `app/api/otp/request/route.ts`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

**Frontend Admin (`frontend-admin/`)**
- `NEXT_PUBLIC_API_URL` — only env var referenced; no `.env` file present in the repo

---

## 5. Things to know before touching this code

- **Cache is per-process** (`LocMemCache`). If you scale to multiple backend workers, per-user job/stats caching will be inconsistent across workers — this isn't a bug you'll fix by clearing cache, it's an architectural limit until it moves to Redis/Memcached.
- **Scraper concurrency is guarded by a file lock** (`/tmp/kaamlee_autoscrape.lock`), not a DB lock — this only works when all workers share the same filesystem (breaks across multiple hosts without a shared volume).
- **Payments endpoint has a hardcoded test price** (`create-order/` uses ₹1, not the real ₹99 constant) — check `backend/payments/views.py` before assuming pricing is live-correct.
- **No centralized frontend API client** — auth headers, base URL, and caching are hand-rolled per page in `frontend/`. When adding a new endpoint call, follow the existing per-page `fetch()` + `getCached`/`setCache` pattern rather than introducing a new abstraction mid-file.
- **Two separate token stores**: main app uses `sessionStorage`, admin uses `localStorage` — don't assume a token from one is valid context for the other's key.
- **No Django management commands** for scraping — it's all in-process APScheduler. Manual runs go through the API endpoints (`/api/trigger-company-scrape/`), not `manage.py`.
