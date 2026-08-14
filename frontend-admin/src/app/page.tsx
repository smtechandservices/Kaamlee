'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Download,
  Play,
  X,
  Clock,
  Activity,
  StopCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCached, setCache, invalidatePrefix } from '@/lib/cache';
import { getSession, setSession, clearSession } from '@/lib/runSession';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;
const COMPANIES_PAGE_SIZE = 20;

const SCRIPT_OPTIONS = [
  { value: 'ashbyhq', label: 'Ashby (jobs.ashbyhq.com)' },
  { value: 'greenhouse', label: 'Greenhouse (boards.greenhouse.io)' },
  { value: 'recruitee', label: 'Recruitee (*.recruitee.com)' },
  { value: 'lever', label: 'Lever (jobs.lever.co)' },
  { value: 'workable', label: 'Workable (apply.workable.com)' },
  { value: 'epam', label: 'EPAM (careers.epam.com)' },
];
// Which career_url substring identifies a company as belonging to each
// script — so the company picker only offers boards that script can
// actually fetch, instead of letting you pick e.g. a Greenhouse company
// while "Ashby" is selected.
const SCRIPT_URL_MATCH: Record<string, string> = {
  ashbyhq: 'ashbyhq.com',
  greenhouse: 'greenhouse.io',
  recruitee: 'recruitee.com',
  lever: 'lever.co',
  workable: 'workable.com',
  epam: 'epam.com',
};
const MAX_SCRIPT_COMPANIES = 3;
// sessionStorage key for the in-progress run's logs/results/progress — see
// lib/runSession.ts for why this survives a nav-away-and-back or reload
// instead of just living in React state (which resets on every mount) or
// the shared in-memory cache module (which resets on a full reload).
const SCRIPT_RUN_SESSION_KEY = 'script-run:session';

interface ScriptRunState {
  pending: string[];
  results: ScriptRunResult[];
  logs: string[];
  boardProgress: Record<string, BoardProgress>;
  missCounts: Record<string, number>;
}

interface ScriptRunResult {
  board: string;
  ok: boolean;
  error?: string;
  fetched?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  geocoded?: number;
  borrowed?: number;
  removed?: number;
}

