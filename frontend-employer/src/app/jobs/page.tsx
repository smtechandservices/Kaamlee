'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2, Briefcase, Plus, MapPin, Users, ShieldAlert, Search, Clock, Pencil, Copy, Link2,
  Trash2, MoreHorizontal, Play, Pause, XCircle, RotateCcw, Check, Banknote, CalendarClock, Inbox,
} from 'lucide-react';
import { getToken, authHeaders } from '@/lib/auth';
import type { JobPosting, JobStatus } from '@/lib/hiring-types';

const HIRING_BASE = `${process.env.NEXT_PUBLIC_API_URL}/hiring`;
const EMPLOYERS_BASE = `${process.env.NEXT_PUBLIC_API_URL}/employers`;
const CANDIDATE_APP_URL = process.env.NEXT_PUBLIC_CANDIDATE_APP_URL || 'https://kaamlee.in';

type Stage = 'applied' | 'screening' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected';

// GET /hiring/jobs/overview/ — a JobPosting plus its applicant numbers.
interface PostingOverview extends JobPosting {
  applications_count: number;
  new_this_week: number;
  in_progress: number;
  hired: number;
  recent_applicants: { id: number; name: string; stage: Stage; applied_at: string }[];
}

type StatusFilter = 'all' | JobStatus;
type SortKey = 'newest' | 'applicants' | 'updated' | 'title';

const STATUS_STYLES: Record<JobStatus, string> = {
  draft: 'bg-black/[0.05] text-[#0b0b0c]/55 border-black/[0.08]',
  published: 'bg-green-500/10 text-green-700 border-green-500/30',
  paused: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  closed: 'bg-red-500/10 text-red-600 border-red-500/30',
};

const STAGE_CHIP: Record<Stage, string> = {
  applied: 'bg-blue-500/10 text-blue-600',
  screening: 'bg-indigo-500/10 text-indigo-600',
  shortlisted: 'bg-violet-500/10 text-violet-600',
  interview: 'bg-amber-500/10 text-amber-700',
  offer: 'bg-emerald-500/10 text-emerald-700',
  hired: 'bg-green-600/10 text-green-700',
  rejected: 'bg-red-500/10 text-red-600',
};

const EMPLOYMENT_LABELS: Record<JobPosting['employment_type'], string> = {
  full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship',
};

// The status moves an employer can make from each state. Publishing goes
// through its own endpoint (it stamps published_at); the rest are PATCHes.
const STATUS_ACTIONS: Record<JobStatus, { to: JobStatus; label: string; icon: React.ReactNode }[]> = {
  draft: [{ to: 'published', label: 'Publish', icon: <Play size={13} /> }],
  published: [
    { to: 'paused', label: 'Pause', icon: <Pause size={13} /> },
    { to: 'closed', label: 'Close', icon: <XCircle size={13} /> },
  ],
  paused: [
    { to: 'published', label: 'Resume', icon: <Play size={13} /> },
    { to: 'closed', label: 'Close', icon: <XCircle size={13} /> },
  ],
  closed: [{ to: 'published', label: 'Reopen', icon: <RotateCcw size={13} /> }],
};

