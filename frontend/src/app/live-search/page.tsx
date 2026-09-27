'use client';

import React, { useEffect, useState } from 'react';
import {
  Loader2, Radar, Search, Lock, ExternalLink, MapPin, Calendar, Building2, Info, AlertCircle, Sparkles,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import PricingModal from '@/components/PricingModal';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { PRIMARY_BTN_CLS, PRIMARY_BTN_BG } from '@/components/ui/landing-kit';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;
const OUTFIT = { fontFamily: 'var(--font-outfit)' };

// GET /api/jobspy/options/ — choices come from backend/scripts/jobspy.
interface Options {
  countries: string[];
  job_types: string[];
  default_country: string;
  bayt_countries: string[];
  total_results: number;
  max_age_days: number;
  // Rate limits (enforced by the backend too): one search per interval, and an hourly cap.
  search_interval_seconds: number;
  searches_per_hour: number;
}

// One job from JobSpy — many columns, most optional and site-dependent.
type LiveJob = Record<string, unknown> & {
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
};

interface SearchResult {
  jobs: LiveJob[];
  errors: Record<string, string[]>;
  counts: Record<string, number>;
  seconds: number;
}

const SITE_LABELS: Record<string, string> = { linkedin: 'LinkedIn', indeed: 'Indeed', bayt: 'Bayt' };
const SITE_STYLES: Record<string, string> = {
  linkedin: 'bg-blue-600/10 text-blue-700 border-blue-600/20',
  indeed: 'bg-indigo-600/10 text-indigo-700 border-indigo-600/20',
  bayt: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
};
const JOB_TYPE_LABELS: Record<string, string> = {
  fulltime: 'Full-time', parttime: 'Part-time', internship: 'Internship', contract: 'Contract',
};

const fieldCls =
  'w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#16a34a]/50 transition-all';
const labelCls = 'text-[11px] font-semibold uppercase tracking-widest text-black/45 mb-1.5 block';

function formatSalary(job: LiveJob) {
  const { min_amount: min, max_amount: max, currency, interval } = job;
  if (min == null && max == null) return null;
  const fmt = (n: number) => n.toLocaleString();
  const range = min != null && max != null && min !== max ? `${fmt(min)} – ${fmt(max)}` : fmt((min ?? max) as number);
  return `${currency ? `${currency} ` : ''}${range}${interval ? ` / ${interval}` : ''}`;
}

const NEXT_SEARCH_KEY = 'live-search-next-at';

// When the next search is allowed (ms timestamp), remembered per browser so a
// refresh keeps the countdown. Storage can be unavailable — then it's just
// in-memory, and the backend still enforces the limit either way.
function readNextSearchAt(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = Number(window.localStorage.getItem(NEXT_SEARCH_KEY));
    return value > Date.now() ? value : null;
  } catch {
    return null;
  }
}

function saveNextSearchAt(value: number) {
  try {
    window.localStorage.setItem(NEXT_SEARCH_KEY, String(value));
  } catch {
    /* storage blocked — in-memory countdown still works */
  }
}

