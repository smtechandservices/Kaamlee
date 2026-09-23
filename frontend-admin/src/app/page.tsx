'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  RefreshCcw,
  Briefcase,
  Users as UsersIcon,
  AlertCircle,
  Loader2,
  Globe,
  Mail,
  MapPin,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCached, setCache } from '@/lib/cache';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;
// Dashboard only previews the most recently scraped companies; the full
// list lives on /companies.
const DASHBOARD_COMPANIES = 3;

interface Stats {
  total_jobs: number;
  scraped_jobs?: number;
  published_postings?: number;
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

function formatRelativeScrapedAt(value: string | null) {
  if (!value) return 'never scraped';
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'scraped just now';
  if (minutes < 60) return `scraped ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `scraped ${hours} hr${hours !== 1 ? 's' : ''} ago`;
  const days = Math.round(hours / 24);
  return `scraped ${days} day${days !== 1 ? 's' : ''} ago`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesCount, setCompaniesCount] = useState(0);
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchCompanies = async (force = false) => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    const cacheKey = 'company-data:dashboard:recent';
    if (!force) {
      const cached = getCached<{ results: Company[]; count: number }>(cacheKey);
      if (cached) {
        setCompanies(cached.results);
        setCompaniesCount(cached.count);
        return;
      }
    }
    try {
      const res = await fetch(`${API_BASE}/companies/?page_size=${DASHBOARD_COMPANIES}`, { headers: { 'Authorization': `Token ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.results);
        setCompaniesCount(data.count);
        setCache(cacheKey, data);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchData = async (force = false) => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      let statsData = force ? null : getCached<Stats>('job-data:dashboard:stats');
      if (!statsData) {
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

        statsData = await statsRes.json();
        setCache('job-data:dashboard:stats', statsData);
      }
      setStats(statsData);

      await fetchCompanies(force);

      let usersCountData = force ? null : getCached<number>('job-data:dashboard:users-count');
      if (usersCountData == null) {
        const usersRes = await fetch(`${API_BASE}/users/`, { headers: { 'Authorization': `Token ${token}` } });
        if (usersRes.ok) {
          usersCountData = (await usersRes.json()).length;
          setCache('job-data:dashboard:users-count', usersCountData);
        }
      }
      if (usersCountData != null) setUsersCount(usersCountData);

