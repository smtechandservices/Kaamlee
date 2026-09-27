'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ScanSearch,
  Loader2,
  ExternalLink,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Info,
  MapPin,
  Building2,
  Calendar,
  Search,
  Shuffle,
  Crosshair,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

// Form choices, served from backend/scripts/jobspy (combined.py + _common.py).
interface Options {
  countries: string[];
  job_types: string[];
  default_country: string;
  bayt_countries: string[];
  total_results: number;
  max_age_days: number;
}

// A JobSpy job row — many columns, most optional and site-dependent.
type Job = Record<string, unknown> & {
  site?: string;
  title?: string;
  company?: string | null;
  location?: string | null;
  job_url?: string;
  job_url_direct?: string | null;
  date_posted?: string | null;
  job_type?: string | null;
  is_remote?: boolean | null;
  min_amount?: number | null;
  max_amount?: number | null;
  currency?: string | null;
  interval?: string | null;
  description?: string | null;
  company_logo?: string | null;
  // Added by the backend (geocoded from `location`); null when unknown.
  latitude?: number | null;
  longitude?: number | null;
};

interface SearchResult {
  jobs: Job[];
  errors: Record<string, string[]>;
  counts: Record<string, number>;
  seconds: number;
}

const SITE_LABELS: Record<string, string> = { linkedin: 'LinkedIn', indeed: 'Indeed', bayt: 'Bayt' };
const SITE_STYLES: Record<string, string> = {
  linkedin: 'bg-blue-600/10 text-blue-700',
  indeed: 'bg-indigo-600/10 text-indigo-700',
  bayt: 'bg-orange-500/10 text-orange-700',
};
const JOB_TYPE_LABELS: Record<string, string> = {
  fulltime: 'Full-time',
  parttime: 'Part-time',
  internship: 'Internship',
  contract: 'Contract',
};

const fieldCls =
  'w-full bg-black/[0.02] border border-black/[0.08] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-600 transition-all';
const labelCls = 'text-[11px] font-bold uppercase tracking-wider text-[#0b0b0c]/50 mb-1.5 block';

