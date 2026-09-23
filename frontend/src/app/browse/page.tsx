'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles, Kanban, ArrowUpRight, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { JobCard } from '@/components/JobCard';
import { PostingCard } from '@/components/PostingCard';
import { useAuth } from '@/context/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { CARD_CLS } from '@/components/ui/landing-kit';
import type { JobPosting, ApplicationStage } from '@/lib/hiring-types';

const API = process.env.NEXT_PUBLIC_API_URL;
const JOBS_PER_PAGE = 10;
// Side panel is a glance, not the tracker — the rest live behind "Open tracker".
const MAX_APPLIED_SHOWN = 6;

type SuggestedPosting = JobPosting & { match_reason: string; match_score: number };
type ScrapedJob = React.ComponentProps<typeof JobCard>['job'];
// /hiring/feed/ items — scraped jobs and employer postings, already mixed.
type FeedItem = { kind: 'job'; data: ScrapedJob } | { kind: 'posting'; data: JobPosting };

interface KaamleeApplication {
  id: number;
  job_posting: number;
  job_posting_title: string;
  employer_name: string;
  stage: ApplicationStage;
  applied_at: string;
}

interface TrackedJob {
  id: number;
  status: string;
  status_updated_at: string;
  job: { id: number; title: string; company: string | null; job_url: string };
}

// One row in the "Your applications" panel, whichever side it came from.
interface AppliedRow {
  key: string;
  title: string;
  company: string;
  status: string;
  tone: 'active' | 'good' | 'bad';
  href: string;
  external: boolean;
  at: string;
}

const STAGE_LABELS: Record<ApplicationStage, string> = {
  applied: 'Applied', screening: 'Screening', shortlisted: 'Shortlisted',
  interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected',
};
const EXTERNAL_LABELS: Record<string, string> = {
  applied: 'Applied', interviewing: 'Interviewing', offered: 'Offer', rejected: 'Rejected',
};
const TONE_CLS: Record<AppliedRow['tone'], string> = {
  active: 'bg-[#16a34a]/10 text-[#16a34a]',
  good: 'bg-blue-500/10 text-blue-600',
  bad: 'bg-red-500/10 text-red-600',
};

type TriState = 'all' | 'yes' | 'no';