// 102 -> "1:42", 3600 -> "60:00"
function formatWait(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// 120 -> "2 minutes", 90 -> "90 seconds"
function describeInterval(seconds: number) {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${seconds} seconds`;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LiveSearchPage() {
  // Unsubscribed users can open the page (to see what it does); searching is
  // subscriber-only and enforced by the backend too.
  const { isReady, isSubscribed, token } = useSubscriptionGate({ allowUnsubscribed: true });
  const [options, setOptions] = useState<Options | null>(null);
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [country, setCountry] = useState('');
  const [jobType, setJobType] = useState('');
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [nextSearchAt, setNextSearchAt] = useState<number | null>(readNextSearchAt);
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second while a cooldown is running; stop once it's over.
  useEffect(() => {
    if (!nextSearchAt) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= nextSearchAt) setNextSearchAt(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [nextSearchAt]);

  const cooldownLeft = nextSearchAt ? Math.max(0, Math.ceil((nextSearchAt - now) / 1000)) : 0;

  const startCooldown = (seconds: number) => {
    const at = Date.now() + seconds * 1000;
    setNow(Date.now());
    setNextSearchAt(at);
    saveNextSearchAt(at);
  };

  useEffect(() => {
    if (!isReady || !token) return;
    fetch(`${API_BASE}/api/jobspy/options/`, { headers: { Authorization: `Token ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Options | null) => {
        if (!data) return;
        setOptions(data);
        setCountry((c) => c || data.default_country);
      })
      .catch(() => setError('Could not load the search options.'));
  }, [isReady, token]);

  // Visible timer while a search runs — LinkedIn descriptions take a while.
  useEffect(() => {
    if (!searching) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [searching]);

  const includesBayt = Boolean(options?.bayt_countries.includes(country));

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubscribed) {
      setIsPricingOpen(true);
      return;
    }
    if (!role.trim()) {
      setError('Enter a role or keywords.');
      return;
    }
    if (cooldownLeft > 0) return;
    setSearching(true);
    setElapsed(0);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/jobspy/search/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: role.trim(), location: location.trim(), country, job_type: jobType }),
      });
      const data = await res.json().catch(() => ({}));
      const interval = options?.search_interval_seconds ?? 120;
      if (res.status === 429) {
        // Which limit hit: waiting no longer than one interval = the per-search
        // gap; longer = the hourly cap.
        const wait = Number(String(data.detail || '').match(/(\d+)\s*second/)?.[1]);
        if (Number.isFinite(wait) && wait > 0) startCooldown(wait);
        setError(
          Number.isFinite(wait) && wait > interval
            ? `You've used all ${options?.searches_per_hour ?? 15} live searches for this hour — the countdown shows when you can search again.`
            : `You can search once every ${describeInterval(interval)} — the countdown shows when you can search again.`,
        );
      } else if (res.status === 403) {
        setIsPricingOpen(true); // subscription lapsed since the page loaded
      } else {
        // Any other answer means the search was counted — start the gap.
        startCooldown(interval);
        if (res.ok) setResult(data as SearchResult);
        else setError(data.error || 'Search failed. Please try again.');
      }
    } catch {
      setError('Search failed — the server did not respond.');
    } finally {
      setSearching(false);
    }
  };

  if (!isReady) {
    return (
      <main className="h-screen flex bg-[#f2f3f5]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#16a34a] animate-spin" />
        </div>
      </main>
    );
  }

  const siteErrors = result ? Object.entries(result.errors) : [];
  const mix = result
    ? Object.entries(result.counts).filter(([, n]) => n > 0).map(([site, n]) => `${SITE_LABELS[site] ?? site} ${n}`).join(' · ')
    : '';

  return (
    <main className="h-screen flex bg-[#f2f3f5] text-[#0b0b0c] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/dashboard" title="Live Search" wordmark />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em] flex items-center gap-2.5" style={OUTFIT}>
                <Radar size={26} className="text-[#16a34a]" /> Live job search
              </h1>
              <p className="text-sm text-black/55 mt-1.5 max-w-2xl">
                Search and get {options?.total_results ?? 10} fresh jobs from the
                last {options?.max_age_days === 7 || !options ? 'week' : `${options.max_age_days} days`}, remote and on-site.
              </p>
            </div>

            {!isSubscribed && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#16a34a]/25 rounded-3xl p-5 mb-6">
                <div className="flex items-start gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#16a34a]/10 text-[#16a34a] shrink-0"><Lock size={18} /></span>
                  <div>
                    <p className="text-sm font-semibold" style={OUTFIT}>Live Search is for subscribers</p>
                    <p className="text-xs text-black/55 mt-0.5">Subscribe to search job boards live, alongside everything else on Kaamlee.</p>
                  </div>
                </div>
                <button onClick={() => setIsPricingOpen(true)} className={PRIMARY_BTN_CLS} style={{ ...PRIMARY_BTN_BG, ...OUTFIT }}>
                  <Sparkles size={15} /> Subscribe to unlock
                </button>
              </div>
            )}

            <form onSubmit={runSearch} className="bg-white border border-black/[0.08] rounded-3xl p-5 sm:p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block md:col-span-2">
                  <span className={labelCls} style={OUTFIT}>Role or keywords</span>
                  <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. python developer" className={fieldCls} />
                </label>
                <label className="block">
                  <span className={labelCls} style={OUTFIT}>City</span>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dubai (empty = whole country)" className={fieldCls} />
                </label>
                <label className="block">
                  <span className={labelCls} style={OUTFIT}>Country</span>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} disabled={!options} className={`${fieldCls} cursor-pointer`}>
                    {options?.countries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={labelCls} style={OUTFIT}>Job type</span>
                  <select value={jobType} onChange={(e) => setJobType(e.target.value)} className={`${fieldCls} cursor-pointer`}>
                    <option value="">Any</option>
                    {options?.job_types.map((t) => <option key={t} value={t}>{JOB_TYPE_LABELS[t] ?? t}</option>)}
                  </select>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
                <div className="flex items-start gap-2 text-xs text-black/50">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <p>{includesBayt ? 'Searches LinkedIn, Indeed and Bayt.' : 'Searches LinkedIn and Indeed. Bayt only covers the Gulf / Middle East.'}</p>
                    {options && (
                      <p className="mt-0.5">
                        You can search once every {describeInterval(options.search_interval_seconds)}, up to{' '}
                        {options.searches_per_hour} times an hour.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {searching && <span className="text-sm text-black/45" style={OUTFIT}>Searching… {elapsed}s</span>}
                  <button
                    type="submit"
                    disabled={searching || !options || (isSubscribed && cooldownLeft > 0)}
                    className={PRIMARY_BTN_CLS}
                    style={{ ...PRIMARY_BTN_BG, ...OUTFIT }}
                  >
                    {searching ? <Loader2 size={16} className="animate-spin" /> : isSubscribed ? <Search size={16} /> : <Lock size={15} />}
                    {isSubscribed && cooldownLeft > 0 && !searching ? `Search again in ${formatWait(cooldownLeft)}` : 'Search'}
                  </button>
                </div>
              </div>
            </form>

            {error && (
              <div className="flex gap-2 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 mb-6">
                <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}

            {result && (
              <section>
                <p className="text-xs font-semibold uppercase tracking-widest text-black/45 mb-3" style={OUTFIT}>
                  {result.jobs.length} job{result.jobs.length !== 1 ? 's' : ''} found{mix ? ` · ${mix}` : ''}
                </p>

                {siteErrors.length > 0 && (
                  <div className="text-xs text-amber-800 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 mb-4">
                    {siteErrors.map(([site]) => SITE_LABELS[site] ?? site).join(' and ')} couldn&apos;t be searched just now —
                    showing results from the other sites.
                  </div>
                )}

                {result.jobs.length === 0 ? (
                  <div className="bg-white border border-black/[0.08] rounded-3xl py-16 text-center">
                    <Radar className="w-10 h-10 text-black/25 mx-auto mb-3" />
                    <p className="text-sm text-black/55">No jobs from the last week match. Try a broader role, or leave the city empty.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {result.jobs.map((job, i) => <LiveJobCard key={`${job.job_url}-${i}`} job={job} />)}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>

      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
    </main>
  );
}

function LiveJobCard({ job }: { job: LiveJob }) {
  const salary = formatSalary(job);
  const posted = formatDate(job.date_posted);
  const url = job.job_url_direct || job.job_url;
  const site = job.site ?? '';

  return (
    <div className="bg-white border border-black/[0.08] rounded-[20px] p-5 flex flex-col shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
      <div className="flex items-start gap-3">
        {job.company_logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={job.company_logo} alt="" className="w-11 h-11 rounded-xl object-contain border border-black/[0.06] bg-white shrink-0" />
        ) : (
          <span className="grid w-11 h-11 place-items-center rounded-xl border border-black/[0.06] bg-[#16a34a]/5 text-[#16a34a] shrink-0">
            <Building2 size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug break-words" style={OUTFIT}>{job.title || 'Untitled role'}</h3>
          <p className="text-sm text-black/60 mt-0.5 truncate">{job.company || 'Company not listed'}</p>
        </div>
        {site && (
          <span className={`text-[10px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 shrink-0 ${SITE_STYLES[site] ?? 'bg-black/[0.04] text-black/55 border-black/[0.08]'}`} style={OUTFIT}>
            {SITE_LABELS[site] ?? site}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {job.location && (
          <span className="flex items-center gap-1 text-[11px] text-black/55 bg-black/[0.03] px-2 py-1 rounded-full border border-black/[0.08]">
            <MapPin size={12} /> {job.location}
          </span>
        )}
        {job.is_remote && (
          <span className="text-[11px] text-[#16a34a] bg-[#16a34a]/10 px-2 py-1 rounded-full border border-[#16a34a]/20">Remote</span>
        )}
        {job.job_type && (
          <span className="text-[11px] text-black/55 bg-black/[0.03] px-2 py-1 rounded-full border border-black/[0.08]">
            {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
          </span>
        )}
        {salary && (
          <span className="text-[11px] text-[#16a34a] bg-[#16a34a]/10 px-2 py-1 rounded-full border border-[#16a34a]/20">{salary}</span>
        )}
      </div>

      {job.description && (
        <p className="text-xs text-black/50 leading-relaxed mt-3 line-clamp-3 whitespace-pre-wrap break-words">{job.description}</p>
      )}

      <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-black/[0.06]">
        {posted ? (
          <span className="flex items-center gap-1 text-[11px] text-black/40"><Calendar size={11} /> {posted}</span>
        ) : <span />}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#16a34a] hover:underline"
            style={OUTFIT}
          >
            Apply on {SITE_LABELS[site] ?? 'site'} <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
