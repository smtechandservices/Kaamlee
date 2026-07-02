'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, RefreshCcw, Search, Pause, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface LogsResponse {
  lines: string[];
  total_matches: number;
  shown_count: number;
}

const LINE_OPTIONS = [500, 1000, 2000, 5000, 20000];
const AUTO_REFRESH_MS = 5000;

function classifyLine(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith('curl')) return 'text-yellow-500';
  if (trimmed.startsWith("-H '") || trimmed.startsWith('-d ')) return 'text-[#777]';
  const beforeStatus = trimmed.split(' status=')[0];
  if (beforeStatus.length > 0 && [...beforeStatus].every((c) => c === '-')) return 'text-[#444]';
  if (line.includes('status=4') || line.includes('status=5')) return 'text-red-500';
  if (line.includes('status=2') || line.includes('status=3')) return 'text-green-500';
  return 'text-[#ccc]';
}

export default function RequestLogsPage() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [maxLines, setMaxLines] = useState(500);
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const boxRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchLogs(query, maxLines);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchLogs(query, maxLines), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, query, maxLines]);

  useEffect(() => {
    const el = boxRef.current;
    if (el && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [data]);

  async function fetchLogs(q: string, lines: number) {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const params = new URLSearchParams({ lines: String(lines) });
      if (q) params.set('q', q);
      const res = await fetch(`${API_BASE}/admin/request-logs/?${params}`, {
        headers: { Authorization: `Token ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('admin_token');
        router.push('/login');
        return;
      }
      if (!res.ok) {
        setError(`Failed to load logs (HTTP ${res.status}).`);
        return;
      }

      const body: LogsResponse = await res.json();
      setData(body);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setError('Network error — could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  const handleScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    stickToBottomRef.current = true;
    fetchLogs(query, maxLines);
  };

  if (loading && !data && !error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="p-3 rounded-2xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all text-[#888] hover:text-white"
              title="Go to Dashboard"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold tracking-tight">Request Logs</h1>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
                  logs/requests.log
                </span>
              </div>
              <p className="text-[#888] text-sm">Live HTTP request log, with reconstructed curl commands.</p>
            </div>
          </div>

          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`cursor-pointer flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest border transition-all ${
              autoRefresh
                ? 'bg-green-500/10 border-green-500/30 text-green-500'
                : 'bg-[#111] border-[#222] text-[#888] hover:text-white'
            }`}
          >
            {autoRefresh ? <Pause size={16} /> : <Play size={16} />}
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
        </header>

        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter lines…"
              className="w-full bg-[#111] border border-[#222] rounded-xl py-2.5 pl-10 pr-4 text-sm font-mono focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          <select
            value={maxLines}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMaxLines(v);
              setLoading(true);
              fetchLogs(query, v);
            }}
            className="bg-[#111] border border-[#222] rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
          >
            {LINE_OPTIONS.map((n) => (
              <option key={n} value={n}>Last {n}</option>
            ))}
          </select>

          <button
            type="submit"
            className="cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-500 transition-all"
          >
            <RefreshCcw size={14} />
            Refresh
          </button>

          {data && (
            <span className="text-[#555] font-mono text-[10px] uppercase tracking-widest">
              Showing {data.shown_count} of {data.total_matches} lines
            </span>
          )}
        </form>

        {error && <p className="text-red-500 font-mono text-xs mb-4">{error}</p>}

        <div
          ref={boxRef}
          onScroll={handleScroll}
          className="bg-[#0d0d0d] border border-[#222] rounded-3xl p-6 max-h-[75vh] overflow-auto font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all"
        >
          {(data?.lines ?? []).length === 0 ? (
            <p className="text-[#555]">No log lines found.</p>
          ) : (
            data!.lines.map((line, i) => (
              <div key={i} className={classifyLine(line)}>{line}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
