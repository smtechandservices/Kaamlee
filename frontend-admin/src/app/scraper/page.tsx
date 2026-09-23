'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  Loader2,
  Play,
  X,
  StopCircle,
  Wifi,
  WifiOff,
  Trash2,
  Pause,
  PlayCircle,
  Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getCached, setCache } from '@/lib/cache';
import { BoardProgress, parseBoardProgress, formatEta, formatElapsed } from '@/lib/scraperProgress';
import { SCRIPT_OPTIONS, SCRIPT_URL_MATCH, MAX_SCRIPT_COMPANIES } from '@/lib/scraperScripts';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;
// wss:// in production (https API), ws:// for local http dev.
const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/^http/, 'ws');

// This page is meant to stay open in a tab indefinitely (the scraper itself
// already runs 24/7 via the backend's auto-scrape scheduler) — cap how much
// state accumulates client-side so a days-old tab doesn't slowly bloat.
const MAX_LOG_LINES_PER_BOARD = 400;
const MAX_FINISHED_RUNS_SHOWN = 15;

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

interface ScriptRunResult {
  ok: boolean;
  error?: string;
  stopped?: boolean;
  fetched?: number;
  created?: number;
  updated?: number;
  geocoded?: number;
  borrowed?: number;
  removed?: number;
}

interface BoardRun {
  board: string;
  script: string;
  started_at: number; // unix seconds
  logs: string[];
  progress?: BoardProgress;
  done: boolean;
  result: ScriptRunResult | null;
  finishedAt?: number; // client-side wall clock, for trimming/sorting only
}

type ScraperMessage =
  | { type: 'snapshot'; runs: { board: string; script: string; started_at: number; logs: string[] }[]; paused: boolean }
  | { type: 'run_started'; board: string; script: string; started_at: number }
  | { type: 'log'; board: string; message: string }
  | { type: 'run_finished'; board: string; result: ScriptRunResult | null }
  | { type: 'run_stop_requested'; board: string }
  | { type: 'run_canceled'; board: string }
  | { type: 'pause_state'; paused: boolean; paused_by: string | null };

type WsState = 'connecting' | 'open' | 'closed';

// Keeps every !done run, plus only the most recently finished ones — a run
// left open for days would otherwise never forget a single completed board.
function trimRuns(runs: Record<string, BoardRun>): Record<string, BoardRun> {
  const entries = Object.entries(runs);
  const finished = entries
    .filter(([, r]) => r.done)
    .sort((a, b) => (b[1].finishedAt ?? 0) - (a[1].finishedAt ?? 0));
  const drop = new Set(finished.slice(MAX_FINISHED_RUNS_SHOWN).map(([key]) => key));
  if (drop.size === 0) return runs;
  const next: Record<string, BoardRun> = {};
  for (const [key, run] of entries) {
    if (!drop.has(key)) next[key] = run;
  }
  return next;
}

