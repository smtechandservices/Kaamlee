'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Play, Power, PowerOff, Plus, Trash2, Loader2, CheckCircle2, XCircle, Clock, Globe, Database,
  AlertCircle, RefreshCcw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface Role { id: number; name: string; is_active: boolean }

interface Run {
  id: number;
  role: string;
  country: string;
  status: 'running' | 'success' | 'failed';
  triggered_by: 'scheduler' | 'admin';
  triggered_by_name: string | null;
  fetched: number;
  saved: number;
  duplicates: number;
  dropped: { remote: number; country_only: number; wrong_country: number; unresolved: number };
  site_counts: Record<string, number>;
  error: string;
  started_at: string;
  finished_at: string | null;
}

// GET /api/admin/jobspy-feed/ (AdminJobSpyFeedView)
interface FeedState {
  roles: Role[];
  auto_enabled: boolean;
  paused: boolean;
  interval_minutes: number;
  countries_count: number;
  countries: string[];
  running: boolean;
  runs: Run[]; // one page, newest first
  runs_page: number;
  runs_pages: number;
  runs_page_size: number;
  totals: { runs: number; saved: number; jobs_in_db: number };
}

const SITE_LABELS: Record<string, string> = { linkedin: 'LinkedIn', indeed: 'Indeed', bayt: 'Bayt' };
const DROP_LABELS: [keyof Run['dropped'], string][] = [
  ['country_only', 'no city'],
  ['unresolved', 'not found'],
  ['wrong_country', 'wrong country'],
  ['remote', 'remote only'],
];

