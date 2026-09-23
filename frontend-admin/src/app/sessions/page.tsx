'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  KeyRound, Search, RefreshCcw, Loader2, LogOut, ChevronLeft, ChevronRight,
  ShieldCheck, Clock, Mail, Building2,
} from 'lucide-react';
import Checkbox from '@/components/Checkbox';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;
const PAGE_SIZE = 25;

type AccountType = 'candidate' | 'employer' | 'admin';
type TypeFilter = 'all' | AccountType;

interface Session {
  user_id: number;
  username: string;
  email: string;
  name: string;
  account_type: AccountType;
  employer_name: string | null;
  employer_role: string | null;
  issued_at: string;
  expires_at: string;
  is_expired: boolean;
  is_you: boolean;
}

interface SessionStats {
  active: number;
  ttl_hours: number;
}

const TYPE_STYLES: Record<AccountType, string> = {
  candidate: 'bg-green-500/10 text-green-700',
  employer: 'bg-blue-500/10 text-blue-600',
  admin: 'bg-purple-600/10 text-purple-600',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// "in 5h 12m" / "expired 3h ago" — relative to now.
function relative(value: string, expired: boolean) {
  const diff = Math.abs(new Date(value).getTime() - Date.now());
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const text = days > 0 ? `${days}d ${hours % 24}h` : hours > 0 ? `${hours}h ${minutes % 60}m` : `${Math.max(minutes, 1)}m`;
  return expired ? `expired ${text} ago` : `in ${text}`;
}

function StatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-black/[0.08] rounded-2xl p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-black/[0.04] flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] text-[#0b0b0c]/60 font-black uppercase tracking-[0.2em] mb-0.5">{label}</div>
        <div className="text-lg font-bold truncate">{value}</div>
        {sub && <div className="text-xs text-[#0b0b0c]/55 truncate">{sub}</div>}
      </div>
    </div>
  );
}

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const getToken = useCallback(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) router.push('/login');
    return token;
  }, [router]);

  const fetchSessions = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const params = new URLSearchParams({ page: String(page) });
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (search) params.set('search', search);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sessions/?${params}`, { headers: { Authorization: `Token ${token}` } });
      if (res.status === 401) { router.push('/login'); return; }
      if (res.ok) {
        const data = await res.json();
        setSessions(data.results);
        setCount(data.count);
        setStats(data.stats);
        setSelected(new Set());
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [getToken, page, typeFilter, search, router]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const selectType = (t: TypeFilter) => { setTypeFilter(t); setPage(1); };
  const applySearch = () => { setPage(1); setSearch(searchInput.trim()); };

  const revoke = async (session: Session) => {
    if (!window.confirm(`Log out ${session.username} everywhere? They'll need to sign in again.`)) return;
    const token = getToken();
    if (!token) return;
    setRevokingId(session.user_id);
    try {
      const res = await fetch(`${API_BASE}/admin/sessions/${session.user_id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      });
      if (res.ok) fetchSessions();
      else alert((await res.json().catch(() => ({}))).error || 'Failed to revoke session.');
    } finally {
      setRevokingId(null);
    }
  };

  const bulk = async (body: Record<string, unknown>, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    const token = getToken();
    if (!token) return;
    setBulkBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sessions/bulk/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) fetchSessions();
      else alert((await res.json().catch(() => ({}))).error || 'Action failed.');
    } finally {
      setBulkBusy(false);
    }
  };

  const selectable = sessions.filter((s) => !s.is_you);
  const allSelected = selectable.length > 0 && selectable.every((s) => selected.has(s.user_id));
  const toggle = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              Sessions
            </h1>
            <p className="text-[#0b0b0c]/60 font-medium">
              Login tokens across candidates, employers and admins, one per account.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0b0b0c]/60" size={18} />
              <input
                type="text"
                placeholder="Search by name, username, email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                className="w-72 bg-white border border-black/[0.08] rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
            <button onClick={() => fetchSessions()} className="cursor-pointer p-3 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] transition-all" title="Refresh">
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <StatTile icon={<ShieldCheck size={16} className="text-green-600" />} label="Active" value={stats.active.toLocaleString()} sub="Signed in right now" />
            <StatTile icon={<Clock size={16} className="text-purple-600" />} label="Session length" value={`${stats.ttl_hours}h`} sub="From sign-in — expired sessions are deleted automatically" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {([['all', 'All'], ['candidate', 'Candidates'], ['employer', 'Employers'], ['admin', 'Admins']] as [TypeFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => selectType(key)}
              className={`cursor-pointer px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                typeFilter === key ? 'bg-purple-600/15 text-purple-600 border-purple-600/30' : 'bg-white text-[#0b0b0c]/40 border-black/[0.08] hover:text-[#0b0b0c]'
              }`}
            >
              {label}
            </button>
          ))}

          {selected.size > 0 && (
            <button
              onClick={() => bulk({ action: 'revoke', user_ids: Array.from(selected) }, `Log out ${selected.size} user${selected.size !== 1 ? 's' : ''} everywhere?`)}
              disabled={bulkBusy}
              className="cursor-pointer ml-auto inline-flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-600/20 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
            >
              {bulkBusy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              Log out selected ({selected.size})
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
            <p className="text-[#0b0b0c]/60 text-xs font-bold uppercase tracking-widest">Loading sessions</p>
          </div>
        ) : (
          <div className="bg-white border border-black/[0.08] rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.08] bg-black/[0.02]">
                    <th className="px-6 py-5 w-10">
                      <Checkbox
                        checked={allSelected}
                        indeterminate={selected.size > 0 && !allSelected}
                        onChange={(checked) => setSelected(checked ? new Set(selectable.map((s) => s.user_id)) : new Set())}
                        accent="purple"
                        title={allSelected ? 'Deselect all' : 'Select all'}
                      />
                    </th>
                    {['User', 'Type', 'Signed in', 'Expires', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06]">
                  <AnimatePresence mode="popLayout">
                    {sessions.map((s) => (
                      <motion.tr key={s.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hover:bg-black/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          {!s.is_you && (
                            <Checkbox checked={selected.has(s.user_id)} onChange={() => toggle(s.user_id)} accent="purple" title="Select" />
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm flex items-center gap-2">
                            {s.name || s.username}
                            {s.is_you && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/[0.05] text-[#0b0b0c]/55">You</span>}
                          </div>
                          <div className="text-xs text-[#0b0b0c]/60 mt-0.5">@{s.username}</div>
                          {s.email && <div className="text-xs text-[#0b0b0c]/60 flex items-center gap-1 mt-0.5"><Mail size={11} /> {s.email}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${TYPE_STYLES[s.account_type]}`}>{s.account_type}</span>
                          {s.employer_name && (
                            <div className="text-xs text-[#0b0b0c]/60 flex items-center gap-1 mt-1">
                              <Building2 size={11} /> {s.employer_name}{s.employer_role ? ` · ${s.employer_role}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#0b0b0c]/70 whitespace-nowrap">{formatDateTime(s.issued_at)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-[#0b0b0c]/70">{formatDateTime(s.expires_at)}</div>
                          <div className={`text-xs ${s.is_expired ? 'text-red-500' : 'text-[#0b0b0c]/50'}`}>{relative(s.expires_at, s.is_expired)}</div>
                        </td>
                        <td className="px-6 py-4">
                          {s.is_you ? (
                            <span className="text-xs text-[#0b0b0c]/40">Use Logout</span>
                          ) : (
                            <button
                              onClick={() => revoke(s)}
                              disabled={revokingId === s.user_id}
                              className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors"
                            >
                              {revokingId === s.user_id ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                              Log out
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {sessions.length === 0 && (
              <div className="py-24 text-center">
                <KeyRound className="w-12 h-12 text-[#0b0b0c]/20 mx-auto mb-4" />
                <p className="text-[#0b0b0c]/60 font-medium">No sessions match these filters.</p>
              </div>
            )}
          </div>
        )}

        {count > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-[#0b0b0c]/60 font-medium">Page {page} of {totalPages} · {count.toLocaleString()} sessions</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="cursor-pointer p-2.5 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="cursor-pointer p-2.5 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
