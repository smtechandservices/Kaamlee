'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2, Inbox, Search, ShieldAlert, Mail, Phone, FileText, Download, Globe, ChevronDown,
  ChevronLeft, ChevronRight, X, Check, Calendar,
} from 'lucide-react';
import { getToken, authHeaders } from '@/lib/auth';
import { STAGE_COLUMNS, type ApplicationStage, type KanbanApplication, type JobStatus } from '@/lib/hiring-types';

const HIRING_BASE = `${process.env.NEXT_PUBLIC_API_URL}/hiring`;
const EMPLOYERS_BASE = `${process.env.NEXT_PUBLIC_API_URL}/employers`;
const CANDIDATE_APP_URL = process.env.NEXT_PUBLIC_CANDIDATE_APP_URL || '';
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// GET /hiring/applicants/ — a Kanban application plus which posting it's for.
interface Applicant extends KanbanApplication {
  candidate_name: string;
  job_posting_title: string;
  job_posting_status: JobStatus;
  screening_questions: { id: string; question: string }[];
}

type SortKey = 'newest' | 'oldest' | 'updated';

const STAGE_CHIP: Record<ApplicationStage, string> = {
  applied: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  screening: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  shortlisted: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  interview: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  offer: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  hired: 'bg-green-600/10 text-green-700 border-green-600/20',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ApplicantsPage() {
  const router = useRouter();
  const [kycApproved, setKycApproved] = useState<boolean | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [count, setCount] = useState(0);
  const [stageCounts, setStageCounts] = useState<Record<ApplicationStage, number> | null>(null);
  const [postings, setPostings] = useState<{ id: number; title: string; status: JobStatus }[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [stage, setStage] = useState<ApplicationStage | 'all'>('all');
  const [posting, setPosting] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [bulkStage, setBulkStage] = useState<ApplicationStage | ''>('');
  // A rejection (single or bulk) waiting for its required note.
  const [rejecting, setRejecting] = useState<{ ids: number[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const totalAll = stageCounts ? Object.values(stageCounts).reduce((a, b) => a + b, 0) : 0;

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), sort });
    if (stage !== 'all') params.set('stage', stage);
    if (posting) params.set('posting', posting);
    if (search) params.set('search', search);
    if (appliedFrom) params.set('applied_from', appliedFrom);
    if (appliedTo) params.set('applied_to', appliedTo);
    setLoading(true);
    try {
      const res = await fetch(`${HIRING_BASE}/applicants/?${params}`, { headers: authHeaders(token) });
      if (res.status === 401) { router.push('/login'); return; }
      if (res.ok) {
        const data = await res.json();
        setApplicants(data.results);
        setCount(data.count);
        setStageCounts(data.stage_counts);
        setPostings(data.postings);
        setSelected(new Set());
      }
    } finally {
      setLoading(false);
    }
  }, [router, page, pageSize, sort, stage, posting, search, appliedFrom, appliedTo]);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    fetch(`${EMPLOYERS_BASE}/me/`, { headers: authHeaders(token) })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setKycApproved(data.kyc_status === 'approved'))
      .catch((status) => { if (status === 401) router.push('/login'); else setKycApproved(false); });
  }, [router]);

  useEffect(() => {
    if (kycApproved) load();
    else if (kycApproved === false) setLoading(false);
  }, [kycApproved, load]);

  // Any filter change goes back to page 1.
  const withReset = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  const moveStage = async (ids: number[], toStage: ApplicationStage, note?: string) => {
    const token = getToken();
    if (!token) return false;
    setBusy(true);
    try {
      const res = ids.length === 1
        ? await fetch(`${HIRING_BASE}/applications/${ids[0]}/stage/`, {
            method: 'PATCH',
            headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ to_stage: toStage, note }),
          })
        : await fetch(`${HIRING_BASE}/applicants/bulk-stage/`, {
            method: 'POST',
            headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, to_stage: toStage, note }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(Object.values(data).flat().join(' ') || 'Could not move the applicant.');
        return false;
      }
      const label = STAGE_COLUMNS.find((c) => c.key === toStage)?.label ?? toStage;
      showToast(ids.length === 1 ? `Moved to ${label}` : `${ids.length} moved to ${label}`);
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const requestMove = (ids: number[], toStage: ApplicationStage) => {
    if (toStage === 'rejected') setRejecting({ ids });
    else moveStage(ids, toStage);
  };

  // The CV export needs the auth header, so fetch it as a blob first.
  const openCV = async (applicationId: number, format: 'pdf' | 'docx') => {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${HIRING_BASE}/applications/${applicationId}/cv/?type=${format}`, { headers: authHeaders(token) });
    if (!res.ok) { alert("Couldn't load this CV."); return; }
    const url = URL.createObjectURL(await res.blob());
    if (format === 'pdf') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = `application-${applicationId}-cv.docx`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const clearFilters = () => {
    setStage('all'); setPosting(''); setSearchInput(''); setSearch('');
    setAppliedFrom(''); setAppliedTo(''); setSort('newest'); setPage(1);
  };
  const hasFilters = stage !== 'all' || posting || search || appliedFrom || appliedTo;

  const allSelected = applicants.length > 0 && applicants.every((a) => selected.has(a.id));
  const toggle = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (kycApproved === false) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans flex items-center justify-center">
        <div className="max-w-md text-center bg-white border border-black/[0.08] rounded-3xl p-8">
          <ShieldAlert className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">KYC review required</h1>
          <p className="text-sm text-[#0b0b0c]/60 mb-5">Applicants appear here once your employer is verified and has live postings.</p>
          <Link href="/kyc" className="inline-flex items-center gap-1.5 text-sm font-bold text-purple-600 hover:underline">Check your submission</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-6 sm:p-8 font-sans">
      <div className="mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <Inbox size={28} className="text-purple-600" /> Applicants
          </h1>
          <p className="text-[#0b0b0c]/60 font-medium">Every candidate across all your postings, in one place.</p>
        </header>

        {/* Stage tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {([{ key: 'all' as const, label: 'All' }, ...STAGE_COLUMNS]).map((c) => (
            <button
              key={c.key}
              onClick={() => withReset(setStage)(c.key)}
              className={`cursor-pointer px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                stage === c.key ? 'bg-purple-600/15 text-purple-600 border-purple-600/30' : 'bg-white text-[#0b0b0c]/45 border-black/[0.08] hover:text-[#0b0b0c]'
              }`}
            >
              {c.label} <span className="opacity-60">{c.key === 'all' ? totalAll : stageCounts?.[c.key] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-black/[0.08] rounded-2xl p-3 mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0b0b0c]/50" size={16} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') withReset(setSearch)(searchInput.trim()); }}
              onBlur={() => { if (searchInput.trim() !== search) withReset(setSearch)(searchInput.trim()); }}
              placeholder="Search name, username or email..."
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <select
            value={posting}
            onChange={(e) => withReset(setPosting)(e.target.value)}
            className="cursor-pointer bg-black/[0.03] border border-black/[0.08] rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-purple-500 max-w-[240px]"
            aria-label="Filter by posting"
          >
            <option value="">All postings</option>
            {postings.map((p) => <option key={p.id} value={p.id}>{p.title}{p.status !== 'published' ? ` (${p.status})` : ''}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-[#0b0b0c]/55">
            <Calendar size={14} /> From
            <input type="date" value={appliedFrom} onChange={(e) => withReset(setAppliedFrom)(e.target.value)} className="bg-black/[0.03] border border-black/[0.08] rounded-xl py-2 px-2.5 text-sm text-[#0b0b0c] focus:outline-none focus:border-purple-500" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#0b0b0c]/55">
            To
            <input type="date" value={appliedTo} onChange={(e) => withReset(setAppliedTo)(e.target.value)} className="bg-black/[0.03] border border-black/[0.08] rounded-xl py-2 px-2.5 text-sm text-[#0b0b0c] focus:outline-none focus:border-purple-500" />
          </label>
          <select
            value={sort}
            onChange={(e) => withReset(setSort)(e.target.value as SortKey)}
            className="cursor-pointer bg-black/[0.03] border border-black/[0.08] rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-purple-500"
            aria-label="Sort"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="updated">Recently moved</option>
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="cursor-pointer inline-flex items-center gap-1 text-xs font-semibold text-[#0b0b0c]/55 hover:text-[#0b0b0c] px-2">
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 rounded-2xl bg-purple-500/10 border border-purple-500/20">
            <span className="text-sm font-semibold text-purple-700">{selected.size} selected</span>
            <select
              value={bulkStage}
              onChange={(e) => setBulkStage(e.target.value as ApplicationStage)}
              className="cursor-pointer bg-white border border-black/[0.08] rounded-xl py-2 px-3 text-sm focus:outline-none"
              aria-label="Move selected to stage"
            >
              <option value="">Move to stage…</option>
              {STAGE_COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <button
              onClick={() => { if (bulkStage) { requestMove(Array.from(selected), bulkStage); setBulkStage(''); } }}
              disabled={!bulkStage || busy}
              className="cursor-pointer inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Apply
            </button>
            <button onClick={() => setSelected(new Set())} className="cursor-pointer ml-auto text-xs font-semibold text-[#0b0b0c]/55 hover:text-[#0b0b0c]">Clear selection</button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-black/[0.08] rounded-3xl overflow-hidden">
          {loading ? (
            <div className="py-32 flex justify-center"><Loader2 className="w-8 h-8 text-purple-600 animate-spin" /></div>
          ) : applicants.length === 0 ? (
            <div className="py-24 text-center">
              <Inbox className="w-12 h-12 text-[#0b0b0c]/20 mx-auto mb-4" />
              <p className="text-[#0b0b0c]/60 font-medium">{hasFilters ? 'No applicants match these filters.' : 'No one has applied yet.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.08] bg-black/[0.02] text-left text-[10px] font-black uppercase tracking-[0.18em] text-[#0b0b0c]/55">
                    <th className="px-5 py-4 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => setSelected(e.target.checked ? new Set(applicants.map((a) => a.id)) : new Set())}
                        className="cursor-pointer accent-purple-600 w-4 h-4"
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-5 py-4">Candidate</th>
                    <th className="px-5 py-4">Posting</th>
                    <th className="px-5 py-4">Stage</th>
                    <th className="px-5 py-4">Applied</th>
                    <th className="px-5 py-4">CV & links</th>
                    <th className="px-5 py-4 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06]">
                  {applicants.map((a) => (
                    <React.Fragment key={a.id}>
                      <tr className={`hover:bg-black/[0.015] transition-colors align-top ${selected.has(a.id) ? 'bg-purple-500/[0.04]' : ''}`}>
                        <td className="px-5 py-4">
                          <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="cursor-pointer accent-purple-600 w-4 h-4" aria-label={`Select ${a.candidate_name}`} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center text-xs font-bold shrink-0">{initials(a.candidate_name)}</div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm truncate">{a.candidate_name}</div>
                              <div className="text-xs text-[#0b0b0c]/55 flex items-center gap-1 truncate"><Mail size={11} /> {a.candidate_email}</div>
                              {a.candidate_phone && <div className="text-xs text-[#0b0b0c]/55 flex items-center gap-1"><Phone size={11} /> {a.candidate_phone}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Link href={`/jobs/${a.job_posting}/applicants`} className="text-sm font-medium hover:text-purple-600 transition-colors">{a.job_posting_title}</Link>
                          {a.job_posting_status !== 'published' && <div className="text-[10px] uppercase tracking-wider font-bold text-[#0b0b0c]/40 mt-0.5">{a.job_posting_status}</div>}
                        </td>
                        <td className="px-5 py-4">
                          <select
                            value={a.stage}
                            disabled={busy}
                            onChange={(e) => requestMove([a.id], e.target.value as ApplicationStage)}
                            className={`cursor-pointer rounded-lg border px-2 py-1 text-xs font-bold uppercase tracking-wider focus:outline-none ${STAGE_CHIP[a.stage]}`}
                            aria-label="Change stage"
                          >
                            {STAGE_COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                          {a.stage === 'rejected' && a.latest_note && (
                            <div className="mt-1.5 text-[11px] text-red-600/80 max-w-[200px] line-clamp-2" title={a.latest_note}>{a.latest_note}</div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-[#0b0b0c]/65 whitespace-nowrap">{formatDate(a.applied_at)}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {a.cv ? (
                              <>
                                <button onClick={() => openCV(a.id, 'pdf')} className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-black/[0.08] px-2 py-1 text-xs font-semibold text-[#0b0b0c]/70 hover:text-purple-600">
                                  <FileText size={12} /> CV{a.cv.ats_score ? ` · ${a.cv.ats_score}%` : ''}
                                </button>
                                <button onClick={() => openCV(a.id, 'docx')} className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-black/[0.08] px-2 py-1 text-xs font-semibold text-[#0b0b0c]/70 hover:text-purple-600" title="Download DOCX">
                                  <Download size={12} />
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-[#0b0b0c]/40">No CV</span>
                            )}
                            {a.portfolio_url && (
                              <a href={`${CANDIDATE_APP_URL}${a.portfolio_url}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] px-2 py-1 text-xs font-semibold text-[#0b0b0c]/70 hover:text-purple-600">
                                <Globe size={12} /> Portfolio
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {(a.screening_answers.length > 0 || Object.keys(a.form_responses || {}).length > 0) && (
                            <button
                              onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                              className="cursor-pointer p-1.5 rounded-lg text-[#0b0b0c]/50 hover:text-[#0b0b0c] hover:bg-black/[0.04]"
                              aria-label="Show answers"
                              aria-expanded={expanded === a.id}
                            >
                              <ChevronDown size={16} className={`transition-transform ${expanded === a.id ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded === a.id && (
                        <tr className="bg-black/[0.015]">
                          <td />
                          <td colSpan={6} className="px-5 pb-5 pt-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {a.screening_answers.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0b0b0c]/45 mb-2">Screening answers</div>
                                  <div className="flex flex-col gap-2">
                                    {a.screening_answers.map((ans, i) => (
                                      <div key={ans.question_id || i} className="rounded-xl bg-white border border-black/[0.08] px-3 py-2">
                                        <div className="text-[11px] font-semibold text-[#0b0b0c]/50">
                                          {a.screening_questions?.find((q) => q.id === ans.question_id)?.question || `Question ${i + 1}`}
                                        </div>
                                        <div className="text-sm text-[#0b0b0c]/80 whitespace-pre-wrap">{ans.answer_text || <span className="text-[#0b0b0c]/35">No answer</span>}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {Object.keys(a.form_responses || {}).length > 0 && (
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0b0b0c]/45 mb-2">Application form</div>
                                  <dl className="flex flex-col gap-2">
                                    {Object.entries(a.form_responses).map(([key, value]) => (
                                      <div key={key} className="rounded-xl bg-white border border-black/[0.08] px-3 py-2">
                                        <dt className="text-[11px] font-semibold text-[#0b0b0c]/50">{key.replace(/_/g, ' ')}</dt>
                                        <dd className="text-sm text-[#0b0b0c]/80 break-words">{String(value) || '—'}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                              )}
                            </div>
                            <Link href={`/jobs/${a.job_posting}/applicants`} className="mt-3 inline-block text-xs font-semibold text-purple-600 hover:underline">Open this posting&apos;s board →</Link>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {count > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            count={count}
            pageSize={pageSize}
            onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onPageSize={(size) => { setPageSize(size); setPage(1); }}
          />
        )}
      </div>

      {rejecting && (
        <RejectNoteModal
          count={rejecting.ids.length}
          busy={busy}
          onCancel={() => { setRejecting(null); load(); }}
          onConfirm={async (note) => {
            const ok = await moveStage(rejecting.ids, 'rejected', note);
            if (ok) setRejecting(null);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 rounded-full bg-[#0b0b0c] text-white px-4 py-2.5 text-sm font-medium shadow-lg">
          <Check size={15} className="text-green-400" /> {toast}
        </div>
      )}
    </div>
  );
}

function RejectNoteModal({ count, busy, onCancel, onConfirm }: {
  count: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !busy && onCancel()}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
        <h2 className="text-lg font-bold">Reject {count === 1 ? 'applicant' : `${count} applicants`}</h2>
        <p className="text-xs text-[#0b0b0c]/55 mt-1">This note is shown to the candidate{count > 1 ? 's' : ''}.</p>
        <textarea
          autoFocus
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. We've moved ahead with candidates whose experience more closely matches the role."
          className="mt-4 w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red-500 resize-none"
        />
        <div className="mt-4 flex gap-3">
          <button onClick={onCancel} disabled={busy} className="cursor-pointer flex-1 py-2.5 rounded-xl bg-black/[0.05] hover:bg-black/[0.10] text-sm font-bold disabled:opacity-40">Cancel</button>
          <button
            onClick={() => onConfirm(note.trim())}
            disabled={busy || !note.trim()}
            className="cursor-pointer flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={15} className="animate-spin" />} Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// Page numbers with ellipses: always the first and last page, plus a
// window of pages around the current one.
function pageList(page: number, totalPages: number): (number | '…')[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

function Pagination({ page, totalPages, count, pageSize, onPage, onPageSize }: {
  page: number;
  totalPages: number;
  count: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  const btn = 'cursor-pointer min-w-9 h-9 px-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-30 disabled:cursor-not-allowed';
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5">
      <div className="flex items-center gap-3 text-xs text-[#0b0b0c]/60 font-medium">
        <span>Showing {from}–{to} of {count}</span>
        <label className="flex items-center gap-1.5">
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="cursor-pointer bg-white border border-black/[0.08] rounded-lg py-1 px-2 text-xs text-[#0b0b0c] focus:outline-none focus:border-purple-500"
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <nav className="flex items-center gap-1.5" aria-label="Pagination">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} className={`${btn} bg-white border-black/[0.08] hover:bg-black/[0.03] flex items-center justify-center`} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        {pageList(page, totalPages).map((p, i) => (
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-[#0b0b0c]/40">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`${btn} ${p === page ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-black/[0.08] text-[#0b0b0c]/70 hover:bg-black/[0.03]'}`}
            >
              {p}
            </button>
          )
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className={`${btn} bg-white border-black/[0.08] hover:bg-black/[0.03] flex items-center justify-center`} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  );
}
