'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  Play,
  RefreshCcw,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Terminal,
  X,
  AlertTriangle,
  LogOut,
  Globe,
  Mail,
  MapPin,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;
const COMPANIES_PAGE_SIZE = 20;

interface ScrapeSession {
  id: number;
  start_time: string;
  end_time: string | null;
  status: string;
  jobs_found: number;
  jobs_deleted: number;
  current_location: string | null;
  error_message: string | null;
  stop_requested: boolean;
  search_term: string;
  results_limit: number;
}


interface Stats {
  total_jobs: number;
  last_scrape_session: (ScrapeSession & { search_term: string; results_limit: number }) | null;
  jobs_by_site: { site: string; count: number }[];
}

interface CompanyJob {
  id: number;
  title: string;
  location_name: string;
  is_remote: boolean;
  job_url: string;
  date_posted: string | null;
  experience_required: string | null;
  salary: string | null;
}

interface RecentJob {
  id: number;
  title: string;
  company: string;
  location_name: string;
  is_remote: boolean;
  category: string;
}

interface Company {
  id: number;
  name: string;
  domain: string;
  career_url: string;
  contact_url: string;
  contact_email: string;
  address: string;
  linkedin_url: string;
  logo_url: string;
  is_active: boolean;
  last_scraped_at: string | null;
  job_count: number;
  jobs: CompanyJob[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesCount, setCompaniesCount] = useState(0);
  const [companiesPage, setCompaniesPage] = useState(1);
  const [pickerCompanies, setPickerCompanies] = useState<Company[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [activeSessions, setActiveSessions] = useState<ScrapeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringCompany, setTriggeringCompany] = useState(false);
  const [triggeringCompanyName, setTriggeringCompanyName] = useState<string | null>(null);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isCompanyPickerOpen, setIsCompanyPickerOpen] = useState(false);
  const router = useRouter();
  // Tracks whether a scrape is active, so we know when one just finished
  const isScrapingRef = React.useRef(false);

  const companiesTotalPages = Math.max(1, Math.ceil(companiesCount / COMPANIES_PAGE_SIZE));

  const fetchCompanies = async (page: number) => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/companies/?page=${page}`, { headers: { 'Authorization': `Token ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.results);
        setCompaniesCount(data.count);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  // Unpaginated, only for the "Scrape by Company" picker — it needs every
  // company to choose from, not just the current dashboard page.
  const fetchPickerCompanies = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/companies/?page_size=500`, { headers: { 'Authorization': `Token ${token}` } });
      if (res.ok) {
        setPickerCompanies((await res.json()).results);
      }
    } catch (error) {
      console.error('Failed to fetch picker companies:', error);
    }
  };

  useEffect(() => {
    fetchCompanies(companiesPage);
  }, [companiesPage]);

  const fetchData = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      const statsRes = await fetch(`${API_BASE}/stats/`, {
        headers: { 'Authorization': `Token ${token}` }
      });

      if (statsRes.status === 401) {
        localStorage.removeItem('admin_token');
        router.push('/login');
        return;
      }

      if (!statsRes.ok) {
        throw new Error('Backend responded with an error');
      }

      const statsData = await statsRes.json();
      setStats(statsData);

      // Fetch companies (career-page scrape targets + their scraped jobs)
      await Promise.all([fetchCompanies(companiesPage), fetchPickerCompanies()]);

      // Fetch recent jobs for the marquee
      const recentJobsRes = await fetch(`${API_BASE}/recent-jobs/?limit=15`);
      if (recentJobsRes.ok) {
        setRecentJobs(await recentJobsRes.json());
      }

      // Fetch active sessions for scrape status display
      const logsRes = await fetch(`${API_BASE}/logs/`, { headers: { 'Authorization': `Token ${token}` } });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setActiveSessions(logsData.active_sessions ?? []);
        isScrapingRef.current = (logsData.active_sessions?.length ?? 0) > 0;
      } else {
        isScrapingRef.current = statsData.last_scrape_session?.status === 'running';
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchData();

    // Always checks /logs/ (cheap) so we also notice scrapes kicked off elsewhere
    // (e.g. the auto-scrape cron) — not just ones triggered from this tab — and
    // refresh companies/stats the moment any of them finishes.
    const pollStats = async () => {
      const t = localStorage.getItem('admin_token');
      if (!t) return;
      try {
        const logsRes = await fetch(`${API_BASE}/logs/`, { headers: { 'Authorization': `Token ${t}` } });
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          const sessions: ScrapeSession[] = logsData.active_sessions ?? [];
          setActiveSessions(sessions);
          const wasScraping = isScrapingRef.current;
          isScrapingRef.current = sessions.length > 0;
          if (wasScraping && sessions.length === 0) {
            fetchData();
          }
        }
      } catch {
        // silently ignore poll errors
      }
    };

    const interval = setInterval(pollStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/login');
  };

  const triggerCompanyScrape = async (names: string[]) => {
    const token = localStorage.getItem('admin_token');
    setTriggeringCompany(true);
    try {
      const res = await fetch(`${API_BASE}/trigger-company-scrape/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: names })
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.status || errorData.error || "Failed to trigger company scrape");
        return;
      }

      setIsCompanyPickerOpen(false);
      isScrapingRef.current = true;
      setTimeout(fetchData, 800);
    } catch (error) {
      alert("Failed to trigger company scrape");
    } finally {
      setTriggeringCompany(false);
    }
  };

  const triggerCompanyScrapeOne = async (name: string) => {
    const token = localStorage.getItem('admin_token');
    setTriggeringCompanyName(name);
    try {
      const res = await fetch(`${API_BASE}/trigger-company-scrape/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: [name] })
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.status || errorData.error || `Failed to trigger scrape for ${name}`);
        return;
      }

      isScrapingRef.current = true;
      setTimeout(fetchData, 800);
    } catch (error) {
      alert(`Failed to trigger scrape for ${name}`);
    } finally {
      setTriggeringCompanyName(null);
    }
  };

  const stopScrape = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      await fetch(`${API_BASE}/stop-scrape/`, { 
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });
      alert("Stop request sent. Scraper will stop after current city.");
      fetchData();
    } catch (error) {
      alert("Failed to stop scrape");
    }
  };

  const forceStopScrape = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      await fetch(`${API_BASE}/force-reset/`, { 
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });
      alert("Force stopped all running sessions.");
      fetchData();
    } catch (error) {
      alert("Failed to force stop scrape");
    }
  };


  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white p-8">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Connection Error</h1>
        <p className="text-[#888] mb-6 text-center max-w-md">
          Could not connect to the backend server. Please make sure the Django server is running at {API_BASE}.
        </p>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="bg-[#111] border border-[#222] px-6 py-2 rounded-xl hover:bg-[#161616] transition-all flex items-center gap-2"
        >
          <RefreshCcw size={18} />
          Retry Connection
        </button>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            {/* <img src="/logo.png" alt="Kaamlee Logo" className="h-10 w-auto" /> */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Scraper Admin</h1>
              <p className="text-[#888] flex items-center gap-2">

              <LayoutDashboard size={16} />
              System Status:
              <span className={activeSessions.length > 0 ? 'text-blue-400' : 'text-green-400'}>
                {activeSessions.length > 0
                  ? `${activeSessions.length} session${activeSessions.length > 1 ? 's' : ''} running`
                  : 'Idle'}
              </span>
              </p>
            </div>
          </div>


          <div className="flex items-center gap-4">
            <button
              onClick={fetchData}
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all"
              title="Refresh Data"
            >
              <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setIsLogsModalOpen(true)}
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all text-[#888] hover:text-white"
              title="Scrape Session Status"
            >
              <Terminal size={20} />
            </button>

            {activeSessions.length > 0 ? (
              activeSessions.some(s => s.stop_requested) ? (
                <button
                  onClick={forceStopScrape}
                  className="cursor-pointer bg-red-800 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-red-900/50"
                  title="Force stop the stuck session"
                >
                  <AlertTriangle size={18} />
                  Force Stop
                </button>
              ) : (
                <button
                  onClick={stopScrape}
                  className="cursor-pointer bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-red-500/20"
                >
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Stop All
                </button>
              )
            ) : (
              <button
                onClick={() => setIsCompanyPickerOpen(true)}
                disabled={triggeringCompany}
                className="cursor-pointer bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20"
                title="Scrape jobs from company career pages (scripts/companies.json)"
              >
                {triggeringCompany ? <Loader2 size={18} className="animate-spin" /> : <Building2 size={18} />}
                Scrape by Company
              </button>
            )}

            <button
              onClick={handleLogout}
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500 transition-all text-[#888]"
              title="Logout"
            >
              <LogOut size={20} />
            </button>

          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard
            icon={<Briefcase className="text-blue-500" />}
            label="Total Jobs"
            value={stats?.total_jobs.toLocaleString() || '0'}
          />
          <StatCard
            icon={<CheckCircle2 className="text-green-500" />}
            label="Last Success"
            value={stats?.last_scrape_session?.jobs_found ? `+ ${stats.last_scrape_session.jobs_found} jobs` : 'no jobs found'}
          />
          <StatCard
            icon={<AlertCircle className="text-orange-500" />}
            label="Last Run"
            value={stats?.last_scrape_session?.start_time ? new Date(stats.last_scrape_session.start_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' IST' : 'Never'}
          />
        </div>

        {recentJobs.length > 0 && (
          <div className="relative overflow-hidden rounded-2xl border border-[#222] bg-[#111] mb-12 py-4 [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
            <div className="flex w-max gap-10 animate-marquee">
              {[...recentJobs, ...recentJobs].map((job, i) => (
                <div key={`${job.id}-${i}`} className="flex items-center gap-2.5 text-sm shrink-0 whitespace-nowrap">
                  <Briefcase size={14} className="text-blue-500 shrink-0" />
                  <span className="font-bold text-white">{job.title}</span>
                  <span className="text-[#555]">@ {job.company}</span>
                  {(job.location_name || job.is_remote) && (
                    <span className="text-[#444]">• {job.is_remote ? 'Remote' : job.location_name}</span>
                  )}
                  <span className="w-1 h-1 rounded-full bg-[#333] ml-6" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            Companies {companiesCount > 0 && <span className="text-[#555] font-medium">({companiesCount})</span>}
          </h2>
          <Link href="/companies" className="text-sm font-semibold text-purple-400 hover:text-purple-300 transition-colors">
            Manage all companies →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {companies.map(company => (
            <CompanyCard
              key={company.id}
              company={company}
              scraping={triggeringCompanyName === company.name}
              onScrape={() => triggerCompanyScrapeOne(company.name)}
            />
          ))}
        </div>

        {companies.length === 0 && (
          <div className="p-20 text-center text-[#555]">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No companies configured. <Link href="/companies" className="text-purple-400 hover:underline">Add one</Link>.</p>
          </div>
        )}

        {companiesCount > 0 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-[#555] font-medium">
              Page {companiesPage} of {companiesTotalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCompaniesPage(p => Math.max(1, p - 1))}
                disabled={companiesPage <= 1}
                className="cursor-pointer p-2.5 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setCompaniesPage(p => Math.min(companiesTotalPages, p + 1))}
                disabled={companiesPage >= companiesTotalPages}
                className="cursor-pointer p-2.5 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isLogsModalOpen && <LogsModal onClose={() => setIsLogsModalOpen(false)} stats={stats} activeSessions={activeSessions} />}
        {isCompanyPickerOpen && (
          <CompanyPickerModal
            onClose={() => setIsCompanyPickerOpen(false)}
            onStart={triggerCompanyScrape}
            loading={triggeringCompany}
            companies={pickerCompanies}
          />
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 60s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}


function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) {
  return (
    <div className="bg-[#111] border border-[#222] p-6 rounded-3xl hover:border-[#333] transition-all">
      <div className="w-10 h-10 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mb-4">
        {icon}
      </div>
      <div className="text-xs text-[#555] font-medium uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function CompanyCard({ company, scraping, onScrape }: { company: Company, scraping: boolean, onScrape: () => void }) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-3xl p-6 hover:border-purple-500/40 transition-all flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {company.logo_url ? (
            <img src={company.logo_url} alt="" className="w-9 h-9 rounded-xl object-contain bg-white shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-xs font-bold text-[#555] shrink-0">
              {company.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold truncate">{company.name}</h3>
              {!company.is_active && (
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#222] text-[#666]">Inactive</span>
              )}
            </div>
            {company.domain && <p className="text-xs text-[#555] font-medium truncate">{company.domain}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-center px-3 py-1.5 rounded-xl bg-[#1a1a1a]">
            <div className="text-lg font-black leading-none">{company.job_count}</div>
            <div className="text-[9px] uppercase tracking-widest text-[#555] font-bold">Jobs</div>
          </div>
          <button
            onClick={onScrape}
            disabled={scraping}
            title={`Scrape ${company.name}'s career page`}
            className="cursor-pointer p-2.5 rounded-xl bg-purple-600/15 border border-purple-500/30 text-purple-400 hover:bg-purple-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {scraping ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-xs">
        {company.career_url && (
          <a href={company.career_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#888] hover:text-blue-400 transition-colors truncate">
            <Globe size={13} className="shrink-0" /> <span className="truncate">Career page</span> <ExternalLink size={11} className="shrink-0" />
          </a>
        )}
        {company.contact_url && (
          <a href={company.contact_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#888] hover:text-blue-400 transition-colors truncate">
            <ExternalLink size={13} className="shrink-0" /> <span className="truncate">Contact page</span>
          </a>
        )}
        {company.contact_email && (
          <a href={`mailto:${company.contact_email}`} className="flex items-center gap-2 text-[#888] hover:text-blue-400 transition-colors truncate">
            <Mail size={13} className="shrink-0" /> <span className="truncate">{company.contact_email}</span>
          </a>
        )}
        {company.address && (
          <div className="flex items-center gap-2 text-[#888] truncate">
            <MapPin size={13} className="shrink-0" /> <span className="truncate">{company.address}</span>
          </div>
        )}
        {company.linkedin_url && (
          <a href={company.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#888] hover:text-blue-400 transition-colors truncate">
            <ExternalLink size={13} className="shrink-0" /> <span className="truncate">LinkedIn</span>
          </a>
        )}
      </div>

      <div className="pt-4 border-t border-[#222] flex-1 min-h-0">
        {company.jobs.length === 0 ? (
          <p className="text-xs text-[#444] text-center py-4">No jobs scraped yet.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {company.jobs.map(job => (
              <a
                key={job.id}
                href={job.job_url}
                target="_blank"
                rel="noreferrer"
                className="block p-3 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] hover:border-blue-500/40 transition-all"
              >
                <div className="text-sm font-semibold truncate">{job.title}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] text-[#555]">
                  {(job.location_name || job.is_remote) && (
                    <span className="flex items-center gap-1"><MapPin size={10} /> {job.is_remote ? 'Remote' : job.location_name}</span>
                  )}
                  {job.salary && <span className="text-green-500/80">{job.salary}</span>}
                  {job.experience_required && <span>{job.experience_required}</span>}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// search_term encodes the full requested company list as "company_career_pages:Name1,Name2" —
// parse it out so the UI can show all of them, not just the single current_location field.
function parseCompanyList(searchTerm: string | undefined | null): string[] | null {
  if (!searchTerm || !searchTerm.startsWith('company_career_pages:')) return null;
  const rest = searchTerm.slice('company_career_pages:'.length);
  if (!rest || rest === 'auto') return null;
  return rest.split(',').map(s => s.trim()).filter(Boolean);
}

function LogsModal({ onClose, stats, activeSessions }: { onClose: () => void, stats: Stats | null, activeSessions: ScrapeSession[] }) {
  const session = stats?.last_scrape_session ?? null;

  const isRunning = activeSessions.length > 0;

  const duration = React.useMemo(() => {
    if (!session?.start_time) return null;
    const start = new Date(session.start_time).getTime();
    const end = session.end_time ? new Date(session.end_time).getTime() : Date.now();
    const secs = Math.floor((end - start) / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
  }, [session?.start_time, session?.end_time]);

  const statusColor: Record<string, string> = {
    running: 'text-blue-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
    stopped: 'text-orange-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#111] border border-[#333] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333] bg-[#1a1a1a]">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Terminal size={20} className="text-blue-500" />
            Last Scrape Session
          </h2>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-[#333] rounded-lg transition-colors text-[#888] hover:text-white">
            <X size={20} />
          </button>
        </div>

        {isRunning ? (
          <div className="p-6 flex flex-col gap-3">
            <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#555] mb-1">{activeSessions.length} parallel sessions</p>
            {activeSessions.map(s => {
              const companyList = parseCompanyList(s.search_term);
              return (
                <div key={s.id} className="bg-black border border-[#222] rounded-xl p-4 flex flex-col gap-2 font-mono text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold">
                      {companyList
                        ? `Scraping ${companyList.length} compan${companyList.length > 1 ? 'ies' : 'y'}`
                        : s.search_term?.includes(':auto') ? 'Auto-scrape (random selection)' : s.search_term}
                    </span>
                    <span className="text-blue-400 flex items-center gap-1.5 text-xs">
                      <Loader2 size={11} className="animate-spin" /> running
                    </span>
                  </div>
                  {companyList && (
                    <div className="flex flex-wrap gap-1.5">
                      {companyList.map(name => (
                        <span
                          key={name}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            name === s.current_location ? 'bg-blue-500/20 text-blue-300' : 'bg-[#1a1a1a] text-[#666]'
                          }`}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.current_location && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#555]">Currently scraping</span>
                      <span className="text-blue-300">{s.current_location}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-[#555]">Jobs found</span>
                    <span className="text-green-400 font-bold">{s.jobs_found}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !session ? (
          <div className="p-12 text-center text-[#555] font-mono text-sm">
            No scrape sessions yet.
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-6">
            <div>
              <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#555] mb-3">Last Session</p>
              <div className="bg-black border border-[#222] rounded-xl p-4 flex flex-col gap-2 font-mono text-sm">
                {(() => {
                  const companyList = parseCompanyList(session.search_term);
                  return (
                    <div className="flex justify-between gap-4">
                      <span className="text-[#555] shrink-0">{companyList ? 'Companies' : 'Search term'}</span>
                      <span className="text-white font-semibold text-right">
                        {companyList
                          ? companyList.join(', ')
                          : session.search_term?.includes(':auto') ? 'Auto-scrape (random selection)' : (session.search_term ?? '—')}
                      </span>
                    </div>
                  );
                })()}
                <div className="flex justify-between items-center">
                  <span className="text-[#555]">Status</span>
                  <span className={`font-bold uppercase tracking-widest ${statusColor[session.status] ?? 'text-[#aaa]'}`}>
                    {session.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555]">Jobs found</span>
                  <span className="text-green-400 font-bold">{session.jobs_found}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555]">Jobs deleted</span>
                  <span className="text-red-400 font-bold">{session.jobs_deleted}</span>
                </div>
                {duration && (
                  <div className="flex justify-between">
                    <span className="text-[#555]">Duration</span>
                    <span className="text-[#aaa]">{duration}</span>
                  </div>
                )}
                {session.error_message && (
                  <div className="mt-2 p-3 bg-red-950/30 border border-red-900/40 rounded-lg text-red-400 text-xs break-words">
                    {session.error_message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function CompanyPickerModal({ onClose, onStart, loading, companies }: {
  onClose: () => void;
  onStart: (names: string[]) => void;
  loading: boolean;
  companies: Company[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const MAX = 10;

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else if (next.size < MAX) next.add(name);
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#111] border border-[#333] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-[#333] bg-[#1a1a1a] rounded-t-3xl shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 size={20} className="text-purple-500" />
            Select Companies to Scrape
          </h2>
          <p className="text-sm text-[#555] mt-1">
            {selected.size === 0 ? 'Pick up to 3 companies to scrape their career pages.' : `${selected.size} / ${MAX} selected`}
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex flex-wrap gap-2">
            {companies.map(company => {
              const active = selected.has(company.name);
              const maxed = !active && selected.size >= MAX;
              return (
                <button
                  key={company.name}
                  onClick={() => toggle(company.name)}
                  disabled={maxed}
                  className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5 ${
                    active
                      ? 'bg-purple-600/15 border-purple-500/50 text-purple-400'
                      : maxed
                      ? 'bg-[#0a0a0a] border-[#1a1a1a] text-[#2a2a2a] cursor-not-allowed'
                      : 'bg-[#0a0a0a] border-[#222] text-[#555] hover:border-[#333] hover:text-[#888]'
                  }`}
                >
                  {company.name}
                  <span className={`text-[10px] font-bold ${active ? 'text-purple-300' : maxed ? 'text-[#2a2a2a]' : 'text-[#444]'}`}>
                    {company.job_count}
                  </span>
                </button>
              );
            })}
          </div>

          {companies.length === 0 && (
            <p className="text-xs text-[#555] text-center py-6">No companies configured in scripts/companies.json.</p>
          )}
        </div>

        <div className="p-6 bg-[#1a1a1a] border-t border-[#333] flex gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="cursor-pointer flex-1 py-3 rounded-xl bg-[#222] hover:bg-[#2a2a2a] font-bold transition-all">
            Cancel
          </button>
          <button
            disabled={loading || selected.size === 0}
            onClick={() => onStart(Array.from(selected))}
            className="cursor-pointer flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            Scrape {selected.size > 0 ? `${selected.size} compan${selected.size > 1 ? 'ies' : 'y'}` : ''}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

