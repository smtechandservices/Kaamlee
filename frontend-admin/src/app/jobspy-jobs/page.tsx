'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bot, Search, X, ExternalLink, Trash2, Loader2, AlertCircle, MapPin, ChevronLeft, ChevronRight,
  Database, Globe, Clock, RefreshCcw, CalendarClock,
} from 'lucide-react';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

const SITES: [string, string][] = [['linkedin', 'LinkedIn'], ['indeed', 'Indeed'], ['bayt', 'Bayt']];
const SITE_LABELS: Record<string, string> = Object.fromEntries(SITES);
const SITE_BADGE: Record<string, string> = {
  linkedin: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  indeed: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20',
  bayt: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
};

// Same shape as AdminJobSerializer (GET /api/admin/jobspy-jobs/).
interface Job {
  id: number;
  id_from_site: string;
  title: string;
  company: string;
  location_name: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  is_remote: boolean;
  job_type: string | null;
  job_url: string;
  site: string;
  company_logo: string | null;
  date_posted: string | null;
  created_at: string;
  category: string | null;
  experience_required: string | null;
  salary: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
}

interface JobsResponse {
  count: number;
  results: Job[];
  stats: {
    total: number;
    matching: number;
    by_site: Record<string, number>;
    countries_in_results: number;
    newest_saved: string | null;
    // JobSpy job with the earliest posting date (null when none have one).
    oldest_posted: { id: number; title: string; company: string; date_posted: string; days_ago: number } | null;
  };
  countries: string[];
  categories: string[];
}