function ago(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function duration(run: Run) {
  if (!run.finished_at) return null;
  const s = Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function JobSpyScraperPage() {
  const router = useRouter();
  const [state, setState] = useState<FeedState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newRole, setNewRole] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // which action is in flight
  const [runsPage, setRunsPage] = useState(1);
  const [runCountry, setRunCountry] = useState(''); // '' = random

  const token = () => {
    const t = localStorage.getItem('admin_token');
    if (!t) router.push('/login');
    return t;
  };

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const t = localStorage.getItem('admin_token');
    if (!t) {
      router.push('/login');
      return null;
    }
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Token ${t}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    if (res.status === 401) {
      router.push('/login');
      return null;
    }
    return res;
  }, [router]);

  const load = useCallback(async () => {
    try {
      const res = await api(`/admin/jobspy-feed/?runs_page=${runsPage}`);
      if (!res) return;
      if (res.ok) setState(await res.json());
      else setError('Could not load the scraper.');
    } catch {
      setError('Could not load the scraper.');
    }
  }, [api, runsPage]);

  useEffect(() => {
    load();
  }, [load]);

  // While a run is going, refresh every few seconds so it lands on its own.
  useEffect(() => {
    if (!state?.running) return;
    const timer = setTimeout(load, 4000);
    return () => clearTimeout(timer);
  }, [state, load]);

  const act = async (key: string, path: string, init: RequestInit) => {
    if (!token()) return;
    setBusy(key);
    setError(null);
    try {
      const res = await api(path, init);
      if (!res) return;
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Something went wrong.');
      }
      await load();
    } catch {
      setError('Failed to reach the server.');
    } finally {
      setBusy(null);
    }
  };

  const addRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.trim()) return;
    act('add-role', '/admin/jobspy-feed/roles/', { method: 'POST', body: JSON.stringify({ name: newRole }) })
      .then(() => setNewRole(''));
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center">
        {error ? <p className="text-sm text-red-600">{error}</p> : <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />}
      </div>
    );
  }

  const activeRoles = state.roles.filter((r) => r.is_active).length;

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              JobSpy scraper
            </h1>
            <p className="text-[#0b0b0c]/60 font-medium max-w-2xl">
              Each run picks a random role below and one of {state.countries_count} countries, searches LinkedIn,
              Indeed and Bayt for jobs from the last week, and saves the ones that geocode to a real city in that
              country into the jobs database (and the candidate map).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} title="Refresh" className="cursor-pointer p-3 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03]">
              <RefreshCcw size={16} />
            </button>
            <select
              value={runCountry}
              onChange={(e) => setRunCountry(e.target.value)}
              title="Country for Run now"
              className="cursor-pointer bg-white border border-black/[0.08] rounded-xl px-3 py-3 text-sm font-semibold outline-none focus:border-purple-500 max-w-[220px]"
            >
              <option value="">Random country</option>
              {state.countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={() => act('run', '/admin/jobspy-feed/run/', { method: 'POST', body: JSON.stringify({ country: runCountry }) })}
              title={runCountry ? `Run now in ${runCountry} (random role)` : 'Run now (random role and country)'}
              disabled={state.running || busy === 'run' || activeRoles === 0}
              className="cursor-pointer flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/20"
            >
              {state.running || busy === 'run' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {state.running ? 'Running…' : 'Run now'}
            </button>
          </div>
        </header>

        {error && (
          <div className="flex gap-2 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 mb-6">
            <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {state.paused && (
          <div className="flex gap-2 text-sm text-amber-800 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4 mb-6">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              Scraping is paused on the <Link href="/scraper" className="font-semibold underline">Scraper page</Link>, so
              scheduled runs are skipped. &ldquo;Run now&rdquo; still works.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-black/[0.08] rounded-3xl p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/50 mb-2">Auto-run</div>
            <button
              onClick={() => act('auto', '/admin/jobspy-feed/', { method: 'PATCH', body: JSON.stringify({ auto_enabled: !state.auto_enabled }) })}
              disabled={busy === 'auto'}
              className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold border transition-all disabled:opacity-50 ${
                state.auto_enabled ? 'bg-green-500/10 text-green-700 border-green-500/30' : 'bg-black/[0.04] text-[#0b0b0c]/55 border-black/[0.08]'
              }`}
            >
              {state.auto_enabled ? <Power size={14} /> : <PowerOff size={14} />}
              {state.auto_enabled ? 'On' : 'Off'}
            </button>
            <p className="text-xs text-[#0b0b0c]/50 mt-2">Every {state.interval_minutes} minutes</p>
          </div>
          <Stat icon={Clock} label="Runs" value={state.totals.runs} />
          <Stat icon={CheckCircle2} label="Jobs saved (all runs)" value={state.totals.saved} />
        </div>

        <section className="bg-white border border-black/[0.08] rounded-3xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/50">
              Roles · {activeRoles} of {state.roles.length} on
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {state.roles.map((role) => (
              <span
                key={role.id}
                className={`inline-flex items-center gap-1 rounded-xl border pl-3 pr-1 py-1 text-sm transition-all ${
                  role.is_active ? 'bg-purple-600/[0.06] border-purple-600/25 text-[#0b0b0c]' : 'bg-black/[0.02] border-black/[0.08] text-[#0b0b0c]/40 line-through'
                }`}
              >
                <button
                  onClick={() => act(`role-${role.id}`, `/admin/jobspy-feed/roles/${role.id}/`, { method: 'PATCH', body: JSON.stringify({ is_active: !role.is_active }) })}
                  disabled={busy === `role-${role.id}`}
                  title={role.is_active ? 'Switch off (skip in runs)' : 'Switch on'}
                  className="cursor-pointer font-medium"
                >
                  {role.name}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remove “${role.name}”?`)) act(`del-${role.id}`, `/admin/jobspy-feed/roles/${role.id}/`, { method: 'DELETE' });
                  }}
                  title="Remove role"
                  className="cursor-pointer p-1 rounded-lg text-[#0b0b0c]/35 hover:text-red-500 hover:bg-red-500/5"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            ))}
          </div>
          <form onSubmit={addRole} className="flex gap-2 max-w-md">
            <input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Add a role, e.g. DevOps Engineer"
              maxLength={100}
              className="flex-1 bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500"
            />
            <button type="submit" disabled={!newRole.trim() || busy === 'add-role'}
              className="cursor-pointer inline-flex items-center gap-1.5 bg-black/[0.05] hover:bg-black/[0.08] px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40">
              <Plus size={15} /> Add
            </button>
          </form>
          <p className="text-xs text-[#0b0b0c]/45 mt-3">Click a role to switch it on or off — only roles that are on get picked.</p>
        </section>

        <section className="bg-white border border-black/[0.08] rounded-3xl overflow-hidden">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/50 px-6 pt-6 pb-4">Recent runs</h2>
          {state.runs.length === 0 ? (
            <p className="px-6 pb-8 text-sm text-[#0b0b0c]/55">No runs yet — press &ldquo;Run now&rdquo; or wait for the next scheduled run.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-black/[0.06] bg-black/[0.02] text-left text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/50">
                    <th className="px-6 py-3">Started</th>
                    <th className="px-4 py-3">Role · Country</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Fetched</th>
                    <th className="px-4 py-3 text-right">Saved</th>
                    <th className="px-6 py-3">Skipped</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05]">
                  {state.runs.map((run) => <RunRow key={run.id} run={run} />)}
                </tbody>
              </table>
            </div>
          )}
          {state.runs_pages > 1 && (
            <RunsPager
              // The server clamps the page, so navigate from the page it returned.
              page={state.runs_page}
              pages={state.runs_pages}
              pageSize={state.runs_page_size}
              total={state.totals.runs}
              onChange={setRunsPage}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: number }) {
  return (
    <div className="bg-white border border-black/[0.08] rounded-3xl p-5">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/50 mb-2 flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
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

function RunsPager({ page, pages, pageSize, total, onChange }: {
  page: number;
  pages: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const navCls = 'cursor-pointer p-2 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-all';
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-black/[0.06]">
      <span className="text-xs text-[#0b0b0c]/60 font-medium">
        Showing {((page - 1) * pageSize + 1).toLocaleString()}–{Math.min(page * pageSize, total).toLocaleString()} of {total.toLocaleString()} runs
      </span>
      <nav className="flex items-center gap-1.5" aria-label="Runs pagination">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page" className={navCls}>
          <ChevronLeft size={16} />
        </button>
        {pageNumbers(page, pages).map((n, i) =>
          n === 'gap' ? (
            <span key={`gap-${i}`} className="px-1.5 text-sm text-[#0b0b0c]/40">…</span>
          ) : (
            <button
              key={n}
              onClick={() => onChange(n)}
              aria-current={n === page ? 'page' : undefined}
              className={`cursor-pointer min-w-9 h-9 px-2 rounded-xl text-sm font-semibold border transition-all ${
                n === page
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white border-black/[0.08] text-[#0b0b0c]/70 hover:bg-black/[0.03]'
              }`}
            >
              {n}
            </button>
          ),
        )}
        <button onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Next page" className={navCls}>
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  );
}

function RunRow({ run }: { run: Run }) {
  const sites = Object.entries(run.site_counts).map(([s, n]) => `${SITE_LABELS[s] ?? s} ${n}`).join(' · ');
  const skipped = DROP_LABELS.filter(([k]) => run.dropped[k] > 0).map(([k, label]) => `${run.dropped[k]} ${label}`);
  if (run.duplicates) skipped.unshift(`${run.duplicates} already saved`);

  return (
    <tr className="align-top">
      <td className="px-6 py-3 whitespace-nowrap">
        <div className="font-medium">{ago(run.started_at)}</div>
        <div className="text-xs text-[#0b0b0c]/45">
          {run.triggered_by === 'admin' ? `by ${run.triggered_by_name || 'an admin'}` : 'scheduled'}
          {duration(run) && ` · ${duration(run)}`}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold">{run.role}</div>
        <div className="text-xs text-[#0b0b0c]/55 flex items-center gap-1"><Globe size={11} /> {run.country}</div>
      </td>
      <td className="px-4 py-3">
        {run.status === 'running' && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700"><Loader2 size={12} className="animate-spin" /> Running</span>
        )}
        {run.status === 'success' && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700"><CheckCircle2 size={12} /> Done</span>
        )}
        {run.status === 'failed' && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600"><XCircle size={12} /> Failed</span>
        )}
        {run.error && (
          <div className="text-[11px] text-[#0b0b0c]/50 mt-1 max-w-[220px] line-clamp-2" title={run.error}>{run.error}</div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="font-semibold">{run.fetched}</div>
        {sites && <div className="text-[11px] text-[#0b0b0c]/45 whitespace-nowrap">{sites}</div>}
      </td>
      <td className="px-4 py-3 text-right font-bold text-green-700">{run.status === 'running' ? '—' : run.saved}</td>
      <td className="px-6 py-3 text-xs text-[#0b0b0c]/55">{skipped.length ? skipped.join(', ') : run.status === 'running' ? '' : 'none'}</td>
    </tr>
  );
}
