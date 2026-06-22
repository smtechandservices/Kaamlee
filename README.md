# Kaamlee: Job Applying is a Job

Kaamlee is a high-performance job aggregation platform that simplifies the job search process by consolidating listings from over 12 major job boards into a single, interactive map-based interface. It features real-time scraping, AI-powered resume matching, and a robust admin control panel.

---

## 🚀 Core Features

### 1. Interactive Job Map
- **Visual Exploration**: Pan and zoom across a global map to find roles plotted where they are physically located.
- **Cluster Visualization**: Large numbers of jobs are grouped into clusters for better performance and readability.
- **Real-Time Data**: Live listings updated every 15 minutes.

### 2. AI-Powered Resume Matching
- **Semantic Analysis**: Upload your resume to have our AI engine parse your experience.
- **Match Score**: Every job listing displays a real-time match percentage (e.g., "89.4% Match") based on your profile DNA.
- **Automated Extraction**: No manual data entry; the AI handles skill extraction and title weighting.

### 3. Automated Scraper Engine
- **Multi-Source Aggregation**: Polls LinkedIn, Indeed, Google, Wellfound, ZipRecruiter, YC, and more.
- **De-duplication**: Listings are fingerprinted and de-duped by hash to ensure no "ghost" or duplicate entries.
- **Session Tracking**: Monitor active scraping sessions, logs, and success rates.

### 4. Premium Subscription Model
- **All-Access Pass**: One flat fee for unlimited access to the map and AI features.
- **Secure Payments**: Integrated with Razorpay for seamless transaction handling.
- **Instant Activation**: Subscriptions are verified and activated immediately upon payment.

### 5. Admin Control Center
- **Scraper Management**: Trigger, stop, or reset the scraper engine manually.
- **User Analytics**: Monitor user growth, subscription status, and revenue.
- **Live Logs**: Real-time streaming of scraper logs for debugging and monitoring.

---

## 🏗 Architecture & Tech Stack

### Frontend
- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Styling**: Tailwind CSS with custom Design System
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Mapping**: Custom Map component with MapLibre/Mapbox integration

### Backend
- **Framework**: [Django](https://www.djangoproject.com/) & [Django REST Framework](https://www.django-rest-framework.org/)
- **Task Scheduling**: [Django APScheduler](https://github.com/jcass77/django-apscheduler) for periodic scraping tasks.
- **Scraping Logic**: Custom `scraper_utils` using modern scraping libraries.
- **Authentication**: Token-based authentication for secure API access.

### Infrastructure
- **Database**: SQLite (Development) / PostgreSQL (Production)
- **Payments**: Razorpay API
- **Environment**: Environment-driven configuration for API keys and secrets.

---

## 🔄 Data Flow

1. **Extraction Phase**: `APScheduler` triggers `scraper_utils.py` → Fetches HTML/JSON from 12+ job boards → Parsed into structured data → Saved to `Job` and `Location` models.
2. **AI Matching Phase**: User uploads Resume → `api/resumes/` handles storage → AI parses text → On `explore` request, backend calculates match scores against current jobs.
3. **Delivery Phase**: Frontend requests `GET /api/jobs/` → Backend returns GeoJSON-like data → Map component renders markers.
4. **Transaction Phase**: User clicks "Unlock" → Frontend calls `POST /api/payments/create-order/` → Razorpay Modal opens → Success callback triggers `POST /api/payments/verify-payment/` → Profile updated to `is_subscribed=True`.

---

## 📊 Data Models

### `Profile`
Extension of the default Django User model.
- `user`: One-to-one link to Auth User.
- `phone`: Contact number.
- `resume`: FileField for PDF/DOCX storage.
- `resume_text`: Parsed text for AI matching.
- `is_subscribed`: Boolean flag for premium access.
- `subscription_expires_at`: Expiry timestamp.

### `Job`
The core data entity.
- `title`, `company`, `location_name`: Basic details.
- `location`: ForeignKey to `Location` model.
- `job_url`: Original source link.
- `site`: Source platform (e.g., LinkedIn).
- `is_remote`: Boolean flag.
- `date_posted`: Original posting date.

### `ScrapeSession`
Monitoring for the background engine.
- `status`: running, completed, failed.
- `jobs_found`: Count of new jobs discovered.
- `current_location`: Location being processed.
- `search_term`: The keyword being scraped.

### `Transaction`
- `user`: Link to payer.
- `razorpay_order_id`: Link to Razorpay system.
- `status`: pending, success, failed.
- `amount`: Transaction value.

---

## 🔌 API Documentation

### Authentication & Profile
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/signup/` | `POST` | Create a new user account. |
| `/api/login/` | `POST` | Obtain Auth Token. |
| `/api/user/` | `GET/PATCH` | Get or update current user profile & resume. |
| `/api/admin-login/` | `POST` | Dedicated login for administrative access. |

### Jobs & Discovery
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/jobs/` | `GET` | List jobs with filters (search, location, remote). |
| `/api/recent-jobs/` | `GET` | Fetch the latest 10-20 jobs for marquee/landing. |
| `/api/locations/` | `GET` | Get all locations with job counts for map markers. |
| `/api/check-existence/` | `POST` | Utility to check if a job hash already exists in DB. |

### Scraper & Admin
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/stats/` | `GET` | Aggregated stats (total jobs, companies, uptime). |
| `/api/logs/` | `GET` | Fetch logs from the latest `ScrapeSession`. |
| `/api/trigger-scrape/` | `POST` | Manually start the background scraper. |
| `/api/stop-scrape/` | `POST` | Request an active scraper session to halt. |
| `/api/force-reset/` | `POST` | Wipe active sessions and reset scraper state. |

### Payments (Razorpay)
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/payments/create-order/` | `POST` | Initialize a new Razorpay order. |
| `/api/payments/verify-payment/` | `POST` | Verify signature and activate subscription. |
| `/api/payments/check-status/` | `GET` | Check if the current user has an active payment. |
| `/api/payments/admin/revenue-stats/` | `GET` | Admin-only revenue dashboard data. |

---

## 🛠 Setup & Installation

### Backend Setup
1. `cd backend`
2. `python -m venv venv`
3. `source venv/bin/activate`
4. `pip install -r requirements.txt`
5. Create `.env` file with `SECRET_KEY`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET`.
6. `python manage.py migrate`
7. `python manage.py runserver`

### Frontend Setup
1. `cd frontend` (or `frontend-admin`)
2. `npm install`
3. Create `.env.local` with `NEXT_PUBLIC_API_URL`.
4. `npm run dev`

---

## 👥 Credits

Developed with ❤️ by **SM Tech**.
- **Satya**: [LinkedIn](https://www.linkedin.com/in/satyakant-mishra-958847203/)
- **Mayank**: [LinkedIn](https://www.linkedin.com/in/pruthimayank/)
- **Rajat**: [LinkedIn](https://www.linkedin.com/in/rajat-kumar-dabas/)

*Payments handled by Commhawk.*