export default function ScraperPage() {
  const [runs, setRuns] = useState<Record<string, BoardRun>>({});
  const [wsState, setWsState] = useState<WsState>('connecting');
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [scriptChoice, setScriptChoice] = useState(SCRIPT_OPTIONS[0].value);
  const [scriptCompanies, setScriptCompanies] = useState<string[]>([]);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [stoppingBoards, setStoppingBoards] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const [pausedBy, setPausedBy] = useState<string | null>(null);
  const [pauseToggling, setPauseToggling] = useState(false);
  const [, forceTick] = useState(0); // keeps elapsed-time text counting up
  const router = useRouter();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const logsEndRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const fetchCompanyOptions = useCallback((force = false) => {
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
  }, []);

  useEffect(() => {
    fetchCompanyOptions();
  }, [fetchCompanyOptions]);

  const applyMessage = useCallback((msg: ScraperMessage) => {
    if (msg.type === 'pause_state') {
      setPaused(msg.paused);
      setPausedBy(msg.paused_by);
      return;
    }

    if (msg.type === 'snapshot') setPaused(msg.paused);
    // Refresh Recently Scraped once a run completes, so its updated
    // last_scraped_at shows up without a manual page reload.
    if (msg.type === 'run_finished') fetchCompanyOptions(true);

    setRuns(prev => {
      const next = { ...prev };
      switch (msg.type) {
        case 'snapshot': {
          // Additive only — don't clobber logs/progress this tab already
          // accumulated for a run it already knew about (e.g. a brief
          // reconnect mid-run). For a run this tab is seeing for the first
          // time (a fresh page load, or a refresh mid-run), replay its
          // logs-so-far from the server through the same parser live 'log'
          // events use, so the console and progress bar aren't blank until
          // the next line happens to arrive.
          for (const r of msg.runs) {
            const key = r.board.trim().toLowerCase();
            if (!next[key]) {
              const logs = r.logs.slice(-MAX_LOG_LINES_PER_BOARD);
              let progress: BoardProgress | undefined;
              for (const line of r.logs) progress = parseBoardProgress(line, progress);
              next[key] = { board: r.board, script: r.script, started_at: r.started_at, logs, progress, done: false, result: null };
            }
          }
          break;
        }
        case 'run_started': {
          const key = msg.board.trim().toLowerCase();
          // A fresh start fully resets that board's history — otherwise a
          // re-run would append onto the previous run's logs.
          next[key] = { board: msg.board, script: msg.script, started_at: msg.started_at, logs: [], done: false, result: null };
          break;
        }
        case 'log': {
          const key = msg.board.trim().toLowerCase();
          const existing = next[key] ?? { board: msg.board, script: '', started_at: Date.now() / 1000, logs: [], done: false, result: null };
          const logs = [...existing.logs, msg.message].slice(-MAX_LOG_LINES_PER_BOARD);
          next[key] = { ...existing, logs, progress: parseBoardProgress(msg.message, existing.progress) };
          break;
        }
        case 'run_finished': {
          const key = msg.board.trim().toLowerCase();
          const existing = next[key];
          if (existing) {
            next[key] = { ...existing, done: true, result: msg.result, progress: undefined, finishedAt: Date.now() };
          }
          break;
        }
        case 'run_stop_requested': {
          const key = msg.board.trim().toLowerCase();
          const existing = next[key];
          if (existing) {
            next[key] = { ...existing, progress: { ...existing.progress, stage: 'Stopping...' } };
          }
          break;
        }
        case 'run_canceled': {
          delete next[msg.board.trim().toLowerCase()];
          break;
        }
      }
      return trimRuns(next);
    });
  }, [fetchCompanyOptions]);

  // WebSocket connection with reconnect-with-backoff — this page is meant
  // to stay open indefinitely, so a dropped connection (deploy, network
  // blip) needs to recover on its own instead of just going dark.
  useEffect(() => {
    unmountedRef.current = false;

    const connect = () => {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        router.push('/login');
        return;
      }
      setWsState('connecting');
      const ws = new WebSocket(`${WS_BASE}/ws/scraper/?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setWsState('open');
      };
      ws.onmessage = (event) => {
        try {
          applyMessage(JSON.parse(event.data));
        } catch {
          // ignore a malformed frame rather than tearing down the socket
        }
      };
      ws.onclose = () => {
        setWsState('closed');
        if (unmountedRef.current) return;
        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;
        const delay = Math.min(30000, 1000 * 2 ** attempt);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
      ws.onerror = () => {
        ws.close();
      };
    };

    connect();
    const tickInterval = setInterval(() => forceTick(t => t + 1), 1000);

    return () => {
      unmountedRef.current = true;
      clearInterval(tickInterval);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addScriptCompany = (name: string, max: number) => {
    if (!name || scriptCompanies.length >= max || scriptCompanies.includes(name)) return;
    setScriptCompanies(prev => [...prev, name]);
  };

  const removeScriptCompany = (name: string) => {
    setScriptCompanies(prev => prev.filter(c => c !== name));
  };

  const togglePause = async () => {
    const token = localStorage.getItem('admin_token');
    setPauseToggling(true);
    try {
      await fetch(`${API_BASE}/admin/run-script/pause/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: !paused }),
      });
      // Local `paused` state isn't set here — the pause_state event this
      // POST triggers comes back over the socket (to every connected admin,
      // including this tab) and updates it from there instead.
    } finally {
      setPauseToggling(false);
    }
  };

  const runScript = async () => {
    if (scriptCompanies.length === 0 || starting || paused) return;
    const token = localStorage.getItem('admin_token');
    setScriptError(null);
    setStarting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/run-script/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptChoice, companies: scriptCompanies }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setScriptError(data.error || 'Failed to run script.');
        return;
      }
      // No local "pending" bookkeeping needed — the run_started event for
      // each requested board arrives over the socket and populates `runs`.
      setScriptCompanies([]);
    } catch {
      setScriptError('Failed to reach the server.');
    } finally {
      setStarting(false);
    }
  };

  const stopRun = async (board: string, force = false) => {
    if (force && !window.confirm(
      `Force-stop "${board}"? This immediately clears it from tracking even though its sync ` +
      `may not actually notice and stop — use this only when the regular Stop hasn't worked.`
    )) return;
    const token = localStorage.getItem('admin_token');
    setStoppingBoards(prev => new Set(prev).add(board));
    try {
      await fetch(`${API_BASE}/admin/run-script/stop/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ board, force }),
      });
    } finally {
      setStoppingBoards(prev => {
        const next = new Set(prev);
        next.delete(board);
        return next;
      });
    }
  };

  const stopAll = async (force = false) => {
    if (force && !window.confirm(
      'Force-stop all active runs? This immediately clears them from tracking even though a stuck ' +
      "sync may not actually notice and stop — use this only when the regular Stop All hasn't worked."
    )) return;
    const token = localStorage.getItem('admin_token');
    const running = Object.values(runs).filter(r => !r.done).map(r => r.board);
    setStoppingBoards(new Set(running));
    try {
      await fetch(`${API_BASE}/admin/run-script/stop/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true, force }),
      });
    } finally {
      setStoppingBoards(new Set());
    }
  };

  const clearFinished = () => {
    setRuns(prev => {
      const next: Record<string, BoardRun> = {};
      for (const [key, run] of Object.entries(prev)) {
        if (!run.done) next[key] = run;
      }
      return next;
    });
  };

  const allRuns = Object.values(runs).sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1; // running first
    if (!a.done) return b.started_at - a.started_at;
    return (b.finishedAt ?? 0) - (a.finishedAt ?? 0);
  });
  const runningCount = allRuns.filter(r => !r.done).length;
  const finishedCount = allRuns.length - runningCount;

  const max = scriptChoice === 'epam' ? 1 : MAX_SCRIPT_COMPANIES;
  const urlMatch = SCRIPT_URL_MATCH[scriptChoice];
  const availableForScript = companyOptions
    .filter(c => !urlMatch || c.career_url?.includes(urlMatch))
    .filter(c => !scriptCompanies.includes(c.name));

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <Radio size={26} className="text-green-600" />
              Scraper — Live
            </h1>
            <p className="text-[#0b0b0c]/60 font-medium">
              Streams every scrape in real time — admin-triggered and the 24/7 auto-scrape scheduler alike.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={togglePause}
              disabled={pauseToggling}
              className={`cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                paused
                  ? 'bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-white text-[#0b0b0c]/60 border-black/[0.08] hover:bg-black/[0.03]'
              }`}
              title={paused ? 'Resume starting new runs' : 'Pause — stops new runs from starting (admin or scheduler) without touching anything already running'}
            >
              {pauseToggling ? <Loader2 size={16} className="animate-spin" /> : paused ? <PlayCircle size={16} /> : <Pause size={16} />}
              {paused ? 'Resume' : 'Pause'}
            </button>

            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold border ${
              wsState === 'open'
                ? 'bg-green-500/10 text-green-700 border-green-500/30'
                : wsState === 'connecting'
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                : 'bg-red-500/10 text-red-500 border-red-500/30'
            }`}>
              {wsState === 'open' ? <Wifi size={16} /> : wsState === 'connecting' ? <Loader2 size={16} className="animate-spin" /> : <WifiOff size={16} />}
              {wsState === 'open' ? 'Live' : wsState === 'connecting' ? 'Connecting...' : 'Disconnected — retrying'}
            </div>
          </div>
        </header>

        {paused && (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-800 rounded-2xl px-5 py-4 mb-8">
            <Pause size={18} className="shrink-0" />
            <p className="text-sm font-medium">
              Scraping is paused{pausedBy ? ` by ${pausedBy}` : ''} — no new run can start, manual or scheduled. Anything already running keeps going; stop it separately if needed.
            </p>
          </div>
        )}

        {/* Run trigger + Recently Scraped */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-black/[0.08] rounded-3xl p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Start a run</h2>
              <span className="text-xs text-[#0b0b0c]/60">
                {scriptChoice === 'epam' ? 'One company at a time — single global feed' : `Up to ${MAX_SCRIPT_COMPANIES} companies per run`}
              </span>
            </div>

            <div className={`flex flex-col gap-3 ${paused ? 'opacity-50 pointer-events-none' : ''}`}>
              <select
                value={scriptChoice}
                onChange={(e) => { setScriptChoice(e.target.value); setScriptCompanies([]); }}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-green-600 transition-all cursor-pointer"
              >
                {SCRIPT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <div className="flex flex-wrap items-center gap-2 bg-black/[0.03] border border-black/[0.08] rounded-xl px-3 py-2 min-h-[42px]">
                {scriptCompanies.map(name => (
                  <span key={name} className="flex items-center gap-1.5 bg-black/[0.04] text-xs font-semibold px-2.5 py-1 rounded-lg">
                    {name}
                    <button onClick={() => removeScriptCompany(name)} className="cursor-pointer text-[#0b0b0c]/55 hover:text-red-500 transition-colors">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {scriptCompanies.length < max && (
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
                      <option key={c.id} value={c.name}>{c.name}{c.career_url ? ` — ${c.career_url}` : ''}</option>
                    ))}
                  </select>
                )}
              </div>

              <button
                onClick={runScript}
                disabled={starting || paused || scriptCompanies.length === 0}
                className="cursor-pointer bg-green-600 hover:bg-green-700 text-white disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {starting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Run
              </button>
            </div>

            {scriptError && <p className="mt-3 text-sm text-red-500">{scriptError}</p>}
          </div>

          <div className="bg-white border border-black/[0.08] rounded-3xl p-6 flex flex-col">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Clock size={18} className="text-green-500" /> Recently Scraped
            </h2>
            {(() => {
              const recentlyScraped = companyOptions
                .filter((c): c is CompanyOption & { last_scraped_at: string } => !!c.last_scraped_at)
                .sort((a, b) => new Date(b.last_scraped_at).getTime() - new Date(a.last_scraped_at).getTime())
                .slice(0, 8);

              if (recentlyScraped.length === 0) {
                return <p className="text-xs text-[#0b0b0c]/70 text-center py-8">No companies scraped yet.</p>;
              }

              return (
                <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 max-h-72 pr-1 [mask-image:linear-gradient(to_bottom,black_92%,transparent)]">
                  {recentlyScraped.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-black/[0.03] border border-black/[0.08]">
                      {c.logo_url ? (
                        <img src={c.logo_url} alt="" className="w-7 h-7 rounded-lg object-contain bg-white shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-black/[0.04] flex items-center justify-center text-[10px] font-bold text-[#0b0b0c]/60 shrink-0">
                          {c.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{c.name}</div>
                        <div className="text-[10px] text-[#0b0b0c]/60">{formatScrapedAt(c.last_scraped_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Runs */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            Runs
            {runningCount > 0 && <span className="ml-2 text-sm font-normal text-green-600">{runningCount} active</span>}
            {finishedCount > 0 && <span className="ml-2 text-sm font-normal text-[#0b0b0c]/60">· {finishedCount} finished</span>}
          </h2>
          <div className="flex items-center gap-3">
            {finishedCount > 0 && (
              <button onClick={clearFinished} className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold text-[#0b0b0c]/40 hover:text-[#0b0b0c] transition-colors">
                <Trash2 size={13} /> Clear finished
              </button>
            )}
            {runningCount > 1 && (
              <>
                <button
                  onClick={() => stopAll()}
                  disabled={stoppingBoards.size > 0}
                  className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <StopCircle size={14} /> Stop All
                </button>
                <button
                  onClick={() => stopAll(true)}
                  disabled={stoppingBoards.size > 0}
                  className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold text-red-500/55 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Immediately clears every active run from tracking, even one not responding to the regular stop"
                >
                  <StopCircle size={14} /> Force Stop All
                </button>
              </>
            )}
          </div>
        </div>

        {allRuns.length === 0 ? (
          <div className="bg-white border border-black/[0.08] rounded-3xl py-24 text-center text-[#0b0b0c]/60">
            <Radio className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Nothing running right now — start a manual run above, or wait for the next auto-scrape tick.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {allRuns.map(run => {
              const key = run.board.trim().toLowerCase();
              const pct = run.progress?.current != null && run.progress?.total
                ? Math.min(100, Math.round((run.progress.current / run.progress.total) * 100))
                : null;
              const eta = run.progress ? formatEta(run.progress) : null;
              return (
                <div key={key} className="bg-white border border-black/[0.08] rounded-3xl p-6">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {!run.done ? (
                        <Loader2 size={15} className="animate-spin text-green-600 shrink-0" />
                      ) : run.result?.ok ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                      )}
                      <span className="font-bold text-[#0b0b0c] truncate">{run.board}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/[0.04] text-[#0b0b0c]/55 shrink-0">
                        {run.script}
                      </span>
                      <span className="text-xs text-[#0b0b0c]/60 shrink-0">
                        {run.done ? 'finished' : formatElapsed(run.started_at)}
                      </span>
                    </div>
                    {!run.done && (
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => stopRun(run.board)}
                          disabled={stoppingBoards.has(run.board)}
                          className="cursor-pointer flex items-center gap-1 text-xs font-semibold text-[#0b0b0c]/40 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <StopCircle size={13} /> {stoppingBoards.has(run.board) ? 'Stopping...' : 'Stop'}
                        </button>
                        <button
                          onClick={() => stopRun(run.board, true)}
                          disabled={stoppingBoards.has(run.board)}
                          className="cursor-pointer flex items-center gap-1 text-xs font-semibold text-[#0b0b0c]/40 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Immediately clears this run from tracking, even if it's not responding to the regular stop"
                        >
                          <StopCircle size={13} /> Force
                        </button>
                      </div>
                    )}
                  </div>

                  {!run.done && run.progress && (
                    <div className="mb-3 rounded-xl border border-black/[0.08] bg-black/[0.03] px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                        <span className="text-[#0b0b0c]/70 truncate">
                          {run.progress.stage}
                          {pct != null && ` — ${run.progress.current}/${run.progress.total}`}
                          {eta && ` · ${eta}`}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-black/[0.04] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pct == null ? 'w-1/3 bg-green-600/50 animate-pulse' : 'bg-green-600'}`}
                          style={pct != null ? { width: `${pct}%` } : undefined}
                        />
                      </div>
                    </div>
                  )}

                  {run.done && run.result && (
                    <div className={`mb-3 rounded-xl border p-3 text-xs ${run.result.ok ? 'border-black/[0.08] bg-black/[0.03]' : 'border-red-500/30 bg-red-500/5'}`}>
                      {run.result.ok ? (
                        <div className="text-[#0b0b0c]/60 space-y-0.5">
                          <div>{run.result.fetched ?? 0} fetched · {run.result.created ?? 0} created · {run.result.updated ?? 0} updated</div>
                          <div>{run.result.geocoded ?? 0} geocoded · {run.result.borrowed ?? 0} borrowed · {run.result.removed ?? 0} removed</div>
                        </div>
                      ) : (
                        <div className="text-red-500">{run.result.error || 'Failed'}</div>
                      )}
                    </div>
                  )}

                  {run.logs.length > 0 && (
                    <div
                      ref={(el) => { logsEndRefs.current[key] = el; if (el) el.scrollTop = el.scrollHeight; }}
                      className="h-40 overflow-y-auto rounded-xl border border-black/[0.08] bg-black/[0.03] p-4 font-mono text-xs text-[#0b0b0c]/40 space-y-1"
                    >
                      {run.logs.map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