function timeAgo(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function formatSalary(p: JobPosting) {
  if (p.salary_min == null && p.salary_max == null) return null;
  const fmt = (n: number) => n.toLocaleString('en-IN');
  if (p.salary_min != null && p.salary_max != null) return `${p.salary_currency} ${fmt(p.salary_min)} – ${fmt(p.salary_max)}`;
  return `${p.salary_currency} ${fmt((p.salary_min ?? p.salary_max) as number)}+`;
}

function formatLocation(p: JobPosting) {
  const parts = [p.city, p.state, p.country].filter(Boolean);
  if (p.is_remote) return parts.length ? `Remote · ${parts.join(', ')}` : 'Remote';
  return parts.join(', ') || 'Location not set';
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function JobsListPage() {
  const [jobs, setJobs] = useState<PostingOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [kycApproved, setKycApproved] = useState<boolean | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const loadPostings = useCallback(async (token: string) => {
    const res = await fetch(`${HIRING_BASE}/jobs/overview/`, { headers: authHeaders(token) });
    if (res.status === 401) { router.push('/login'); return; }
    if (res.ok) setJobs(await res.json());
  }, [router]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    fetch(`${EMPLOYERS_BASE}/me/`, { headers: authHeaders(token) })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        setKycApproved(data.kyc_status === 'approved');
        if (data.kyc_status === 'approved') return loadPostings(token);
      })
      .catch((status) => { if (status === 401) router.push('/login'); })
      .finally(() => setLoading(false));
  }, [router, loadPostings]);

  // Keep the applicant numbers when a status/duplicate response only
  // carries the plain posting fields.
  const mergePosting = (updated: JobPosting) =>
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)));

  const changeStatus = async (job: PostingOverview, to: JobStatus) => {
    if (to === 'closed' && !window.confirm(`Close "${job.title}"? It stops taking applications; you can reopen it later.`)) return;
    const token = getToken();
    if (!token) return;
    setBusyId(job.id);
    try {
      const res = to === 'published'
        ? await fetch(`${HIRING_BASE}/jobs/${job.id}/publish/`, { method: 'POST', headers: authHeaders(token) })
        : await fetch(`${HIRING_BASE}/jobs/${job.id}/`, {
            method: 'PATCH',
            headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: to }),
          });
      if (res.ok) {
        mergePosting(await res.json());
        showToast(to === 'published' ? (job.status === 'draft' ? 'Published' : 'Live again') : to === 'paused' ? 'Paused' : 'Closed');
      } else {
        alert('Could not update the posting.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (job: PostingOverview) => {
    const token = getToken();
    if (!token) return;
    setBusyId(job.id);
    try {
      const res = await fetch(`${HIRING_BASE}/jobs/${job.id}/duplicate/`, { method: 'POST', headers: authHeaders(token) });
      if (res.ok) {
        const copy: JobPosting = await res.json();
        setJobs((prev) => [{ ...copy, applications_count: 0, new_this_week: 0, in_progress: 0, hired: 0, recent_applicants: [] }, ...prev]);
        showToast('Duplicated as a draft');
      } else {
        alert('Could not duplicate the posting.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (job: PostingOverview) => {
    if (!window.confirm(`Delete "${job.title}"? This can't be undone.`)) return;
    const token = getToken();
    if (!token) return;
    setBusyId(job.id);
    try {
      const res = await fetch(`${HIRING_BASE}/jobs/${job.id}/`, { method: 'DELETE', headers: authHeaders(token) });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== job.id));
        showToast('Deleted');
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Could not delete the posting.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = (job: PostingOverview) => {
    navigator.clipboard.writeText(`${CANDIDATE_APP_URL}/apply/${job.id}`);
    showToast('Public link copied');
  };

  const counts = useMemo(() => ({
    all: jobs.length,
    published: jobs.filter((j) => j.status === 'published').length,
    draft: jobs.filter((j) => j.status === 'draft').length,
    paused: jobs.filter((j) => j.status === 'paused').length,
    closed: jobs.filter((j) => j.status === 'closed').length,
  }), [jobs]);

  const totals = useMemo(() => ({
    applicants: jobs.reduce((n, j) => n + j.applications_count, 0),
    newThisWeek: jobs.reduce((n, j) => n + j.new_this_week, 0),
    active: jobs.reduce((n, j) => n + j.in_progress, 0),
    hired: jobs.reduce((n, j) => n + j.hired, 0),
  }), [jobs]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = jobs.filter((j) =>
      (statusFilter === 'all' || j.status === statusFilter)
      && (!q || j.title.toLowerCase().includes(q) || (j.category || '').toLowerCase().includes(q) || formatLocation(j).toLowerCase().includes(q)),
    );
    const sorted = [...list];
    if (sort === 'applicants') sorted.sort((a, b) => b.applications_count - a.applications_count);
    else if (sort === 'updated') sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    else if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted;
  }, [jobs, search, statusFilter, sort]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!kycApproved) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans flex items-center justify-center">
        <div className="max-w-md text-center bg-white border border-black/[0.08] rounded-3xl p-8">
          <ShieldAlert className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">KYC review required</h1>
          <p className="text-sm text-[#0b0b0c]/60 mb-5">
            Job posting unlocks once your employer&apos;s KYC is approved by an admin.
          </p>
          <Link href="/kyc" className="inline-flex items-center gap-1.5 text-sm font-bold text-purple-600 hover:underline">
            Check your submission
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-6 sm:p-8 font-sans">
      <div className="mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <Briefcase size={28} className="text-purple-600" /> Job Postings
            </h1>
            <p className="text-[#0b0b0c]/60 font-medium">
              {counts.all} posting{counts.all !== 1 ? 's' : ''} · {totals.applicants} applicant{totals.applicants !== 1 ? 's' : ''}
              {totals.newThisWeek > 0 && <span className="text-green-700"> · +{totals.newThisWeek} this week</span>}
            </p>
          </div>
          <Link href="/jobs/new"
            className="cursor-pointer inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-500/20 self-start md:self-auto">
            <Plus size={16} /> New posting
          </Link>
        </header>

        {jobs.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {([
              ['Live now', counts.published, `${counts.draft} draft · ${counts.paused} paused · ${counts.closed} closed`],
              ['Applicants', totals.applicants, `${totals.newThisWeek} in the last 7 days`],
              ['In progress', totals.active, 'Not yet hired or rejected'],
              ['Hired', totals.hired, totals.applicants ? `${Math.round((totals.hired / totals.applicants) * 100)}% of applicants` : '—'],
            ] as [string, number, string][]).map(([label, value, sub]) => (
              <div key={label} className="bg-white border border-black/[0.08] rounded-2xl p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/55">{label}</div>
                <div className="mt-1 text-2xl font-bold">{value}</div>
                <div className="text-xs text-[#0b0b0c]/50 truncate">{sub}</div>
              </div>
            ))}
          </div>
        )}

        {jobs.length > 0 && (
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
            <div className="flex flex-wrap gap-2">
              {([['all', 'All'], ['published', 'Live'], ['draft', 'Drafts'], ['paused', 'Paused'], ['closed', 'Closed']] as [StatusFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`cursor-pointer px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    statusFilter === key ? 'bg-purple-600/15 text-purple-600 border-purple-600/30' : 'bg-white text-[#0b0b0c]/45 border-black/[0.08] hover:text-[#0b0b0c]'
                  }`}
                >
                  {label} <span className="opacity-60">{counts[key]}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 lg:ml-auto">
              <div className="relative flex-1 lg:flex-none">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0b0b0c]/50" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title, category, location..."
                  className="w-full lg:w-72 bg-white border border-black/[0.08] rounded-xl py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:border-purple-500 transition-all"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="cursor-pointer bg-white border border-black/[0.08] rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-purple-500"
                aria-label="Sort postings"
              >
                <option value="newest">Newest first</option>
                <option value="applicants">Most applicants</option>
                <option value="updated">Recently updated</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>
          </div>
        )}

        {jobs.length === 0 ? (
          <div className="bg-white border border-black/[0.08] rounded-3xl p-16 text-center">
            <Briefcase className="w-12 h-12 text-[#0b0b0c]/20 mx-auto mb-4" />
            <p className="text-sm text-[#0b0b0c]/60 mb-5">You haven&apos;t posted any jobs yet.</p>
            <Link href="/jobs/new" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
              <Plus size={16} /> Post your first job
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white border border-black/[0.08] rounded-3xl p-12 text-center text-sm text-[#0b0b0c]/55">
            No postings match these filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {visible.map((job) => (
              <PostingCard
                key={job.id}
                job={job}
                busy={busyId === job.id}
                onStatus={(to) => changeStatus(job, to)}
                onDuplicate={() => duplicate(job)}
                onDelete={() => remove(job)}
                onCopyLink={() => copyLink(job)}
              />
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 rounded-full bg-[#0b0b0c] text-white px-4 py-2.5 text-sm font-medium shadow-lg">
          <Check size={15} className="text-green-400" /> {toast}
        </div>
      )}
    </div>
  );
}

type MenuItem = { label: string; icon: React.ReactNode; href?: string; onClick?: () => void };

function PostingCard({ job, busy, onStatus, onDuplicate, onDelete, onCopyLink }: {
  job: PostingOverview;
  busy: boolean;
  onStatus: (to: JobStatus) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const salary = formatSalary(job);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const timing = job.status === 'draft'
    ? `Draft · created ${timeAgo(job.created_at)}`
    : job.published_at ? `Posted ${timeAgo(job.published_at)}` : `Created ${timeAgo(job.created_at)}`;

  return (
    <div className={`bg-white border rounded-3xl p-6 flex flex-col gap-4 transition-all hover:border-purple-500/40 ${busy ? 'opacity-60 pointer-events-none' : 'border-black/[0.08]'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold text-sm shrink-0">
            {initials(job.title)}
          </div>
          <div className="min-w-0">
            <Link href={`/jobs/${job.id}`} className="text-lg font-bold leading-tight hover:text-purple-600 transition-colors line-clamp-2">
              {job.title}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[job.status]}`}>
                {job.status === 'published' ? 'Live' : job.status}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-[#0b0b0c]/55"><Clock size={11} /> {timing}</span>
            </div>
          </div>
        </div>
        <Link href={`/jobs/${job.id}/applicants`} className="text-center px-3 py-1.5 rounded-xl bg-black/[0.04] hover:bg-purple-600/10 transition-colors shrink-0" title="Open applicant board">
          <div className="text-lg font-black leading-none">{job.applications_count}</div>
          <div className="text-[9px] uppercase tracking-widest text-[#0b0b0c]/60 font-bold">Applicants</div>
        </Link>
      </div>

      {/* Details */}
      <div className="flex flex-col gap-1.5 text-xs text-[#0b0b0c]/55">
        <div className="flex items-center gap-2 truncate"><MapPin size={13} className="shrink-0" /> <span className="truncate">{formatLocation(job)}</span></div>
        <div className="flex items-center gap-2"><Briefcase size={13} className="shrink-0" /> {EMPLOYMENT_LABELS[job.employment_type]}{job.category ? ` · ${job.category}` : ''}</div>
        {salary && <div className="flex items-center gap-2 text-green-700"><Banknote size={13} className="shrink-0" /> {salary}</div>}
        {job.closes_at && (
          <div className="flex items-center gap-2"><CalendarClock size={13} className="shrink-0" /> Closes {new Date(job.closes_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        )}
      </div>

      {job.applications_count > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          {([['New (7d)', job.new_this_week], ['Active', job.in_progress], ['Hired', job.hired]] as [string, number][]).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-black/[0.03] py-2">
              <div className="text-sm font-bold">{value}</div>
              <div className="text-[10px] text-[#0b0b0c]/50">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recent applicants */}
      <div className="pt-4 border-t border-black/[0.08] flex-1 min-h-0">
        {job.recent_applicants.length === 0 ? (
          <div className="text-xs text-[#0b0b0c]/55 text-center py-5 flex flex-col items-center gap-1.5">
            <Inbox size={18} className="text-[#0b0b0c]/25" />
            {job.status === 'draft' ? 'Publish it to start receiving applicants.' : 'No applicants yet.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {job.recent_applicants.map((a) => (
              <Link
                key={a.id}
                href={`/jobs/${job.id}/applicants`}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/[0.03] border border-black/[0.08] hover:border-purple-500/40 transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center text-[10px] font-bold shrink-0">{initials(a.name)}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{a.name}</div>
                  <div className="text-[10px] text-[#0b0b0c]/50">{timeAgo(a.applied_at)}</div>
                </div>
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${STAGE_CHIP[a.stage]}`}>{a.stage}</span>
              </Link>
            ))}
            {job.applications_count > job.recent_applicants.length && (
              <Link href={`/jobs/${job.id}/applicants`} className="text-xs font-semibold text-purple-600 hover:underline text-center pt-1">
                View all {job.applications_count} applicants
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {STATUS_ACTIONS[job.status].slice(0, 1).map((a) => (
          <button
            key={a.to}
            onClick={() => onStatus(a.to)}
            className={`cursor-pointer flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              a.to === 'published'
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-black/[0.04] border border-black/[0.08] text-[#0b0b0c]/70 hover:text-[#0b0b0c] hover:bg-black/[0.06]'
            }`}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : a.icon} {a.label}
          </button>
        ))}
        <Link href={`/jobs/${job.id}/applicants`} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-black/[0.04] border border-black/[0.08] text-sm font-semibold text-[#0b0b0c]/70 hover:text-[#0b0b0c] hover:bg-black/[0.06] transition-all">
          <Users size={13} /> Applicants
        </Link>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="cursor-pointer p-2.5 rounded-xl bg-black/[0.04] border border-black/[0.08] text-[#0b0b0c]/60 hover:text-[#0b0b0c] transition-all"
            aria-label="More actions"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-black/[0.10] rounded-2xl shadow-xl p-1.5 z-20">
              {([
                { label: 'Edit', icon: <Pencil size={14} />, href: `/jobs/${job.id}` },
                ...STATUS_ACTIONS[job.status].slice(1).map((a) => ({ label: a.label, icon: a.icon, onClick: () => onStatus(a.to) })),
                ...(job.status !== 'draft' ? [{ label: 'Copy public link', icon: <Link2 size={14} />, onClick: onCopyLink }] : []),
                { label: 'Duplicate', icon: <Copy size={14} />, onClick: onDuplicate },
              ] as MenuItem[]).map((item) => (
                item.href ? (
                  <Link key={item.label} href={item.href} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[#0b0b0c]/75 hover:bg-black/[0.04]">
                    {item.icon} {item.label}
                  </Link>
                ) : (
                  <button key={item.label} onClick={() => { setMenuOpen(false); item.onClick?.(); }} className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[#0b0b0c]/75 hover:bg-black/[0.04] text-left">
                    {item.icon} {item.label}
                  </button>
                )
              ))}
              <div className="my-1 border-t border-black/[0.06]" />
              <button
                onClick={() => { setMenuOpen(false); onDelete(); }}
                disabled={job.applications_count > 0}
                title={job.applications_count > 0 ? 'Has applicants — close it instead' : undefined}
                className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-500/5 disabled:opacity-40 disabled:cursor-not-allowed text-left"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