function Segmented({ label, value, onChange, options }: {
  label: string;
  value: TriState;
  onChange: (v: TriState) => void;
  options: [TriState, string][];
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-black/[0.10] bg-white p-1" role="group" aria-label={label} style={{ fontFamily: 'var(--font-outfit)' }}>
      <span className="pl-2 pr-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/40">{label}</span>
      {options.map(([key, text]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={`cursor-pointer rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-all ${
            value === key ? 'bg-[#16a34a]/10 text-[#16a34a]' : 'text-black/55 hover:text-[#0b0b0c]'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const toneFor = (status: string): AppliedRow['tone'] =>
  status === 'rejected' ? 'bad' : ['offer', 'offered', 'hired'].includes(status) ? 'good' : 'active';

export default function BrowsePage() {
  const { token, logout } = useAuth();
  // Free users get in too — the jobs list is the same capped preview Explore shows them.
  const { isReady } = useSubscriptionGate({ allowUnsubscribed: true });

  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('All');
  const [remote, setRemote] = useState<TriState>('all');
  const [bookmarked, setBookmarked] = useState<TriState>('all');

  const [suggested, setSuggested] = useState<SuggestedPosting[]>([]);
  const [personalized, setPersonalized] = useState(false);
  const [loadingSuggested, setLoadingSuggested] = useState(true);
  const suggestRowRef = useRef<HTMLDivElement>(null);

  // Arrow buttons page the suggestions row by roughly one card.
  const scrollSuggestions = (dir: -1 | 1) => {
    suggestRowRef.current?.scrollBy({ left: dir * 412, behavior: 'smooth' });
  };

  const [jobs, setJobs] = useState<FeedItem[]>([]);
  const [jobsCount, setJobsCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const [applied, setApplied] = useState<AppliedRow[]>([]);
  const [loadingApplied, setLoadingApplied] = useState(true);

  const authed = useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { ...init, headers: { ...(init?.headers || {}), Authorization: `Token ${token}` } });
    if (res.status === 401) logout();
    return res;
  }, [token, logout]);

  // Categories + suggestions + applications load once.
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/categories/`).then((r) => r.json()).then((d) => Array.isArray(d) && setCategories(d)).catch(() => {});

    authed(`${API}/hiring/jobs/suggested/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) { setSuggested(d.results || []); setPersonalized(!!d.personalized); }
      })
      .catch(() => {})
      .finally(() => setLoadingSuggested(false));

    Promise.all([
      authed(`${API}/hiring/applications/mine/`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      authed(`${API}/api/applications/`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([kaamlee, tracked]: [KaamleeApplication[], TrackedJob[]]) => {
      const rows: AppliedRow[] = [
        ...(Array.isArray(kaamlee) ? kaamlee : []).map((a) => ({
          key: `k-${a.id}`,
          title: a.job_posting_title,
          company: a.employer_name,
          status: STAGE_LABELS[a.stage] ?? a.stage,
          tone: toneFor(a.stage),
          href: `/apply/${a.job_posting}`,
          external: false,
          at: a.applied_at,
        })),
        // Bookmarks double as the external tracker — only the ones actually
        // applied to belong here, not plain saves.
        ...(Array.isArray(tracked) ? tracked : [])
          .filter((t) => t.status !== 'saved')
          .map((t) => ({
            key: `e-${t.id}`,
            title: t.job.title,
            company: t.job.company || 'Confidential',
            status: EXTERNAL_LABELS[t.status] ?? t.status,
            tone: toneFor(t.status),
            href: t.job.job_url,
            external: true,
            at: t.status_updated_at,
          })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setApplied(rows);
    }).finally(() => setLoadingApplied(false));
  }, [token, authed]);

  const selectCategory = (c: string) => {
    setCategory(c);
    setPage(1);
  };
  const selectRemote = (v: TriState) => { setRemote(v); setPage(1); };
  const selectBookmarked = (v: TriState) => { setBookmarked(v); setPage(1); };

  // One mixed, shuffled list of scraped jobs + employer postings from the
  // combined feed (non-subscribers get the shared 200-job preview).
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams({ page: String(page), page_size: String(JOBS_PER_PAGE) });
    if (category !== 'All') params.set('category', category);
    if (remote !== 'all') params.set('is_remote', remote === 'yes' ? 'true' : 'false');
    if (bookmarked !== 'all') params.set('bookmarked', bookmarked === 'yes' ? 'true' : 'false');
    setLoadingJobs(true);
    authed(`${API}/hiring/feed/?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setJobs((d.results || []).map((item: FeedItem) => (
          item.kind === 'job'
            ? { kind: 'job', data: { ...item.data, location: (item.data as ScrapedJob & { location_name: string }).location_name } }
            : item
        )));
        setJobsCount(d.count ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoadingJobs(false));
  }, [token, category, remote, bookmarked, page, authed]);

  const toggleJobBookmark = useCallback(async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    const res = await authed(`${API}/api/jobs/${jobId}/toggle_bookmark/`, { method: 'POST' }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setJobs((prev) => prev.map((item) => (
        item.kind === 'job' && item.data.id === jobId
          ? { kind: 'job', data: { ...item.data, is_bookmarked: data.is_bookmarked } }
          : item
      )));
    }
  }, [authed]);

  // Saving a posting is a separate mechanism (hiring.SavedJob): POST saves,
  // DELETE unsaves, no body back — flip optimistically, revert on failure.
  const togglePostingSave = useCallback(async (e: React.MouseEvent, postingId: number) => {
    e.stopPropagation();
    const feedPostings = jobs.flatMap((item) => (item.kind === 'posting' ? [item.data] : []));
    const current = [...feedPostings, ...suggested].find((p) => p.id === postingId);
    if (!current) return;
    const next = !current.is_saved;
    // A posting can be in both the suggestions row and the feed.
    const flip = (value: boolean) => {
      setJobs((prev) => prev.map((item) => (
        item.kind === 'posting' && item.data.id === postingId
          ? { kind: 'posting', data: { ...item.data, is_saved: value } }
          : item
      )));
      setSuggested((prev) => prev.map((p) => (p.id === postingId ? { ...p, is_saved: value } : p)));
    };
    flip(next);
    const res = await authed(`${API}/hiring/saved/${postingId}/`, { method: next ? 'POST' : 'DELETE' }).catch(() => null);
    if (!res?.ok) flip(!next);
  }, [authed, jobs, suggested]);

  const totalPages = Math.max(1, Math.ceil(jobsCount / JOBS_PER_PAGE));
  const totalInCategory = jobsCount;
  const chips = useMemo(() => ['All', ...categories], [categories]);

  if (!isReady) {
    return (
      <div className="h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#16a34a] animate-spin" />
      </div>
    );
  }

  return (
    <main className="h-screen flex bg-[#f2f3f5] text-[#0b0b0c] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/dashboard" title="Browse" />

        <div className="flex-1 overflow-y-auto" id="jobs-scroll">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
            {/* Suggested */}
            <section className="mb-8">
              <div className="flex items-end justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-[20px] font-semibold tracking-[-0.02em] flex items-center gap-2" style={{ fontFamily: 'var(--font-outfit)' }}>
                    Suggested for you
                  </h2>
                  <p className="text-[13px] text-black/50 mt-0.5">
                    {personalized
                      ? 'Kaamlee jobs you can apply to directly, matched to your resume and interests.'
                      : 'Fresh Kaamlee jobs you can apply to directly. Upload a resume for sharper matches.'}
                  </p>
                </div>
                {suggested.length > 1 && (
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {([-1, 1] as const).map((dir) => (
                      <button
                        key={dir}
                        onClick={() => scrollSuggestions(dir)}
                        aria-label={dir < 0 ? 'Previous suggestions' : 'More suggestions'}
                        className="cursor-pointer grid h-9 w-9 place-items-center rounded-full border border-black/[0.10] bg-white text-black/55 hover:text-[#0b0b0c] hover:border-black/20 transition-all"
                      >
                        {dir < 0 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {loadingSuggested ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-[#16a34a] animate-spin" /></div>
              ) : suggested.length === 0 ? (
                <div className={`${CARD_CLS} p-6 text-center text-[14px] text-black/50`}>
                  bookmark some postings to see them here, or check back later for new suggestions.
                </div>
              ) : (
                <div className="relative">
                  <div
                    ref={suggestRowRef}
                    className="mx-0 px-4 sm:px-6 flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth py-1"
                  >
                    {suggested.map((p) => (
                      <div key={p.id} className="w-[340px] sm:w-[400px] shrink-0 snap-start flex flex-col">
                        <div className="mb-1.5 ml-1 self-start inline-flex items-center gap-1 rounded-full bg-[#16a34a]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#16a34a]" style={{ fontFamily: 'var(--font-outfit)' }}>
                          <Sparkles size={10} /> {p.match_reason}
                        </div>
                        <PostingCard posting={p} onToggleBookmark={togglePostingSave} className="flex-1" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
              {/* All jobs, category filter only */}
              <section className="min-w-0">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-[20px] font-semibold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-outfit)' }}>All jobs</h2>
                  <span className="text-[13px] text-black/45">{totalInCategory.toLocaleString()} {category === 'All' ? 'total' : `in ${category}`}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Segmented
                    label="Remote"
                    value={remote}
                    onChange={selectRemote}
                    options={[['all', 'All'], ['yes', 'Remote'], ['no', 'On-site']]}
                  />
                  <Segmented
                    label="Bookmarks"
                    value={bookmarked}
                    onChange={selectBookmarked}
                    options={[['all', 'All'], ['yes', 'Bookmarked'], ['no', 'Not bookmarked']]}
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4 -mx-1 px-1">
                  {chips.map((c) => (
                    <button
                      key={c}
                      onClick={() => selectCategory(c)}
                      className={`cursor-pointer shrink-0 rounded-full px-4 py-2 text-[13px] font-medium border transition-all ${
                        category === c
                          ? 'bg-[#0b0b0c] text-white border-[#0b0b0c]'
                          : 'bg-white text-black/60 border-black/[0.10] hover:text-[#0b0b0c] hover:border-black/20'
                      }`}
                      style={{ fontFamily: 'var(--font-outfit)' }}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  {loadingJobs ? (
                    <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 text-[#16a34a] animate-spin" /></div>
                  ) : (
                    jobs.map((item) => (
                      item.kind === 'posting'
                        ? <PostingCard key={`p-${item.data.id}`} posting={item.data} onToggleBookmark={togglePostingSave} />
                        : <JobCard key={item.data.id} job={item.data} onToggleBookmark={toggleJobBookmark} />
                    ))
                  )}
                  {!loadingJobs && jobs.length === 0 && (
                    <div className={`${CARD_CLS} p-10 text-center`}>
                      <Briefcase className="w-8 h-8 text-black/20 mx-auto mb-3" />
                      <p className="text-[14px] text-black/50">No jobs match these filters right now.</p>
                    </div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-5">
                    <button
                      onClick={() => { setPage((p) => Math.max(1, p - 1)); document.getElementById('jobs-scroll')?.scrollTo({ top: 0 }); }}
                      disabled={page === 1}
                      className="cursor-pointer inline-flex items-center gap-1 rounded-full border border-black/[0.10] bg-white px-4 py-2 text-[13px] font-medium text-black/60 hover:text-[#0b0b0c] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={15} /> Previous
                    </button>
                    <span className="text-[13px] text-black/50">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); document.getElementById('jobs-scroll')?.scrollTo({ top: 0 }); }}
                      disabled={page === totalPages}
                      className="cursor-pointer inline-flex items-center gap-1 rounded-full border border-black/[0.10] bg-white px-4 py-2 text-[13px] font-medium text-black/60 hover:text-[#0b0b0c] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </section>

              {/* Applied — alongside the list */}
              <aside className={`${CARD_CLS} p-5 lg:sticky lg:top-2`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[16px] font-semibold tracking-[-0.01em] flex items-center gap-2" style={{ fontFamily: 'var(--font-outfit)' }}>
                    <Kanban size={16} className="text-[#16a34a]" /> Your applications
                  </h2>
                  <span className="text-[12px] text-black/45">{applied.length}</span>
                </div>

                {loadingApplied ? (
                  <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 text-[#16a34a] animate-spin" /></div>
                ) : applied.length === 0 ? (
                  <p className="text-[13px] text-black/50 py-4 text-center">You haven&apos;t applied anywhere yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {applied.slice(0, MAX_APPLIED_SHOWN).map((a) => {
                      const body = (
                        <>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-medium truncate">{a.title}</div>
                            <div className="text-[12px] text-black/45 truncate">{a.company}</div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_CLS[a.tone]}`}>{a.status}</span>
                        </>
                      );
                      const cls = 'flex items-center gap-3 rounded-[14px] border border-black/[0.06] bg-[#fafafa] px-3 py-2.5 hover:border-[#16a34a]/30 transition-colors';
                      return a.external ? (
                        <a key={a.key} href={a.href} target="_blank" rel="noreferrer" className={cls}>{body}</a>
                      ) : (
                        <Link key={a.key} href={a.href} className={cls}>{body}</Link>
                      );
                    })}
                  </div>
                )}

                <Link href="/applications" className="mt-4 flex items-center justify-center gap-1 text-[13px] font-medium text-[#16a34a] hover:text-[#15803d]" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {applied.length > MAX_APPLIED_SHOWN ? `View all ${applied.length} in tracker` : 'Open tracker'} <ArrowUpRight size={14} />
                </Link>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