// 1 … 4 5 6 … 12 — same as the Postings page.
function pageNumbers(current: number, total: number): (number | 'gap')[] {
  const wanted = new Set([1, total, current - 1, current, current + 1]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

function ago(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function place(job: Job) {
  return [job.city, job.country].filter(Boolean).join(', ') || job.location_name || '—';
}

function coordinates(job: Job) {
  if (job.latitude == null || job.longitude == null) return null;
  return `${job.latitude.toFixed(5)}, ${job.longitude.toFixed(5)}`;
}

export default function JobSpyJobsPage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [site, setSite] = useState('');
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [reloadTick, setReloadTick] = useState(0);
  // The response is stored with the query it answers, so "loading" is simply
  // "the data on screen is for a different query".
  const [loaded, setLoaded] = useState<{ key: string; data: JobsResponse | null; error: string | null } | null>(null);
  const [selected, setSelected] = useState<Job | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search) params.set('search', search);
  if (site) params.set('site', site);
  if (country) params.set('country', country);
  if (category) params.set('category', category);
  const query = params.toString();
  const key = `${query}#${reloadTick}`;

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const t = localStorage.getItem('admin_token');
    if (!t) {
      router.push('/login');
      return null;
    }
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { Authorization: `Token ${t}`, ...(init?.headers || {}) } });
    if (res.status === 401) {
      router.push('/login');
      return null;
    }
    return res;
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api(`/admin/jobspy-jobs/?${query}`);
        if (!res || cancelled) return;
        if (res.status === 404 && page > 1) {
          // Page ran past the end (e.g. after deleting the last row on it).
          setPage((p) => Math.max(1, p - 1));
          return;
        }
        if (!res.ok) throw new Error();
        const data: JobsResponse = await res.json();
        if (!cancelled) setLoaded({ key, data, error: null });
      } catch {
        if (!cancelled) setLoaded((prev) => ({ key, data: prev?.data ?? null, error: 'Could not load JobSpy jobs.' }));
      }
    })();
    return () => { cancelled = true; };
  }, [api, query, key, page]);

  // Search as you type, after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== search) {
        setSearch(next);
        setPage(1);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const data = loaded?.data ?? null;
  const loading = loaded?.key !== key;
  const error = loaded?.key === key ? loaded.error : null;
  const count = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const bySite = data?.stats.by_site ?? {};
  const allSitesCount = Object.values(bySite).reduce((a, b) => a + b, 0);
  const filtered = Boolean(search || site || country || category);

  const setFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setSite('');
    setCountry('');
    setCategory('');
    setPage(1);
  };

  const deleteJob = async (job: Job) => {
    if (!window.confirm(`Delete "${job.title}" at ${job.company}? It will disappear from the candidate app too.`)) return;
    setDeletingId(job.id);
    try {
      const res = await api(`/jobs/${job.id}/`, { method: 'DELETE' });
      if (!res) return;
      if (!res.ok) throw new Error();
      if (selected?.id === job.id) setSelected(null);
      setReloadTick((n) => n + 1);
    } catch {
      window.alert('Could not delete this job.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              JobSpy jobs
            </h1>
            <p className="text-[#0b0b0c]/60 font-medium max-w-2xl">
              Only the jobs the <Link href="/jobspy-scraper" className="font-semibold underline">JobSpy scraper</Link> saved
              into the jobs database, newest first.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0b0b0c]/60" size={18} />
              <input
                type="text"
                placeholder="Search by title or company..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-72 bg-white border border-black/[0.08] rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
            <button
              onClick={() => setReloadTick((n) => n + 1)}
              title="Refresh"
              className="cursor-pointer p-3 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03]"
            >
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Stat icon={Database} label="JobSpy jobs in database" value={data ? data.stats.total.toLocaleString() : '—'} />
          <Stat
            icon={Globe}
            label={filtered ? 'Countries in these results' : 'Countries'}
            value={data ? String(data.stats.countries_in_results) : '—'}
          />
          <Stat icon={Clock} label="Last saved" value={data?.stats.newest_saved ? ago(data.stats.newest_saved) : '—'} />
          <OldestPosted job={data?.stats.oldest_posted ?? null} />
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <SiteTab active={site === ''} onClick={() => setFilter(setSite)('')} label="All sites" count={allSitesCount} />
            {SITES.map(([value, label]) => (
              <SiteTab key={value} active={site === value} onClick={() => setFilter(setSite)(value)} label={label} count={bySite[value] ?? 0} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect value={country} onChange={setFilter(setCountry)} placeholder="All countries" options={data?.countries ?? []} />
            <FilterSelect value={category} onChange={setFilter(setCategory)} placeholder="All categories" options={data?.categories ?? []} />
            {filtered && (
              <button
                onClick={clearFilters}
                className="cursor-pointer flex items-center gap-1 text-xs font-bold text-[#0b0b0c]/60 hover:text-[#0b0b0c] px-3 py-2"
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex gap-2 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <div className="bg-white border border-black/[0.08] rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/50 border-b border-black/[0.06]">
                  <th className="px-6 py-4">Job</th>
                  <th className="px-4 py-4">Location</th>
                  <th className="px-4 py-4">Coordinates</th>
                  <th className="px-4 py-4">Site</th>
                  <th className="px-4 py-4">Category</th>
                  <th className="px-4 py-4">Posted</th>
                  <th className="px-4 py-4">Saved</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={loading && data ? 'opacity-50 transition-opacity' : ''}>
                {!data && loading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-[#0b0b0c]/50">
                      <Loader2 size={20} className="animate-spin inline-block" />
                    </td>
                  </tr>
                )}
                {data && data.results.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-[#0b0b0c]/50">
                      {filtered ? (
                        'No JobSpy jobs match these filters.'
                      ) : (
                        <>
                          No JobSpy jobs yet. Start a run on the{' '}
                          <Link href="/jobspy-scraper" className="font-semibold underline">JobSpy scraper</Link> page.
                        </>
                      )}
                    </td>
                  </tr>
                )}
                {data?.results.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => setSelected(job)}
                    className="border-b border-black/[0.04] last:border-0 hover:bg-black/[0.02] cursor-pointer"
                  >
                    <td className="px-6 py-4 max-w-[340px]">
                      <div className="font-semibold truncate" title={job.title}>{job.title}</div>
                      <div className="text-xs text-[#0b0b0c]/55 truncate" title={job.company}>{job.company}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-[#0b0b0c]/75">
                        <MapPin size={13} className={job.latitude != null ? 'text-green-600' : 'text-[#0b0b0c]/30'} />
                        {place(job)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap font-mono text-xs text-[#0b0b0c]/70">
                      {coordinates(job) ?? <span className="font-sans text-[#0b0b0c]/40">Not mapped</span>}
                    </td>
                    <td className="px-4 py-4">
                      <SiteBadge site={job.site} />
                    </td>
                    <td className="px-4 py-4 text-[#0b0b0c]/70 whitespace-nowrap">{job.category || '—'}</td>
                    <td className="px-4 py-4 text-[#0b0b0c]/70 whitespace-nowrap">{formatDate(job.date_posted)}</td>
                    <td className="px-4 py-4 text-[#0b0b0c]/70 whitespace-nowrap" title={new Date(job.created_at).toLocaleString()}>
                      {ago(job.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open the original posting"
                          className="p-2 rounded-xl text-[#0b0b0c]/60 hover:text-purple-600 hover:bg-purple-500/10 transition-all"
                        >
                          <ExternalLink size={16} />
                        </a>
                        <button
                          onClick={() => deleteJob(job)}
                          disabled={deletingId === job.id}
                          title="Delete job"
                          className="cursor-pointer p-2 rounded-xl text-[#0b0b0c]/60 hover:text-red-600 hover:bg-red-500/10 transition-all disabled:opacity-50"
                        >
                          {deletingId === job.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {data && count > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
            <div className="flex items-center gap-4 text-xs text-[#0b0b0c]/60 font-medium">
              <span>
                Showing {((page - 1) * pageSize + 1).toLocaleString()}–{Math.min(page * pageSize, count).toLocaleString()} of{' '}
                {count.toLocaleString()} job{count !== 1 ? 's' : ''}
              </span>
              <label className="flex items-center gap-2">
                Rows per page
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="cursor-pointer bg-white border border-black/[0.08] rounded-lg px-2 py-1 text-xs font-semibold outline-none focus:border-purple-500"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>

            {totalPages > 1 && (
              <nav className="flex items-center gap-1.5" aria-label="Pagination">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  aria-label="Previous page"
                  className="cursor-pointer p-2 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                {pageNumbers(page, totalPages).map((n, i) =>
                  n === 'gap' ? (
                    <span key={`gap-${i}`} className="px-1.5 text-sm text-[#0b0b0c]/40">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      disabled={loading}
                      aria-current={n === page ? 'page' : undefined}
                      className={`cursor-pointer min-w-9 h-9 px-2 rounded-xl text-sm font-semibold border transition-all disabled:cursor-wait ${
                        n === page
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white border-black/[0.08] text-[#0b0b0c]/70 hover:bg-black/[0.03]'
                      }`}
                    >
                      {n}
                    </button>
                  ),
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  aria-label="Next page"
                  className="cursor-pointer p-2 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </div>
        )}
      </div>

      {selected && (
        <JobDetailModal
          job={selected}
          deleting={deletingId === selected.id}
          onDelete={() => deleteJob(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function OldestPosted({ job }: { job: JobsResponse['stats']['oldest_posted'] }) {
  // date_posted is a plain date; read it as local midnight, not UTC.
  const posted = job ? new Date(`${job.date_posted}T00:00:00`) : null;
  const days = job?.days_ago ?? 0;
  return (
    <div className="bg-white border border-black/[0.08] rounded-3xl p-5 min-w-0">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/50 mb-2 flex items-center gap-1.5">
        <CalendarClock size={12} /> Oldest job posted
      </div>
      {job && posted ? (
        <>
          <div className="text-2xl font-bold">
            {posted.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <p className="text-xs text-[#0b0b0c]/50 mt-1 truncate" title={`${job.title} · ${job.company}`}>
            {days <= 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}
          </p>
        </>
      ) : (
        <div className="text-2xl font-bold text-[#0b0b0c]/30">—</div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="bg-white border border-black/[0.08] rounded-3xl p-5">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/50 mb-2 flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function SiteTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
        active ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-black/[0.08] text-[#0b0b0c]/70 hover:bg-black/[0.03]'
      }`}
    >
      {label}
      <span className={`text-xs font-semibold ${active ? 'text-white/80' : 'text-[#0b0b0c]/45'}`}>{count.toLocaleString()}</span>
    </button>
  );
}

function FilterSelect({ value, onChange, placeholder, options }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-purple-500 max-w-[220px]"
    >
      <option value="">{placeholder}</option>
      {/* Keep a chosen value listed even if it just dropped out of the options. */}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function SiteBadge({ site }: { site: string }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${SITE_BADGE[site] ?? 'bg-black/[0.04] text-[#0b0b0c]/60 border-black/[0.08]'}`}>
      {SITE_LABELS[site] ?? site}
    </span>
  );
}

function JobDetailModal({ job, deleting, onDelete, onClose }: {
  job: Job;
  deleting: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fields: [string, React.ReactNode][] = [
    ['Location', place(job)],
    ['As listed', job.location_name || '—'],
    ['Coordinates', coordinates(job) ?? '—'],
    ['Category', job.category || '—'],
    ['Job type', job.job_type || '—'],
    ['Salary', job.salary || '—'],
    ['Posted', formatDate(job.date_posted)],
    ['Saved', new Date(job.created_at).toLocaleString()],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-black/[0.06]">
          <div className="flex items-start gap-3 min-w-0">
            {job.company_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.company_logo} alt="" className="w-11 h-11 rounded-xl object-contain border border-black/[0.08] shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 grid place-items-center shrink-0">
                <Bot size={20} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-snug">{job.title}</h2>
              <p className="text-sm text-[#0b0b0c]/60">{job.company}</p>
              <div className="mt-2"><SiteBadge site={job.site} /></div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="cursor-pointer p-2 rounded-xl hover:bg-black/[0.04] shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/45 mb-1">{label}</dt>
                <dd className="text-sm font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/45 mb-2">Description</div>
          <p className="text-sm text-[#0b0b0c]/75 whitespace-pre-line leading-relaxed">
            {job.description?.trim() || 'No description was returned for this job.'}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 p-5 border-t border-black/[0.06]">
          <button
            onClick={onDelete}
            disabled={deleting}
            className="cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50"
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Delete
          </button>
          <a
            href={job.job_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm"
          >
            Open original posting <ExternalLink size={15} />
          </a>
        </div>
      </div>
    </div>
  );
}