      let recentJobsData = force ? null : getCached<RecentJob[]>('job-data:dashboard:recent');
      if (!recentJobsData) {
        const recentJobsRes = await fetch(`${API_BASE}/recent-jobs/?limit=15`);
        if (recentJobsRes.ok) {
          recentJobsData = await recentJobsRes.json();
          setCache('job-data:dashboard:recent', recentJobsData);
        }
      }
      if (recentJobsData) setRecentJobs(recentJobsData);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex flex-col items-center justify-center text-[#0b0b0c] p-8">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Connection Error</h1>
        <p className="text-[#0b0b0c]/40 mb-6 text-center max-w-md">
          Could not connect to the backend server. Please make sure the Django server is running at {API_BASE}.
        </p>
        <button
          onClick={() => { setLoading(true); fetchData(true); }}
          className="bg-white border border-black/[0.08] px-6 py-2 rounded-xl hover:bg-black/[0.03] transition-all flex items-center gap-2"
        >
          <RefreshCcw size={18} />
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
            <p className="text-[#0b0b0c]/40">Overview of jobs, companies, and users.</p>
          </div>

          <button
            onClick={() => fetchData(true)}
            className="cursor-pointer p-3 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] transition-all self-start md:self-auto"
            title="Refresh Data"
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard
            icon={<Briefcase className="text-green-600" />}
            label="Total Jobs"
            value={stats?.total_jobs.toLocaleString() || '0'}
            sub={stats?.scraped_jobs != null && stats.published_postings != null
              ? `${stats.scraped_jobs.toLocaleString()} scraped · ${stats.published_postings.toLocaleString()} published postings`
              : undefined}
          />
          <StatCard
            icon={<Building2 className="text-purple-500" />}
            label="Total Companies"
            value={companiesCount.toLocaleString()}
          />
          <StatCard
            icon={<UsersIcon className="text-green-500" />}
            label="Total Users"
            value={usersCount != null ? usersCount.toLocaleString() : '—'}
          />
        </div>

        {recentJobs.length > 0 && (
          <div className="relative overflow-hidden rounded-2xl border border-black/[0.08] bg-white mb-12 py-4 [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
            <div className="flex w-max gap-10 animate-marquee">
              {[...recentJobs, ...recentJobs].map((job, i) => (
                <div key={`${job.id}-${i}`} className="flex items-center gap-2.5 text-sm shrink-0 whitespace-nowrap">
                  <Briefcase size={14} className="text-green-600 shrink-0" />
                  <span className="font-bold text-[#0b0b0c]">{job.title}</span>
                  <span className="text-[#0b0b0c]/60">@ {job.company}</span>
                  {(job.location_name || job.is_remote) && (
                    <span className="text-[#0b0b0c]/70">• {job.is_remote ? 'Remote' : job.location_name}</span>
                  )}
                  <span className="w-1 h-1 rounded-full bg-black/[0.08] ml-6" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            Companies {companiesCount > 0 && <span className="text-[#0b0b0c]/60 font-medium">({companiesCount})</span>}
          </h2>
          <Link href="/companies" className="text-sm font-semibold text-purple-600 hover:text-purple-600 transition-colors">
            Manage all companies →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {companies.map(company => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>

        {companies.length === 0 && (
          <div className="p-20 text-center text-[#0b0b0c]/60">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No companies configured. <Link href="/companies" className="text-purple-600 hover:underline">Add one</Link>.</p>
          </div>
        )}

      </div>

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

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode, label: string, value: string | number, sub?: string }) {
  return (
    <div className="bg-white border border-black/[0.08] p-6 rounded-3xl hover:border-black/[0.12] transition-all">
      <div className="w-10 h-10 rounded-2xl bg-black/[0.04] flex items-center justify-center mb-4">
        {icon}
      </div>
      <div className="text-xs text-[#0b0b0c]/60 font-medium uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-[#0b0b0c]/55 mt-1">{sub}</div>}
    </div>
  );
}

function CompanyCard({ company }: { company: Company }) {
  return (
    <div className="bg-white border border-black/[0.08] rounded-3xl p-6 hover:border-purple-500/40 transition-all flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {company.logo_url ? (
            <img src={company.logo_url} alt="" className="w-9 h-9 rounded-xl object-contain bg-white shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-black/[0.04] flex items-center justify-center text-xs font-bold text-[#0b0b0c]/60 shrink-0">
              {company.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold truncate">{company.name}</h3>
              {!company.is_active && (
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/[0.05] text-[#0b0b0c]/55">Inactive</span>
              )}
            </div>
            {company.domain && <p className="text-xs text-[#0b0b0c]/60 font-medium truncate">{company.domain}</p>}
            <div className="flex items-center gap-1 text-[11px] text-[#0b0b0c]/60 mt-0.5">
              <Clock size={11} className="shrink-0" />
              <span className="truncate">{formatRelativeScrapedAt(company.last_scraped_at)}</span>
            </div>
          </div>
        </div>
        <div className="text-center px-3 py-1.5 rounded-xl bg-black/[0.04] shrink-0">
          <div className="text-lg font-black leading-none">{company.job_count}</div>
          <div className="text-[9px] uppercase tracking-widest text-[#0b0b0c]/60 font-bold">Jobs</div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-xs">
        {company.career_url && (
          <a href={company.career_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#0b0b0c]/40 hover:text-green-600 transition-colors truncate">
            <Globe size={13} className="shrink-0" /> <span className="truncate">Career page</span> <ExternalLink size={11} className="shrink-0" />
          </a>
        )}
        {company.contact_url && (
          <a href={company.contact_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#0b0b0c]/40 hover:text-green-600 transition-colors truncate">
            <ExternalLink size={13} className="shrink-0" /> <span className="truncate">Contact page</span>
          </a>
        )}
        {company.contact_email && (
          <a href={`mailto:${company.contact_email}`} className="flex items-center gap-2 text-[#0b0b0c]/40 hover:text-green-600 transition-colors truncate">
            <Mail size={13} className="shrink-0" /> <span className="truncate">{company.contact_email}</span>
          </a>
        )}
        {company.address && (
          <div className="flex items-center gap-2 text-[#0b0b0c]/40 truncate">
            <MapPin size={13} className="shrink-0" /> <span className="truncate">{company.address}</span>
          </div>
        )}
        {company.linkedin_url && (
          <a href={company.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#0b0b0c]/40 hover:text-green-600 transition-colors truncate">
            <ExternalLink size={13} className="shrink-0" /> <span className="truncate">LinkedIn</span>
          </a>
        )}
      </div>

      <div className="pt-4 border-t border-black/[0.08] flex-1 min-h-0">
        {company.jobs.length === 0 ? (
          <p className="text-xs text-[#0b0b0c]/70 text-center py-4">No jobs yet.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {company.jobs.map(job => (
              <a
                key={job.id}
                href={job.job_url}
                target="_blank"
                rel="noreferrer"
                className="block p-3 rounded-xl bg-black/[0.03] border border-black/[0.08] hover:border-green-600/40 transition-all"
              >
                <div className="text-sm font-semibold truncate">{job.title}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] text-[#0b0b0c]/60">
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
