'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { MapPin, ExternalLink, GripVertical, Trash2, Briefcase, ArrowRight, Sparkles, X, Building2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import PricingModal from '@/components/PricingModal';
import { PRIMARY_BTN_BG } from '@/components/ui/landing-kit';
import { type Application, type ApplicationStage, type SavedPosting } from '@/lib/hiring-types';

// One shared board — a JobPosting application (stage set by the employer,
// read-only/not draggable here) and a self-tracked external job (candidate-
// driven, draggable) render as the same kind of card in the same columns.
// The two sources use different, differently-sized status vocabularies, so
// each maps onto this shared set rather than the columns being either
// source's own native list.
type UnifiedColumnKey = 'saved' | 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';

const UNIFIED_COLUMNS: { key: UnifiedColumnKey; label: string; dot: string; accent: string; chip: string }[] = [
  { key: 'saved', label: 'Saved', dot: 'bg-slate-400', accent: 'text-slate-600', chip: 'bg-slate-100' },
  { key: 'applied', label: 'Applied', dot: 'bg-blue-500', accent: 'text-blue-600', chip: 'bg-blue-50' },
  { key: 'screening', label: 'Screening', dot: 'bg-indigo-500', accent: 'text-indigo-600', chip: 'bg-indigo-50' },
  { key: 'interview', label: 'Interview', dot: 'bg-amber-500', accent: 'text-amber-600', chip: 'bg-amber-50' },
  { key: 'offer', label: 'Offer', dot: 'bg-[#16a34a]', accent: 'text-[#16a34a]', chip: 'bg-[#16a34a]/10' },
  { key: 'hired', label: 'Hired', dot: 'bg-[#15803d]', accent: 'text-[#15803d]', chip: 'bg-[#15803d]/10' },
  { key: 'rejected', label: 'Rejected', dot: 'bg-red-500', accent: 'text-red-600', chip: 'bg-red-50' },
];

const STAGE_LABELS: Record<ApplicationStage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
};

// Kaamlee's `screening`/`shortlisted` both fold into the shared "Screening"
// column — the external side has no equivalent granularity to justify two
// separate columns for it in a merged view.
const STAGE_TO_UNIFIED: Record<ApplicationStage, UnifiedColumnKey> = {
  applied: 'applied',
  screening: 'screening',
  shortlisted: 'screening',
  interview: 'interview',
  offer: 'offer',
  hired: 'hired',
  rejected: 'rejected',
};

// --- Saved & applied externally (scraped jobs, candidate-tracked) ---

interface ExternalJob {
  id: number;
  title: string;
  company: string | null;
  location_name: string;
  job_url: string;
  company_logo?: string;
  is_remote: boolean;
}

interface ExternalApplication {
  id: number;
  job: ExternalJob;
  status: string;
  status_updated_at: string;
}

// The external side's own 5-value vocabulary — what the status dropdown
// offers and what /api/jobs/<id>/update_status/ actually accepts. Distinct
// from UNIFIED_COLUMNS (which is display-only).
const EXTERNAL_STATUS_OPTIONS: { key: string; label: string }[] = [
  { key: 'saved', label: 'Saved' },
  { key: 'applied', label: 'Applied' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'offered', label: 'Offered' },
  { key: 'rejected', label: 'Rejected' },
];

const EXTERNAL_TO_UNIFIED: Record<string, UnifiedColumnKey> = {
  saved: 'saved',
  applied: 'applied',
  interviewing: 'interview',
  offered: 'offer',
  rejected: 'rejected',
};

// Inverse of the above, for turning a drop on a unified column back into a
// valid external status. 'screening' and 'hired' have no external
// equivalent (Kaamlee-only stages) — a drop there is rejected as a no-op.
const UNIFIED_TO_EXTERNAL_STATUS: Partial<Record<UnifiedColumnKey, string>> = {
  saved: 'saved',
  applied: 'applied',
  interview: 'interviewing',
  offer: 'offered',
  rejected: 'rejected',
};

type MergedCard =
  | { kind: 'kaamlee'; key: string; app: Application }
  | { kind: 'kaamlee-saved'; key: string; app: SavedPosting }
  | { kind: 'external'; key: string; app: ExternalApplication };