function formatSalary(job: Job) {
  const { min_amount: min, max_amount: max, currency, interval } = job;
  if (min == null && max == null) return null;
  const fmt = (n: number) => n.toLocaleString();
  const range = min != null && max != null && min !== max ? `${fmt(min)} – ${fmt(max)}` : fmt((min ?? max) as number);
  return `${currency ? `${currency} ` : ''}${range}${interval ? ` / ${interval}` : ''}`;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function JobSpyPage() {
  const router = useRouter();
  const [options, setOptions] = useState<Options | null>(null);
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [country, setCountry] = useState('');
  const [jobType, setJobType] = useState('');
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getToken = useCallback(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return null;
    }
    return token;
  }, [router]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/jobspy/options/`, { headers: { Authorization: `Token ${token}` } });
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        if (!res.ok) {
          setError('Could not load the search options.');
          return;
        }
        const data: Options = await res.json();
        setOptions(data);
        setCountry(data.default_country);
      } catch {
        setError('Could not load the search options.');
      }
    })();
  }, [getToken, router]);

  // Tick a visible timer while a search runs — LinkedIn descriptions take a while.
  useEffect(() => {
    if (!searching) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [searching]);

  const includesBayt = Boolean(options?.bayt_countries.includes(country));

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.trim()) {
      setError('Enter a role / keywords.');
      return;
    }
    const token = getToken();
    if (!token) return;
    setSearching(true);
    setElapsed(0);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/jobspy/search/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: role.trim(), location: location.trim(), country, job_type: jobType }),
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) setResult(data as SearchResult);
      else setError(data.error || `Search failed (${res.status}).`);
    } catch {
      setError('Search failed — the server did not respond.');
    } finally {
      setSearching(false);
    }
  };

  const jobsJson = result ? JSON.stringify(result.jobs, null, 2) : '';

  const downloadJson = () => {
    if (!result) return;
    const blob = new Blob([jobsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobspy-${role.trim().replace(/\s+/g, '-') || 'jobs'}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(jobsJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — download still works */
    }
  };

  const siteErrors = result ? Object.entries(result.errors) : [];
  const mix = result
    ? Object.entries(result.counts).map(([site, n]) => `${SITE_LABELS[site] ?? site} ${n}`).join(' · ')
    : '';

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
            JobSpy search
          </h1>
          <p className="text-[#0b0b0c]/60 font-medium">
            {options?.total_results ?? 10} random jobs from the last {options?.max_age_days === 7 || !options ? 'week' : `${options.max_age_days} days`},
            mixed from LinkedIn, Indeed and Bayt, remote and on-site, easy-apply and regular. Results aren&apos;t saved.
          </p>
        </header>

        <form onSubmit={runSearch} className="bg-white border border-black/[0.08] rounded-3xl p-6 sm:p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="block md:col-span-2">
              <span className={labelCls}>Role / keywords <span className="text-red-500">*</span></span>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. python developer"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Location</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, e.g. Dubai (empty = whole country)"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Country</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={!options}
                className={`${fieldCls} cursor-pointer`}
              >
                {options?.countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Job type</span>
              <select value={jobType} onChange={(e) => setJobType(e.target.value)} className={`${fieldCls} cursor-pointer`}>
                <option value="">Any</option>
                {options?.job_types.map((t) => <option key={t} value={t}>{JOB_TYPE_LABELS[t] ?? t}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8">
            <p className="flex items-start gap-2 text-xs text-[#0b0b0c]/55">
              <Info size={14} className="shrink-0 mt-0.5" />
              {options
                ? includesBayt
                  ? 'Searches LinkedIn, Indeed and Bayt. Bayt ignores job type.'
                  : 'Searches LinkedIn and Indeed. Bayt only covers Gulf / Middle East countries.'
                : 'Loading options…'}
            </p>
            <div className="flex items-center gap-4 shrink-0">
              {searching && <span className="text-sm text-[#0b0b0c]/50 font-medium">Searching… {elapsed}s</span>}
              <button
                type="submit"
                disabled={searching || !options}
                className="cursor-pointer flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-wait"
              >
                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Search
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div className="flex gap-2 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 mb-8">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {result && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/50 flex items-center gap-2">
                <Shuffle size={13} />
                {result.jobs.length} job{result.jobs.length !== 1 ? 's' : ''} · {result.seconds}s
                {mix && <span className="normal-case tracking-normal font-semibold">({mix})</span>}
              </h2>
              {result.jobs.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyJson}
                    className="cursor-pointer flex items-center gap-2 bg-white border border-black/[0.08] hover:bg-black/[0.03] px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  >
                    {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                    {copied ? 'Copied' : 'Copy JSON'}
                  </button>
                  <button
                    onClick={downloadJson}
                    className="cursor-pointer flex items-center gap-2 bg-white border border-black/[0.08] hover:bg-black/[0.03] px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  >
                    <Download size={15} /> Download JSON
                  </button>
                </div>
              )}
            </div>

            {siteErrors.length > 0 && (
              <div className="flex gap-2 text-sm text-amber-800 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4 mb-4">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Some sites reported problems:</p>
                  {siteErrors.map(([site, messages]) =>
                    messages.map((m, i) => (
                      <p key={`${site}-${i}`} className="break-words">
                        <span className="font-semibold">{SITE_LABELS[site] ?? site}:</span> {m}
                      </p>
                    )),
                  )}
                </div>
              </div>
            )}

            {result.jobs.length === 0 ? (
              <div className="bg-white border border-black/[0.08] rounded-3xl py-20 text-center">
                <ScanSearch className="w-12 h-12 text-[#0b0b0c]/30 mx-auto mb-4" />
                <p className="text-[#0b0b0c]/60 font-medium">
                  No jobs posted in the last week. Try a broader role, or leave the location empty.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {result.jobs.map((job, i) => <JobCard key={`${job.job_url}-${i}`} job={job} />)}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const salary = formatSalary(job);
  const posted = formatDate(job.date_posted);
  const url = job.job_url_direct || job.job_url;
  const site = job.site ?? '';

  return (
    <div className="bg-white border border-black/[0.08] rounded-3xl p-6 flex flex-col">
      <div className="flex items-start gap-3">
        {job.company_logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={job.company_logo} alt="" className="w-10 h-10 rounded-lg object-contain border border-black/[0.08] bg-white shrink-0" />
        ) : (
          <span className="grid w-10 h-10 place-items-center rounded-lg border border-black/[0.08] bg-black/[0.03] text-[#0b0b0c]/35 shrink-0">
            <Building2 size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <a
            href={url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[15px] leading-snug hover:text-green-700 inline-flex items-start gap-1.5 break-words"
          >
            {job.title || 'Untitled'}
            <ExternalLink size={13} className="shrink-0 mt-1 text-[#0b0b0c]/35" />
          </a>
          <p className="text-sm text-[#0b0b0c]/65 mt-0.5">{job.company || 'Company not listed'}</p>
        </div>
        {site && (
          <span className={`text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-0.5 shrink-0 ${SITE_STYLES[site] ?? 'bg-black/[0.05] text-[#0b0b0c]/60'}`}>
            {SITE_LABELS[site] ?? site}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#0b0b0c]/60 mt-4">
        {job.location && <span className="flex items-center gap-1"><MapPin size={12} /> {job.location}</span>}
        {posted && <span className="flex items-center gap-1"><Calendar size={12} /> {posted}</span>}
        {job.latitude != null && job.longitude != null ? (
          <a
            href={`https://www.openstreetmap.org/?mlat=${job.latitude}&mlon=${job.longitude}#map=12/${job.latitude}/${job.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open on the map"
            className="flex items-center gap-1 font-mono hover:text-green-700"
          >
            <Crosshair size={12} /> {job.latitude.toFixed(4)}, {job.longitude.toFixed(4)}
          </a>
        ) : (
          <span className="flex items-center gap-1 text-[#0b0b0c]/35"><Crosshair size={12} /> No coordinates</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {job.job_type && (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-black/[0.04] text-[#0b0b0c]/60 rounded-md px-2 py-0.5">
            {job.job_type}
          </span>
        )}
        {job.is_remote && (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-green-600/10 text-green-700 rounded-md px-2 py-0.5">
            Remote
          </span>
        )}
        {salary && (
          <span className="text-[10px] font-bold tracking-wider bg-blue-500/10 text-blue-700 rounded-md px-2 py-0.5">
            {salary}
          </span>
        )}
      </div>

      {job.description && (
        <div className="mt-4 pt-4 border-t border-black/[0.06]">
          <p className="text-xs text-[#0b0b0c]/65 whitespace-pre-wrap break-words line-clamp-4">{job.description}</p>
        </div>
      )}
    </div>
  );
}