interface Stats {
  total_jobs: number;
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

interface CompanyOption {
  id: number;
  name: string;
  career_url: string;
  logo_url: string;
  last_scraped_at: string | null;
}

function formatScrapedAt(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
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

interface BoardProgress {
  stage: string;
  current?: number;
  total?: number;
  geocodeStartedAt?: number;
}

// Scripts only emit granular counters during the geocode pass (every 25
// locations) — everything else is a one-shot line — so progress/ETA is
// only ever computable for that phase; other stages just show a label.
function parseBoardProgress(message: string, prev: BoardProgress | undefined): BoardProgress {
  const locationMatch = message.match(/^(\d+)\/(\d+) location\(s\) checked/);
  if (locationMatch) {
    return {
      stage: 'Geocoding locations',
      current: Number(locationMatch[1]),
      total: Number(locationMatch[2]),
      geocodeStartedAt: prev?.geocodeStartedAt ?? Date.now(),
    };
  }
  if (message.startsWith('Fetching ')) return { stage: 'Fetching postings' };
  if (/posting\(s\) received$/.test(message)) return { stage: 'Saving to database' };
  if (/created, \d+ updated/.test(message)) return { stage: 'Preparing to geocode' };
  if (message === 'Geocoding locations...') return { stage: 'Geocoding locations', geocodeStartedAt: Date.now() };
  if (/^Stopped by admin request/.test(message)) return { ...prev, stage: 'Stopping...' };
  if (/rate-limiting/.test(message)) return { ...prev, stage: 'Rate-limited by Nominatim, waiting to retry' };
  if (/geocoded, \d+ borrowed/.test(message)) return { stage: 'Cleaning up' };
  if (/^Removed \d+/.test(message)) return { stage: 'Finishing up' };
  return prev ?? { stage: message };
}

function formatEta(progress: BoardProgress): string | null {
  const { current, total, geocodeStartedAt } = progress;
  if (current == null || total == null || !geocodeStartedAt || current <= 0) return null;
  const elapsedSeconds = (Date.now() - geocodeStartedAt) / 1000;
  const rate = current / elapsedSeconds; // items/sec
  if (rate <= 0) return null;
  const remainingSeconds = Math.round((total - current) / rate);
  if (remainingSeconds <= 0) return 'almost done';
  if (remainingSeconds < 60) return `~${remainingSeconds}s left`;
  const minutes = Math.round(remainingSeconds / 60);
  return `~${minutes} min left`;
}

interface ActiveRun {
  board: string;
  script: string;
  started_at: number; // unix seconds
}

function formatElapsed(startedAt: number): string {
  const seconds = Math.max(0, Math.round(Date.now() / 1000 - startedAt));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  return `${minutes}m ${remSeconds}s`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesCount, setCompaniesCount] = useState(0);
  const [companiesPage, setCompaniesPage] = useState(1);
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [scriptChoice, setScriptChoice] = useState(SCRIPT_OPTIONS[0].value);
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [scriptCompanies, setScriptCompanies] = useState<string[]>([]);
  const [pendingBoards, setPendingBoards] = useState<string[]>([]);
  const runningScript = pendingBoards.length > 0;
  const [scriptResults, setScriptResults] = useState<ScriptRunResult[] | null>(null);
  const [scriptLogs, setScriptLogs] = useState<string[]>([]);
  const [boardProgress, setBoardProgress] = useState<Record<string, BoardProgress>>({});
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);
  const [stoppingBoards, setStoppingBoards] = useState<Set<string>>(new Set());
  const [, forceTick] = useState(0); // re-render periodically so elapsed-time text keeps counting up
  const [scriptError, setScriptError] = useState<string | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  // Flips true on unmount so an in-flight poll loop (see pollBoards) stops
  // itself instead of running on as a "zombie" that fights a resumed poll
  // from whatever remounts next (e.g. navigating back to this page).
  const cancelledRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [scriptLogs]);

  // Active Runs card: polls independently of the local "Run" button/stream
  // state, since a sync can be triggered from another admin tab/session too
  // — this is the only way to see (and stop) those.
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    let cancelled = false;

    const poll = () => {
      fetch(`${API_BASE}/admin/run-script/running/`, { headers: { Authorization: `Token ${token}` } })
        .then(res => (res.ok ? res.json() : []))
        .then((data: ActiveRun[]) => {
          if (cancelled) return;
          setActiveRuns(data);
          // A "stopping" board only really leaves once its worker notices
          // the flag and finishes (which can take a while) — drop it from
          // this set once the registry confirms it's actually gone, rather
          // than assuming a stop request's 200 OK means it's done.
          setStoppingBoards(prev => new Set([...prev].filter(b => data.some(r => r.board === b))));
        })
        .catch(() => {});
    };

    poll();
    const interval = setInterval(poll, 3000);
    const tickInterval = setInterval(() => forceTick(t => t + 1), 1000);
    return () => { cancelled = true; clearInterval(interval); clearInterval(tickInterval); };
  }, []);

  // A board isn't actually gone the instant /stop/ returns 200 — that just
  // flips a flag the worker thread checks cooperatively, and finishing can
  // take a while (up to a Nominatim retry backoff mid-geocode). So
  // stoppingBoards stays set (showing "Stopping...") until the next poll
  // confirms the board has left the registry for real, rather than
  // optimistically hiding the row and having it flicker back.
  const stopRun = async (board: string) => {
    const token = localStorage.getItem('admin_token');
    setStoppingBoards(prev => new Set(prev).add(board));
    try {
      const res = await fetch(`${API_BASE}/admin/run-script/stop/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ board }),
      });
      if (!res.ok) {
        setStoppingBoards(prev => { const next = new Set(prev); next.delete(board); return next; });
      }
    } catch (error) {
      setStoppingBoards(prev => { const next = new Set(prev); next.delete(board); return next; });
    }
  };

  const stopAllRuns = async () => {
    const token = localStorage.getItem('admin_token');
    const boards = activeRuns.map(r => r.board);
    setStoppingBoards(new Set(boards));
    try {
      const res = await fetch(`${API_BASE}/admin/run-script/stop/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) setStoppingBoards(new Set());
    } catch (error) {
      setStoppingBoards(new Set());
    }
  };

  const companiesTotalPages = Math.max(1, Math.ceil(companiesCount / COMPANIES_PAGE_SIZE));

  const fetchCompanies = async (page: number, force = false) => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    const cacheKey = `company-data:dashboard:page:${page}`;
    if (!force) {
      const cached = getCached<{ results: Company[]; count: number }>(cacheKey);
      if (cached) {
        setCompanies(cached.results);
        setCompaniesCount(cached.count);
        return;
      }
    }
    try {
      const res = await fetch(`${API_BASE}/companies/?page=${page}`, { headers: { 'Authorization': `Token ${token}` } });
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
    fetchCompanies(companiesPage);
  }, [companiesPage]);

  const fetchCompanyOptions = (force = false) => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    const cacheKey = 'company-data:dropdown';
    if (!force) {
      const cached = getCached<CompanyOption[]>(cacheKey);
      if (cached) {
        setCompanyOptions(cached);
        return;
      }
    }
    fetch(`${API_BASE}/admin/companies/?page_size=500`, { headers: { Authorization: `Token ${token}` } })
      .then(res => (res.ok ? res.json() : { results: [] }))
      .then((data: { results: CompanyOption[] }) => {
        const sorted = data.results.sort((a, b) => a.name.localeCompare(b.name));
        setCompanyOptions(sorted);
        setCache(cacheKey, sorted);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchCompanyOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      await fetchCompanies(companiesPage, force);

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

  const addScriptCompany = (name: string, max: number = MAX_SCRIPT_COMPANIES) => {
    if (!name || scriptCompanies.length >= max || scriptCompanies.includes(name)) return;
    setScriptCompanies(prev => [...prev, name]);
  };

  const removeScriptCompany = (name: string) => {
    setScriptCompanies(prev => prev.filter(c => c !== name));
  };

  // The actual polling loop for a run in progress — pulled out of the click
  // handler so it can be resumed on mount (from a persisted session) just as
  // easily as started fresh (from runScript below). Every tick updates both
  // React state (for this render) and sessionStorage (so a later nav-away
  // and back, or reload, can pick up exactly where this left off).
  const pollBoards = async (
    initialPending: string[],
    initialResults: ScriptRunResult[],
    initialLogs: string[],
    initialProgress: Record<string, BoardProgress>,
    initialMissCounts: Record<string, number>,
  ) => {
    const pending = new Set(initialPending);
    const results = [...initialResults];
    const logs = [...initialLogs];
    const progressByBoard: Record<string, BoardProgress> = { ...initialProgress };
    const missCounts: Record<string, number> = { ...initialMissCounts };
    const token = localStorage.getItem('admin_token');

    const persist = () => setSession(SCRIPT_RUN_SESSION_KEY, {
      pending: [...pending], results: [...results], logs: [...logs],
      boardProgress: { ...progressByBoard }, missCounts: { ...missCounts },
    });

    // A board the server has lost track of (e.g. it restarted mid-run, so
    // the in-memory registry that used to know about it is gone) would
    // otherwise poll as "not reserved yet" forever — after this many
    // consecutive misses (~7.5s at the 1.5s interval below) give up on it
    // rather than spin indefinitely.
    const MAX_MISSES = 5;

    while (pending.size > 0) {
      if (cancelledRef.current) return;
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (cancelledRef.current) return;

      const statusRes = await fetch(
        `${API_BASE}/admin/run-script/status/?boards=${encodeURIComponent([...pending].join(','))}`,
        { headers: { Authorization: `Token ${token}` } },
      ).catch(() => null);
      if (!statusRes || !statusRes.ok) continue; // transient — retry on the next tick
      const statusByBoard: Record<string, { logs: string[]; done: boolean; result: ScriptRunResult | null } | null> =
        await statusRes.json();

      for (const board of pending) {
        const status = statusByBoard[board];
        if (!status) {
          missCounts[board] = (missCounts[board] || 0) + 1;
          if (missCounts[board] >= MAX_MISSES) {
            results.push({ board, ok: false, error: 'Lost track of this run — the server may have restarted mid-run.' });
            delete progressByBoard[board];
            pending.delete(board);
          }
          continue;
        }
        missCounts[board] = 0;
        for (const message of status.logs) {
          logs.push(`[${board}] ${message}`);
          progressByBoard[board] = parseBoardProgress(message, progressByBoard[board]);
        }
        if (status.done) {
          if (status.result) results.push(status.result);
          delete progressByBoard[board];
          pending.delete(board);
        }
      }

      setScriptResults([...results]);
      setScriptLogs([...logs]);
      setBoardProgress({ ...progressByBoard });
      setPendingBoards([...pending]);
      persist();
    }

    if (cancelledRef.current) return;
    clearSession(SCRIPT_RUN_SESSION_KEY);
    invalidatePrefix('job-data:');
    invalidatePrefix('company-data:');
    fetchData(true);
    fetchCompanyOptions(true);
  };

  useEffect(() => {
    const saved = getSession<ScriptRunState>(SCRIPT_RUN_SESSION_KEY);
    if (saved) {
      setScriptResults(saved.results);
      setScriptLogs(saved.logs);
      setBoardProgress(saved.boardProgress);
      setPendingBoards(saved.pending);
      if (saved.pending.length > 0) {
        pollBoards(saved.pending, saved.results, saved.logs, saved.boardProgress, saved.missCounts);
      }
    }
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runScript = async () => {
    if (scriptCompanies.length === 0 || runningScript) return;
    const token = localStorage.getItem('admin_token');
    setScriptError(null);
    setScriptResults([]);
    setScriptLogs([]);
    setBoardProgress({});

    const requested = [...scriptCompanies];

    try {
      const res = await fetch(`${API_BASE}/admin/run-script/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptChoice, companies: requested }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setScriptError(data.error || 'Failed to run script.');
        return;
      }

      // Polling (via pollBoards, below) instead of holding one HTTP
      // connection open for the run's whole duration — a geocode-heavy sync
      // can take minutes (Nominatim is rate-limited to ~1 request/2s), long
      // enough for a browser/proxy timeout to kill a streamed connection
      // well before the run itself finishes server-side. A dropped poll is
      // just retried, not mistaken for the run having failed.
      setPendingBoards(requested);
      await pollBoards(requested, [], [], {}, {});
    } catch (error) {
      setScriptError('Failed to reach the server.');
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
          onClick={() => { setLoading(true); fetchData(true); }}
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
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
            <p className="text-[#888]">Overview of jobs, companies, and users.</p>
          </div>

          <button
            onClick={() => fetchData(true)}
            className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all self-start md:self-auto"
            title="Refresh Data"
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </header>

        {activeRuns.length > 0 && (
          <div className="bg-[#111] border border-[#222] rounded-3xl p-6 mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Activity size={18} className="text-blue-500 animate-pulse" /> Active Runs
                <span className="text-xs font-normal text-[#555]">({activeRuns.length})</span>
              </h2>
              {activeRuns.length > 1 && (
                <button
                  onClick={stopAllRuns}
                  disabled={stoppingBoards.size > 0}
                  className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <StopCircle size={14} /> Stop All
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {activeRuns.map(run => (
                <div
                  key={run.board}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Loader2 size={14} className="animate-spin text-blue-500 shrink-0" />
                    <span className="text-sm font-semibold truncate">{run.board}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#666] shrink-0">
                      {run.script}
                    </span>
                    <span className="text-xs text-[#555] shrink-0">{formatElapsed(run.started_at)}</span>
                  </div>
                  <button
                    onClick={() => stopRun(run.board)}
                    disabled={stoppingBoards.has(run.board)}
                    className="cursor-pointer flex items-center gap-1 text-xs font-semibold text-[#888] hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    <StopCircle size={13} /> {stoppingBoards.has(run.board) ? 'Stopping...' : 'Stop'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Import Jobs + Recently Scraped */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#111] border border-[#222] rounded-3xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Download size={18} className="text-blue-500" /> Import Jobs
            </h2>
            <span className="text-xs text-[#555]">
              {scriptChoice === 'epam' ? 'One company at a time — single global feed' : `Up to ${MAX_SCRIPT_COMPANIES} companies per run`}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#555] mb-1.5">Script</label>
              <select
                value={scriptChoice}
                onChange={(e) => { setScriptChoice(e.target.value); setScriptCompanies([]); }}
                className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
              >
                {SCRIPT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#555] mb-1.5">
                {(() => {
                  const max = scriptChoice === 'epam' ? 1 : MAX_SCRIPT_COMPANIES;
                  return `Companies (${scriptCompanies.length}/${max})`;
                })()}
              </label>
              <div className="flex flex-wrap items-center gap-2 bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 min-h-[42px]">
                {scriptCompanies.map(name => (
                  <span key={name} className="flex items-center gap-1.5 bg-[#1a1a1a] text-xs font-semibold px-2.5 py-1 rounded-lg">
                    {name}
                    <button
                      onClick={() => removeScriptCompany(name)}
                      className="cursor-pointer text-[#666] hover:text-red-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {(() => {
                  // EPAM has a single global feed rather than one board per
                  // company, so more than one at once would just refetch the
                  // same postings twice under different labels — cap it to 1
                  // here instead of the usual MAX_SCRIPT_COMPANIES (the
                  // backend rejects a second one too, see RunScraperScriptView).
                  const max = scriptChoice === 'epam' ? 1 : MAX_SCRIPT_COMPANIES;
                  if (scriptCompanies.length >= max) return null;

                  const urlMatch = SCRIPT_URL_MATCH[scriptChoice];
                  const availableForScript = companyOptions
                    .filter(c => !urlMatch || c.career_url?.includes(urlMatch))
                    .filter(c => !scriptCompanies.includes(c.name));
                  return (
                    <select
                      value=""
                      onChange={(e) => addScriptCompany(e.target.value, max)}
                      className="flex-1 min-w-[140px] bg-transparent text-sm focus:outline-none cursor-pointer"
                    >
                      <option value="" disabled>
                        {availableForScript.length === 0
                          ? `No ${SCRIPT_OPTIONS.find(o => o.value === scriptChoice)?.label ?? ''} companies found`
                          : 'Select a company...'}
                      </option>
                      {availableForScript.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name}{c.career_url ? ` — ${c.career_url}` : ''} — {formatRelativeScrapedAt(c.last_scraped_at)}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            </div>

            <button
              onClick={runScript}
              disabled={runningScript || scriptCompanies.length === 0}
              className="cursor-pointer bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all w-full"
            >
              {runningScript ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Run
            </button>
          </div>

          {scriptError && <p className="mt-3 text-sm text-red-400">{scriptError}</p>}

          {runningScript && Object.keys(boardProgress).length > 0 && (
            <div className="mt-4 flex flex-col gap-2.5">
              {Object.entries(boardProgress).map(([board, progress]) => {
                const pct = progress.current != null && progress.total
                  ? Math.min(100, Math.round((progress.current / progress.total) * 100))
                  : null;
                const eta = formatEta(progress);
                return (
                  <div key={board} className="rounded-xl border border-[#222] bg-[#0a0a0a] px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                      <span className="font-bold text-white">{board}</span>
                      <span className="text-[#666] truncate">
                        {progress.stage}
                        {pct != null && ` — ${progress.current}/${progress.total}`}
                        {eta && ` · ${eta}`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${pct == null ? 'w-1/3 bg-blue-500/50 animate-pulse' : 'bg-blue-500'}`}
                        style={pct != null ? { width: `${pct}%` } : undefined}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {runningScript && (
            <div
              ref={logsContainerRef}
              className="mt-4 h-56 overflow-y-auto rounded-xl border border-[#222] bg-[#0a0a0a] p-4 font-mono text-xs text-[#888] space-y-1"
            >
              {scriptLogs.length === 0 ? (
                <span className="text-[#444]">Starting...</span>
              ) : (
                scriptLogs.map((line, i) => <div key={i}>{line}</div>)
              )}
            </div>
          )}

          {!runningScript && scriptResults && scriptResults.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {scriptResults.map(r => (
                <div
                  key={r.board}
                  className={`rounded-xl border p-3 text-xs ${r.ok ? 'border-[#222] bg-[#0a0a0a]' : 'border-red-500/30 bg-red-500/5'}`}
                >
                  <div className="font-bold text-sm mb-1">{r.board}</div>
                  {r.ok ? (
                    <div className="text-[#888] space-y-0.5">
                      <div>{r.fetched} fetched · {r.created} created · {r.updated} updated</div>
                      <div>{r.geocoded} geocoded · {r.borrowed} borrowed · {r.removed} removed</div>
                    </div>
                  ) : (
                    <div className="text-red-400">{r.error}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#111] border border-[#222] rounded-3xl p-6 flex flex-col">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Clock size={18} className="text-green-500" /> Recently Scraped
          </h2>
          {(() => {
            const recentlyScraped = companyOptions
              .filter((c): c is CompanyOption & { last_scraped_at: string } => !!c.last_scraped_at)
              .sort((a, b) => new Date(b.last_scraped_at).getTime() - new Date(a.last_scraped_at).getTime())
              .slice(0, 8);

            if (recentlyScraped.length === 0) {
              return <p className="text-xs text-[#444] text-center py-8">No companies scraped yet.</p>;
            }

            return (
              <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 pr-1 [mask-image:linear-gradient(to_bottom,black_92%,transparent)]">
                {recentlyScraped.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt="" className="w-7 h-7 rounded-lg object-contain bg-white shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[10px] font-bold text-[#555] shrink-0">
                        {c.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{c.name}</div>
                      <div className="text-[10px] text-[#555]">{formatScrapedAt(c.last_scraped_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard
            icon={<Briefcase className="text-blue-500" />}
            label="Total Jobs"
            value={stats?.total_jobs.toLocaleString() || '0'}
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
            <CompanyCard key={company.id} company={company} />
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

function CompanyCard({ company }: { company: Company }) {
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
            <div className="flex items-center gap-1 text-[11px] text-[#555] mt-0.5">
              <Clock size={11} className="shrink-0" />
              <span className="truncate">{formatRelativeScrapedAt(company.last_scraped_at)}</span>
            </div>
          </div>
        </div>
        <div className="text-center px-3 py-1.5 rounded-xl bg-[#1a1a1a] shrink-0">
          <div className="text-lg font-black leading-none">{company.job_count}</div>
          <div className="text-[9px] uppercase tracking-widest text-[#555] font-bold">Jobs</div>
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
          <p className="text-xs text-[#444] text-center py-4">No jobs yet.</p>
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