export default function ApplicationsPage() {
  const { token, logout } = useAuth();
  // Handles the redirect-to-login (and the loading state while auth itself
  // is still resolving) — without this, a token-less visit (logged out, or
  // a fresh tab that never got the sessionStorage-backed session) just left
  // both fetches below permanently skipped, with no way out of the loading
  // state. See apply/[id]/page.tsx for the bug this mirrors.
  const { isReady, isSubscribed } = useSubscriptionGate({ allowUnsubscribed: true });
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  // A card in stageApplications is, by definition, already submitted — so
  // clicking it opens this in-place detail view instead of sending the
  // candidate to /apply/[id], which for an already-applied posting just
  // shows a "you've applied, go back to the tracker" dead end.
  const [viewingApplication, setViewingApplication] = useState<Application | null>(null);

  const [stageApplications, setStageApplications] = useState<Application[]>([]);
  const [savedPostings, setSavedPostings] = useState<SavedPosting[]>([]);
  const [externalApplications, setExternalApplications] = useState<ExternalApplication[]>([]);
  const [isFetchingStage, setIsFetchingStage] = useState(true);
  const [isFetchingSaved, setIsFetchingSaved] = useState(true);
  const [isFetchingExternal, setIsFetchingExternal] = useState(true);
  const isFetching = isFetchingStage || isFetchingSaved || isFetchingExternal;

  const [draggingFrom, setDraggingFrom] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<UnifiedColumnKey | null>(null);

  useEffect(() => {
    const fetchApplications = async () => {
      if (!token) return;
      setIsFetchingStage(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/hiring/applications/mine/`, {
          headers: { 'Authorization': `Token ${token}` },
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) return;
        setStageApplications(await res.json());
      } catch (error) {
        console.error('Failed to fetch applications:', error);
      } finally {
        setIsFetchingStage(false);
      }
    };
    fetchApplications();
  }, [token, logout]);

  // Bookmarked-but-not-yet-applied postings (see PostingCard's bookmark
  // button on Explore) — these go in the shared "Saved" column too, so
  // bookmarking a posting there is actually visible somewhere. Filtered to
  // exclude anything already applied to (job_posting.has_applied), since
  // that same posting also has a real, non-saved card in stageApplications
  // once applied — without this it'd show up twice.
  useEffect(() => {
    const fetchSaved = async () => {
      if (!token) return;
      setIsFetchingSaved(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/hiring/saved/mine/`, {
          headers: { 'Authorization': `Token ${token}` },
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) return;
        setSavedPostings(await res.json());
      } catch (error) {
        console.error('Failed to fetch saved postings:', error);
      } finally {
        setIsFetchingSaved(false);
      }
    };
    fetchSaved();
  }, [token, logout]);

  useEffect(() => {
    const fetchExternal = async () => {
      if (!token) return;
      setIsFetchingExternal(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/applications/`, {
          headers: { 'Authorization': `Token ${token}` },
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) return;
        setExternalApplications(await res.json());
      } catch (error) {
        console.error('Failed to fetch external applications:', error);
      } finally {
        setIsFetchingExternal(false);
      }
    };
    fetchExternal();
  }, [token, logout]);

  const unifiedColumns = useMemo(() => {
    const grouped = {} as Record<UnifiedColumnKey, MergedCard[]>;
    UNIFIED_COLUMNS.forEach((c) => { grouped[c.key] = []; });
    stageApplications.forEach((app) => {
      grouped[STAGE_TO_UNIFIED[app.stage]].push({ kind: 'kaamlee', key: `k-${app.id}`, app });
    });
    savedPostings
      .filter((saved) => !saved.job_posting.has_applied)
      .forEach((saved) => {
        grouped.saved.push({ kind: 'kaamlee-saved', key: `s-${saved.id}`, app: saved });
      });
    externalApplications.forEach((app) => {
      const col = EXTERNAL_TO_UNIFIED[app.status];
      if (col) grouped[col].push({ kind: 'external', key: `e-${app.id}`, app });
    });
    return grouped;
  }, [stageApplications, savedPostings, externalApplications]);

  const visibleSavedCount = savedPostings.filter((s) => !s.job_posting.has_applied).length;
  const totalCount = stageApplications.length + visibleSavedCount + externalApplications.length;

  const moveExternalCard = useCallback((jobId: number, toStatus: string) => {
    setExternalApplications((prev) => prev.map((a) => (a.job.id === jobId ? { ...a, status: toStatus } : a)));
  }, []);

  const updateStatus = useCallback(async (jobId: number, fromStatus: string, toStatus: string) => {
    if (fromStatus === toStatus || !token) return;
    moveExternalCard(jobId, toStatus);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}/update_status/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: toStatus }),
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) moveExternalCard(jobId, fromStatus); // revert
    } catch (error) {
      console.error('Failed to update status:', error);
      moveExternalCard(jobId, fromStatus); // revert
    }
  }, [token, moveExternalCard, logout]);

  const removeCard = useCallback(async (jobId: number) => {
    if (!token) return;
    if (!confirm('Stop tracking this job? This removes it from the board and your bookmarks too.')) return;

    const removed = externalApplications.find((a) => a.job.id === jobId) || null;
    setExternalApplications((prev) => prev.filter((a) => a.job.id !== jobId));
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}/toggle_bookmark/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` },
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok && removed) setExternalApplications((prev) => [removed, ...prev]); // revert
    } catch (error) {
      console.error('Failed to remove application:', error);
      if (removed) setExternalApplications((prev) => [removed, ...prev]); // revert
    }
  }, [token, externalApplications, logout]);

  const handleDrop = (e: React.DragEvent, toColumn: UnifiedColumnKey) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (draggingId == null || draggingFrom == null) return;
    const toStatus = UNIFIED_TO_EXTERNAL_STATUS[toColumn];
    if (toStatus) updateStatus(draggingId, draggingFrom, toStatus);
    setDraggingId(null);
    setDraggingFrom(null);
  };

  const handleDragStart = (e: React.DragEvent, jobId: number, fromStatus: string) => {
    if (!isSubscribed) {
      e.preventDefault();
      setIsPricingOpen(true);
      return;
    }
    setDraggingId(jobId);
    setDraggingFrom(fromStatus);
  };

  const handleStatusSelect = (jobId: number, fromStatus: string, toStatus: string) => {
    if (!isSubscribed) {
      setIsPricingOpen(true);
      return;
    }
    updateStatus(jobId, fromStatus, toStatus);
  };

  const handleRemove = (jobId: number) => {
    if (!isSubscribed) {
      setIsPricingOpen(true);
      return;
    }
    removeCard(jobId);
  };

  if (!isReady) {
    return (
      <div className="h-screen bg-[#f2f3f5] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#16a34a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="h-screen flex bg-[#f2f3f5] overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          backHref="/dashboard"
          title="Application Tracker"
          badge={!isFetching && (
            <span
              className="text-[10px] sm:text-xs text-black/45 font-semibold shrink-0"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              {totalCount} tracked
            </span>
          )}
        />

        <div className="flex items-center gap-3 px-4 sm:px-6 py-2 bg-black/[0.03] border-b border-black/[0.08] shrink-0">
          <span className="text-[10px] sm:text-[11px] text-black/50 font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            <Sparkles size={11} className="inline -mt-0.5 mr-1 text-[#16a34a]" />
            applied on Kaamlee are read-only here (the employer moves those) — drag anything else to update where you stand. Screening and Hired are Kaamlee-only stages, so they won&apos;t accept a dragged card.
          </span>
        </div>

        {!isSubscribed && (
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2 bg-[#16a34a]/10 border-b border-[#16a34a]/20 shrink-0">
            <span
              className="text-[10px] sm:text-[11px] text-[#15803d] font-semibold"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              View only, subscribe to drag cards, change status, or stop tracking a job.
            </span>
            <button
              onClick={() => setIsPricingOpen(true)}
              style={{ ...PRIMARY_BTN_BG, fontFamily: 'var(--font-outfit)' }}
              className="cursor-pointer shrink-0 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold text-white shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_6px_16px_-8px_rgba(22,163,74,.85)] transition-transform duration-300 hover:-translate-y-0.5"
            >
              Unlock
            </button>
          </div>
        )}

        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div className="h-full flex gap-4 p-4 sm:p-6 min-w-max">
            {UNIFIED_COLUMNS.map((col) => {
              const cards = unifiedColumns[col.key] || [];
              const acceptsExternalDrop = !!UNIFIED_TO_EXTERNAL_STATUS[col.key];
              const isOver = dragOverColumn === col.key;
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => { if (acceptsExternalDrop) { e.preventDefault(); setDragOverColumn(col.key); } }}
                  onDragLeave={() => setDragOverColumn((prev) => (prev === col.key ? null : prev))}
                  onDrop={(e) => handleDrop(e, col.key)}
                  className={`w-[280px] sm:w-[300px] shrink-0 h-full flex flex-col rounded-[20px] border bg-white transition-colors duration-200 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] ${
                    isOver ? 'border-[#16a34a]/50 bg-[#16a34a]/5' : 'border-black/[0.08]'
                  }`}
                >
                  <div className="px-4 py-3 border-b border-black/[0.08] flex items-center gap-2 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <h2
                      className={`text-xs font-semibold uppercase tracking-widest ${col.accent}`}
                      style={{ fontFamily: 'var(--font-outfit)' }}
                    >
                      {col.label}
                    </h2>
                    {!acceptsExternalDrop && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-widest text-[#16a34a] bg-[#16a34a]/10 border border-[#16a34a]/20 px-1.5 py-0.5 rounded-full"
                        style={{ fontFamily: 'var(--font-outfit)' }}
                        title="Set by the employer — only Kaamlee applications can land here, dragging a card here does nothing"
                      >
                        Kaamlee only
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-semibold ml-auto ${col.chip} ${col.accent} px-2 py-0.5 rounded-full border border-black/[0.06]`}
                      style={{ fontFamily: 'var(--font-outfit)' }}
                    >
                      {cards.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 custom-scrollbar">
                    {isFetching ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-24 rounded-[16px] bg-black/[0.03] animate-pulse border border-black/[0.06]" />
                      ))
                    ) : cards.length === 0 ? (
                      <div
                        className="h-24 flex items-center justify-center text-[11px] text-black/40 text-center px-4"
                        style={{ fontFamily: 'var(--font-outfit)' }}
                      >
                        {col.key === 'saved' ? 'Bookmark a job to see it here' : 'Nothing here yet'}
                      </div>
                    ) : (
                      cards.map((card) => (
                        card.kind === 'kaamlee' ? (
                          <div
                            key={card.key}
                            role="button"
                            tabIndex={0}
                            onClick={() => setViewingApplication(card.app)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setViewingApplication(card.app); }}
                            className="group block p-3 rounded-[16px] border border-[#16a34a]/20 bg-[#16a34a]/[0.03] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)] transition-all duration-300 cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5 mb-2">
                              <Sparkles size={10} className="text-[#16a34a] shrink-0" />
                              <span className="text-[9px] font-bold uppercase tracking-widest text-[#16a34a]" style={{ fontFamily: 'var(--font-outfit)' }}>
                                Via Kaamlee
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5">
                              {card.app.employer_logo ? (
                                <img src={card.app.employer_logo} alt="" className="w-8 h-8 rounded-lg object-contain bg-white border border-black/[0.06] shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-black/[0.04] flex items-center justify-center text-black/40 shrink-0">
                                  <Briefcase size={13} />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <h3
                                  className="text-xs font-semibold text-[#0b0b0c] truncate group-hover:text-[#16a34a] transition-colors"
                                  style={{ fontFamily: 'var(--font-outfit)' }}
                                >
                                  {card.app.job_posting_title}
                                </h3>
                                <p className="text-[11px] text-[rgba(61,61,61,0.72)] truncate mt-0.5">{card.app.employer_name}</p>
                                <div className="flex items-center gap-1 text-[10px] text-black/40 mt-1.5">
                                  <span>{new Date(card.app.applied_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                  <ArrowRight size={10} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            </div>
                            {card.app.stage === 'rejected' && card.app.rejection_note && (
                              <div className="mt-2.5 text-[10px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2 leading-relaxed">
                                {card.app.rejection_note}
                              </div>
                            )}
                          </div>
                        ) : card.kind === 'kaamlee-saved' ? (
                          <Link
                            key={card.key}
                            href={`/apply/${card.app.job_posting.id}`}
                            className="group block p-3 rounded-[16px] border border-[#16a34a]/20 bg-[#16a34a]/[0.03] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)] transition-all duration-300"
                          >
                            <div className="flex items-center gap-1.5 mb-2">
                              <Sparkles size={10} className="text-[#16a34a] shrink-0" />
                              <span className="text-[9px] font-bold uppercase tracking-widest text-[#16a34a]" style={{ fontFamily: 'var(--font-outfit)' }}>
                                Saved · Not applied yet
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5">
                              {card.app.job_posting.employer_logo ? (
                                <img src={card.app.job_posting.employer_logo} alt="" className="w-8 h-8 rounded-lg object-contain bg-white border border-black/[0.06] shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-black/[0.04] flex items-center justify-center text-black/40 shrink-0">
                                  <Briefcase size={13} />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <h3
                                  className="text-xs font-semibold text-[#0b0b0c] truncate group-hover:text-[#16a34a] transition-colors"
                                  style={{ fontFamily: 'var(--font-outfit)' }}
                                >
                                  {card.app.job_posting.title}
                                </h3>
                                <p className="text-[11px] text-[rgba(61,61,61,0.72)] truncate mt-0.5">{card.app.job_posting.employer_name}</p>
                                <div className="flex items-center gap-1 text-[10px] text-black/40 mt-1.5">
                                  <span>Saved {new Date(card.app.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                  <ArrowRight size={10} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            </div>
                          </Link>
                        ) : (
                          <div
                            key={card.key}
                            draggable
                            onDragStart={(e) => handleDragStart(e, card.app.job.id, card.app.status)}
                            onDragEnd={() => { setDraggingId(null); setDraggingFrom(null); setDragOverColumn(null); }}
                            className={`group p-3 rounded-[16px] border border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)] transition-all duration-300 ${
                              isSubscribed ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                            } ${draggingId === card.app.job.id ? 'opacity-40' : ''}`}
                          >
                            <div className="flex items-start gap-2">
                              <GripVertical size={13} className="text-black/25 mt-0.5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <h3
                                  className="text-xs font-semibold text-[#0b0b0c] truncate"
                                  style={{ fontFamily: 'var(--font-outfit)' }}
                                >
                                  {card.app.job.title}
                                </h3>
                                <p className="text-[11px] text-[rgba(61,61,61,0.72)] truncate mt-0.5">{card.app.job.company || 'Confidential'}</p>
                                {card.app.job.location_name && (
                                  <div className="flex items-center gap-1 text-[10px] text-black/45 mt-1.5 truncate">
                                    <MapPin size={10} className="shrink-0" />
                                    <span className="truncate">{card.app.job.location_name}</span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between mt-2.5">
                                  <select
                                    value={card.app.status}
                                    onChange={(e) => handleStatusSelect(card.app.job.id, card.app.status, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ fontFamily: 'var(--font-outfit)' }}
                                    className="text-[10px] bg-white border border-black/[0.10] rounded-lg px-1.5 py-1 text-black/60 cursor-pointer focus:outline-none focus:border-[#16a34a]/40"
                                  >
                                    {EXTERNAL_STATUS_OPTIONS.map((c) => (
                                      <option key={c.key} value={c.key}>{c.label}</option>
                                    ))}
                                  </select>
                                  <div className="flex items-center">
                                    <a
                                      href={card.app.job.job_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-black/35 hover:text-[#16a34a] transition-colors p-1"
                                      title="Open job posting"
                                    >
                                      <ExternalLink size={12} />
                                    </a>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRemove(card.app.job.id); }}
                                      className="cursor-pointer text-black/35 hover:text-red-600 transition-colors p-1"
                                      title="Stop tracking"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 4px;
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.12);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.22);
        }
      `}</style>

      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />

      {viewingApplication && (
        <ApplicationDetailModal application={viewingApplication} onClose={() => setViewingApplication(null)} />
      )}
    </main>
  );
}

function ApplicationDetailModal({ application, onClose }: { application: Application; onClose: () => void }) {
  const unified = UNIFIED_COLUMNS.find((c) => c.key === STAGE_TO_UNIFIED[application.stage]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white border border-black/[0.08] rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-black/[0.08] sticky top-0 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            {application.employer_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={application.employer_logo} alt="" className="w-11 h-11 rounded-xl object-contain bg-black/[0.04] shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-black/[0.04] flex items-center justify-center text-black/40 shrink-0">
                <Building2 size={18} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#0b0b0c] truncate" style={{ fontFamily: 'var(--font-outfit)' }}>
                {application.job_posting_title}
              </h2>
              <p className="text-xs text-black/50 truncate">{application.employer_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="cursor-pointer p-2 rounded-xl bg-black/[0.04] hover:bg-black/[0.06] transition-all text-black/40 hover:text-[#0b0b0c] shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>Status</div>
              {unified && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${unified.chip} ${unified.accent}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${unified.dot}`} />
                  {STAGE_LABELS[application.stage]}
                </span>
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>Applied</div>
              <p className="text-sm text-[#0b0b0c]">{new Date(application.applied_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>

          {application.stage === 'rejected' && application.rejection_note && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 leading-relaxed">
              {application.rejection_note}
            </div>
          )}

          {Object.keys(application.form_responses || {}).length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2" style={{ fontFamily: 'var(--font-outfit)' }}>Your answers</div>
              <div className="space-y-2.5">
                {Object.entries(application.form_responses).map(([key, value]) => (
                  <div key={key} className="bg-black/[0.03] border border-black/[0.06] rounded-xl px-3.5 py-2.5">
                    <div className="text-[10px] font-semibold text-black/45 mb-0.5">{key}</div>
                    <div className="text-sm text-[#0b0b0c] whitespace-pre-wrap break-words">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {application.screening_answers?.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2" style={{ fontFamily: 'var(--font-outfit)' }}>Screening answers</div>
              <div className="space-y-2.5">
                {application.screening_answers.map((a, i) => (
                  <div key={a.question_id} className="bg-black/[0.03] border border-black/[0.06] rounded-xl px-3.5 py-2.5">
                    <div className="text-[10px] font-semibold text-black/45 mb-0.5">Question {i + 1}</div>
                    <div className="text-sm text-[#0b0b0c] whitespace-pre-wrap break-words">{a.answer_text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
