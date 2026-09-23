'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  RefreshCcw,
  Briefcase,
  MapPin,
  Users,
  ShieldCheck,
  ShieldAlert,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Mail,
  Phone,
  FileText,
  ExternalLink,
  Download,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const HIRING_BASE = `${process.env.NEXT_PUBLIC_API_URL}/hiring`;
const EMPLOYERS_BASE = `${process.env.NEXT_PUBLIC_API_URL}/employers`;
const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;
const PAGE_SIZE = 20;

type JobStatus = 'draft' | 'published' | 'paused' | 'closed';
type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship';
type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead';

const EMPLOYMENT_TYPE_OPTIONS: [EmploymentType, string][] = [
  ['full_time', 'Full-time'],
  ['part_time', 'Part-time'],
  ['contract', 'Contract'],
  ['internship', 'Internship'],
];

const EXPERIENCE_LEVEL_OPTIONS: [ExperienceLevel, string][] = [
  ['entry', 'Entry level'],
  ['mid', 'Mid level'],
  ['senior', 'Senior'],
  ['lead', 'Lead / Principal'],
];

const STATUS_OPTIONS: [JobStatus, string][] = [
  ['published', 'Published'],
  ['draft', 'Draft'],
  ['paused', 'Paused'],
  ['closed', 'Closed'],
];

interface EmployerOption {
  id: number;
  name: string;
  kyc_status: 'pending' | 'approved' | 'rejected';
}

interface FormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

interface ScreeningQuestion {
  id: string;
  question: string;
}

interface Posting {
  id: number;
  employer: number;
  employer_name: string;
  employer_logo: string | null;
  employer_kyc_status: 'pending' | 'approved' | 'rejected';
  title: string;
  description: string;
  employment_type: EmploymentType;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  city: string;
  state: string;
  country: string;
  is_remote: boolean;
  experience_level: ExperienceLevel;
  category: string;
  status: JobStatus;
  application_form_schema: FormField[];
  screening_questions: ScreeningQuestion[];
  applications_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  closes_at: string | null;
}

type StatusFilter = 'all' | JobStatus;

// Summary for the cards above the table — follows search but not the
// status tab (see AdminJobPostingListView.list).
interface PostingStats {
  total: number;
  published: number;
  draft: number;
  paused: number;
  closed: number;
  applications: number;
  employers: number;
  most_recent_created: string | null;
}

const STATUS_STYLES: Record<JobStatus, string> = {
  draft: 'bg-black/[0.05] text-[#0b0b0c]/55 border-black/[0.08]',
  published: 'bg-green-500/10 text-green-700 border-green-500/30',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  closed: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  entry: 'Entry level',
  mid: 'Mid level',
  senior: 'Senior',
  lead: 'Lead / Principal',
};

function PostingStatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-black/[0.08] rounded-2xl p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-black/[0.04] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-[#0b0b0c]/60 font-black uppercase tracking-[0.2em] mb-0.5">{label}</div>
        <div className="text-lg font-bold truncate">{value}</div>
        {sub && <div className="text-xs text-[#0b0b0c]/55 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysAgo(value: string | null) {
  if (!value) return null;
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function formatSalary(p: Posting): string | null {
  if (p.salary_min == null && p.salary_max == null) return null;
  const fmt = (n: number) => n.toLocaleString('en-IN');
  if (p.salary_min != null && p.salary_max != null) {
    return `${p.salary_currency} ${fmt(p.salary_min)} – ${fmt(p.salary_max)}`;
  }
  return `${p.salary_currency} ${fmt((p.salary_min ?? p.salary_max) as number)}+`;
}

function formatLocation(p: Posting): string {
  const parts = [p.city, p.state, p.country].filter(Boolean);
  if (p.is_remote) return parts.length ? `Remote · ${parts.join(', ')}` : 'Remote';
  return parts.length ? parts.join(', ') : 'Unspecified';
}

export default function PostingsPage() {
  const [postings, setPostings] = useState<Posting[]>([]);
  const [count, setCount] = useState(0);
  const [stats, setStats] = useState<PostingStats | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedPosting, setSelectedPosting] = useState<Posting | null>(null);
  const [deletingPosting, setDeletingPosting] = useState<Posting | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingApplicantsFor, setViewingApplicantsFor] = useState<Posting | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [employerOptions, setEmployerOptions] = useState<EmployerOption[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const router = useRouter();

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const getToken = () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return null;
    }
    return token;
  };

  const fetchPostings = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search) params.set('search', search);

    setLoading(true);
    try {
      const res = await fetch(`${HIRING_BASE}/admin/jobs/?${params.toString()}`, {
        headers: { Authorization: `Token ${token}` },
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setPostings(data.results);
        setCount(data.count);
        setStats(data.stats ?? null);
      }
    } catch (error) {
      console.error('Failed to fetch postings:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchPostings();
  }, [fetchPostings]);

  // Populated lazily (on first modal open) rather than on page load — these
  // only matter for the create form, not for viewing the list.
  const loadCreateFormData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const [employersRes, categoriesRes] = await Promise.all([
      fetch(`${EMPLOYERS_BASE}/admin/kyc/?page_size=100`, { headers: { Authorization: `Token ${token}` } }),
      fetch(`${API_BASE}/categories/`),
    ]);
    if (employersRes.ok) {
      const data = await employersRes.json();
      setEmployerOptions(
        (data.results as EmployerOption[]).slice().sort((a, b) => a.name.localeCompare(b.name))
      );
    }
    if (categoriesRes.ok) {
      setCategories(await categoriesRes.json());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateModal = () => {
    setShowCreateModal(true);
    if (employerOptions.length === 0) loadCreateFormData();
  };

  const createPosting = async (payload: Record<string, unknown>): Promise<string | null> => {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${HIRING_BASE}/admin/jobs/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        return Object.values(data).flat().join(' ') || 'Failed to create posting.';
      }
      setPostings((prev) => [data as Posting, ...prev]);
      setCount((prev) => prev + 1);
      adjustStats(data as Posting, 1);
      setShowCreateModal(false);
      return null;
    } catch {
      return 'Failed to reach the server.';
    }
  };

  // Keep the summary cards in step with a local create/delete instead of
  // refetching the whole page.
  const adjustStats = (posting: Posting, delta: 1 | -1) => {
    setStats((prev) => prev && {
      ...prev,
      total: prev.total + delta,
      [posting.status]: prev[posting.status] + delta,
      applications: prev.applications + delta * (posting.applications_count ?? 0),
      most_recent_created: delta === 1 ? posting.created_at : prev.most_recent_created,
    });
  };

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const selectStatus = (status: StatusFilter) => {
    setStatusFilter(status);
    setPage(1);
  };

  const deletePosting = async () => {
    if (!deletingPosting) return;
    const token = getToken();
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`${HIRING_BASE}/admin/jobs/${deletingPosting.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      });
      if (res.ok) {
        setPostings((prev) => prev.filter((p) => p.id !== deletingPosting.id));
        setCount((prev) => prev - 1);
        adjustStats(deletingPosting, -1);
        setDeletingPosting(null);
        if (selectedPosting?.id === deletingPosting.id) setSelectedPosting(null);
      } else {
        alert('Failed to delete posting');
      }
    } catch (error) {
      alert('Failed to delete posting');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <Briefcase size={28} className="text-purple-600" />
              Job Postings
            </h1>
            <p className="text-[#0b0b0c]/60 font-medium">
              {count.toLocaleString()} posting{count !== 1 ? 's' : ''} from employers{statusFilter !== 'all' ? ` · ${statusFilter}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0b0b0c]/60" size={18} />
              <input
                type="text"
                placeholder="Search by title or employer..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                className="w-72 bg-white border border-black/[0.08] rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
            <button
              onClick={() => fetchPostings()}
              className="cursor-pointer p-3 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] transition-all"
              title="Refresh"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={openCreateModal}
              className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20"
            >
              <Plus size={18} />
              Post a job
            </button>
          </div>
        </header>

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <PostingStatTile
              icon={<Briefcase size={16} className="text-purple-600" />}
              label="Total Postings"
              value={stats.total.toLocaleString()}
              sub={`${stats.employers.toLocaleString()} employer${stats.employers !== 1 ? 's' : ''}`}
            />
            <PostingStatTile
              icon={<CheckCircle2 size={16} className="text-green-600" />}
              label="Published"
              value={stats.published.toLocaleString()}
              sub={`${stats.draft} draft · ${stats.paused} paused · ${stats.closed} closed`}
            />
            <PostingStatTile
              icon={<Users size={16} className="text-blue-500" />}
              label="Applications"
              value={stats.applications.toLocaleString()}
              sub={stats.published > 0 ? `${(stats.applications / stats.published).toFixed(1)} per published posting` : undefined}
            />
            <PostingStatTile
              icon={<Calendar size={16} className="text-orange-500" />}
              label="Last Created"
              value={formatDate(stats.most_recent_created)}
              sub={daysAgo(stats.most_recent_created) ?? undefined}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-8">
          {([
            ['all', 'All'],
            ['published', 'Published'],
            ['draft', 'Draft'],
            ['paused', 'Paused'],
            ['closed', 'Closed'],
          ] as [StatusFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => selectStatus(key)}
              className={`cursor-pointer px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                statusFilter === key
                  ? 'bg-purple-600/15 text-purple-600 border-purple-600/30'
                  : 'bg-white text-[#0b0b0c]/40 border-black/[0.08] hover:text-[#0b0b0c]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
            <p className="text-[#0b0b0c]/60 text-xs font-bold uppercase tracking-widest">Loading postings</p>
          </div>
        ) : (
          <div className="bg-white border border-black/[0.08] rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] bg-black/[0.02]">
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Posting</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Employer</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Location</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Applications</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Status</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Posted</th>
                  <th className="text-right px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                <AnimatePresence mode="popLayout">
                  {postings.map((p) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedPosting(p)}
                      className="cursor-pointer hover:bg-black/[0.02] transition-colors align-top"
                    >
                      <td className="px-6 py-5">
                        <div className="font-bold text-[#0b0b0c] text-sm leading-tight max-w-[280px] truncate" title={p.title}>{p.title}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/[0.04] text-[#0b0b0c]/55">
                            {p.category}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/[0.04] text-[#0b0b0c]/55">
                            {EMPLOYMENT_TYPE_LABELS[p.employment_type]}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2.5">
                          {p.employer_logo ? (
                            <img src={p.employer_logo} alt="" className="w-8 h-8 rounded-lg object-contain bg-white border border-black/[0.06] shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 font-bold text-xs shrink-0">
                              {p.employer_name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate max-w-[160px]">{p.employer_name}</div>
                            <div className="flex items-center gap-1 text-[10px] text-[#0b0b0c]/55">
                              {p.employer_kyc_status === 'approved' ? (
                                <><ShieldCheck size={11} className="text-green-600" /> Verified</>
                              ) : (
                                <><ShieldAlert size={11} className="text-amber-600" /> {p.employer_kyc_status}</>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-1.5 text-sm text-[#0b0b0c]/40">
                          <MapPin size={13} className="shrink-0" />
                          <span className="truncate max-w-[160px]">{formatLocation(p)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setViewingApplicantsFor(p)}
                          disabled={p.applications_count === 0}
                          className="cursor-pointer flex items-center gap-1.5 text-sm text-[#0b0b0c]/55 hover:text-purple-600 disabled:hover:text-[#0b0b0c]/55 disabled:cursor-default transition-colors"
                          title={p.applications_count > 0 ? 'View applicants' : undefined}
                        >
                          <Users size={13} className="shrink-0" />
                          {p.applications_count}
                        </button>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${STATUS_STYLES[p.status]}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-[#0b0b0c]/55">
                        {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setDeletingPosting(p)}
                          className="cursor-pointer inline-flex items-center gap-1 text-[#0b0b0c]/40 hover:text-red-500 transition-colors"
                          title="Delete posting"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            </div>

            {postings.length === 0 && (
              <div className="py-24 text-center">
                <Briefcase className="w-12 h-12 text-[#0b0b0c]/80 mx-auto mb-4" />
                <p className="text-[#0b0b0c]/60 font-medium">
                  {count === 0 && !search ? 'No postings yet.' : 'No results match your search.'}
                </p>
              </div>
            )}
          </div>
        )}

        {count > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-[#0b0b0c]/60 font-medium">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="cursor-pointer p-2.5 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="cursor-pointer p-2.5 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedPosting && (
          <PostingDetailModal
            posting={selectedPosting}
            onClose={() => setSelectedPosting(null)}
            onDelete={() => setDeletingPosting(selectedPosting)}
            onViewApplicants={() => setViewingApplicantsFor(selectedPosting)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateModal && (
          <CreatePostingModal
            employerOptions={employerOptions}
            categories={categories}
            onClose={() => setShowCreateModal(false)}
            onCreate={createPosting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingApplicantsFor && (
          <ApplicantsModal posting={viewingApplicantsFor} onClose={() => setViewingApplicantsFor(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingPosting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setDeletingPosting(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-black/[0.12] rounded-3xl w-full max-w-md shadow-2xl"
            >
              <div className="p-6 border-b border-black/[0.12]">
                <h2 className="text-xl font-bold">Delete posting</h2>
                <p className="text-sm text-[#0b0b0c]/60 mt-1">{deletingPosting.title} — {deletingPosting.employer_name}</p>
              </div>
              <div className="p-6">
                <p className="text-sm text-[#0b0b0c]/70">
                  This permanently deletes the posting and all {deletingPosting.applications_count} application{deletingPosting.applications_count !== 1 ? 's' : ''} against it. This can&apos;t be undone.
                </p>
              </div>
              <div className="p-6 bg-black/[0.04] border-t border-black/[0.12] flex gap-3 rounded-b-3xl">
                <button onClick={() => setDeletingPosting(null)} className="cursor-pointer flex-1 py-3 rounded-xl bg-black/[0.05] hover:bg-black/[0.10] font-bold transition-all">
                  Cancel
                </button>
                <button
                  onClick={deletePosting}
                  disabled={deleting}
                  className="cursor-pointer flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all flex items-center justify-center gap-2"
                >
                  {deleting && <Loader2 size={18} className="animate-spin" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PostingDetailModal({ posting, onClose, onDelete, onViewApplicants }: {
  posting: Posting;
  onClose: () => void;
  onDelete: () => void;
  onViewApplicants: () => void;
}) {
  const salary = formatSalary(posting);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white border border-black/[0.08] rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 px-8 py-6 border-b border-black/[0.08] sticky top-0 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-4 min-w-0">
            {posting.employer_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posting.employer_logo} alt="" className="w-12 h-12 rounded-xl object-contain bg-black/[0.04] shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 font-bold shrink-0">
                {posting.employer_name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#0b0b0c] truncate">{posting.title}</h2>
              <p className="text-sm text-[#0b0b0c]/40 truncate">{posting.employer_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="cursor-pointer p-2 rounded-xl bg-black/[0.04] hover:bg-black/[0.05] transition-all text-[#0b0b0c]/40 hover:text-[#0b0b0c] shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
            <DetailField label="Status" value={
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${STATUS_STYLES[posting.status]}`}>
                {posting.status}
              </span>
            } />
            <DetailField label="Category" value={posting.category} />
            <DetailField label="Employment type" value={EMPLOYMENT_TYPE_LABELS[posting.employment_type]} />
            <DetailField label="Experience level" value={EXPERIENCE_LEVEL_LABELS[posting.experience_level]} />
            <DetailField label="Location" value={formatLocation(posting)} />
            <DetailField label="Salary" value={salary ?? '—'} />
            <DetailField label="Applications" value={posting.applications_count} />
            <DetailField label="Employer KYC" value={
              <span className="inline-flex items-center gap-1">
                {posting.employer_kyc_status === 'approved'
                  ? <><ShieldCheck size={13} className="text-green-600" /> Verified</>
                  : <><ShieldAlert size={13} className="text-amber-600" /> {posting.employer_kyc_status}</>}
              </span>
            } />
            <DetailField label="Posted" value={new Date(posting.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
            {posting.published_at && (
              <DetailField label="Published" value={new Date(posting.published_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
            )}
            {posting.closes_at && (
              <DetailField label="Closes" value={new Date(posting.closes_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
            )}
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60 mb-2">Description</div>
            <div className="text-sm text-[#0b0b0c]/70 whitespace-pre-wrap leading-relaxed bg-black/[0.03] border border-black/[0.08] rounded-2xl p-4 max-h-56 overflow-y-auto">
              {posting.description || <span className="text-[#0b0b0c]/70">No description provided.</span>}
            </div>
          </div>

          {posting.screening_questions.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60 mb-2">Screening questions</div>
              <ul className="space-y-1.5">
                {posting.screening_questions.map((q) => (
                  <li key={q.id} className="text-sm text-[#0b0b0c]/70 bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5">
                    {q.question}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {posting.application_form_schema.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60 mb-2">Extra application fields</div>
              <div className="flex flex-wrap gap-2">
                {posting.application_form_schema.map((f) => (
                  <span key={f.key} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-black/[0.04] text-[#0b0b0c]/70">
                    {f.label}{f.required && <span className="text-red-500">*</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-8 py-6 bg-black/[0.02] border-t border-black/[0.08] flex justify-between items-center rounded-b-3xl">
          <button
            onClick={onViewApplicants}
            disabled={posting.applications_count === 0}
            className="cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-purple-600 bg-purple-600/10 border border-purple-600/30 hover:bg-purple-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Users size={14} /> View applicants ({posting.applications_count})
          </button>
          <button
            onClick={onDelete}
            className="cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-red-500 bg-red-500/10 border border-red-500/30 hover:bg-red-600/20 transition-all"
          >
            <Trash2 size={14} /> Delete posting
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface CreatePostingFormValues {
  employer: string;
  title: string;
  description: string;
  category: string;
  employment_type: EmploymentType;
  experience_level: ExperienceLevel;
  status: JobStatus;
  city: string;
  state: string;
  country: string;
  is_remote: boolean;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
}

const EMPTY_CREATE_FORM: CreatePostingFormValues = {
  employer: '',
  title: '',
  description: '',
  category: '',
  employment_type: 'full_time',
  experience_level: 'mid',
  status: 'published',
  city: '',
  state: '',
  country: '',
  is_remote: false,
  salary_min: '',
  salary_max: '',
  salary_currency: 'INR',
};

function CreatePostingModal({ employerOptions, categories, onClose, onCreate }: {
  employerOptions: EmployerOption[];
  categories: string[];
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => Promise<string | null>;
}) {
  const [form, setForm] = useState<CreatePostingFormValues>(EMPTY_CREATE_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CreatePostingFormValues>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  const canSave = form.employer !== '' && form.title.trim() !== '';

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {
      employer: Number(form.employer),
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category || 'Other',
      employment_type: form.employment_type,
      experience_level: form.experience_level,
      status: form.status,
      city: form.city.trim(),
      state: form.state.trim(),
      country: form.country.trim(),
      is_remote: form.is_remote,
      salary_currency: form.salary_currency,
      salary_min: form.salary_min ? Number(form.salary_min) : null,
      salary_max: form.salary_max ? Number(form.salary_max) : null,
    };
    const errorMessage = await onCreate(payload);
    setSaving(false);
    if (errorMessage) setError(errorMessage);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-black/[0.12] rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-black/[0.12] bg-black/[0.04] rounded-t-3xl shrink-0 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Briefcase size={20} className="text-purple-600" />
            Post a job
          </h2>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-black/[0.08] rounded-lg transition-colors text-[#0b0b0c]/40 hover:text-[#0b0b0c]">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">
              Employer<span className="text-purple-600"> *</span>
            </label>
            <select
              value={form.employer}
              onChange={set('employer')}
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 transition-all cursor-pointer"
            >
              <option value="" disabled>
                {employerOptions.length === 0 ? 'Loading employers...' : 'Select an employer...'}
              </option>
              {employerOptions.map((e) => (
                <option key={e.id} value={e.id}>{e.name}{e.kyc_status !== 'approved' ? ` (${e.kyc_status})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">
              Job title<span className="text-purple-600"> *</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Senior Backend Engineer"
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Description</label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={4}
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Category</label>
              <select
                value={form.category}
                onChange={set('category')}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 transition-all cursor-pointer"
              >
                <option value="">Other</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Employment type</label>
              <select
                value={form.employment_type}
                onChange={set('employment_type')}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 transition-all cursor-pointer"
              >
                {EMPLOYMENT_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Experience</label>
              <select
                value={form.experience_level}
                onChange={set('experience_level')}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 transition-all cursor-pointer"
              >
                {EXPERIENCE_LEVEL_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">City</label>
              <input type="text" value={form.city} onChange={set('city')}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">State</label>
              <input type="text" value={form.state} onChange={set('state')}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Country</label>
              <input type="text" value={form.country} onChange={set('country')}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 transition-all" />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={form.is_remote} onChange={set('is_remote')} className="cursor-pointer w-4 h-4 accent-purple-600" />
            <span className="text-sm text-[#0b0b0c]/70">This role is remote</span>
          </label>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Salary min</label>
              <input type="number" value={form.salary_min} onChange={set('salary_min')}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Salary max</label>
              <input type="number" value={form.salary_max} onChange={set('salary_max')}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Currency</label>
              <input type="text" value={form.salary_currency} onChange={set('salary_currency')}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 transition-all" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Status</label>
            <select
              value={form.status}
              onChange={set('status')}
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 transition-all cursor-pointer"
            >
              {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="p-6 bg-black/[0.04] border-t border-black/[0.12] flex gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="cursor-pointer flex-1 py-3 rounded-xl bg-black/[0.05] hover:bg-black/[0.10] font-bold transition-all">
            Cancel
          </button>
          <button
            disabled={saving || !canSave}
            onClick={handleSave}
            className="cursor-pointer flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            Post job
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60 mb-1">{label}</div>
      <div className="text-sm text-[#0b0b0c] break-words flex items-center gap-1">
        {value ?? <span className="text-[#0b0b0c]/70">—</span>}
      </div>
    </div>
  );
}

type ApplicationStage = 'applied' | 'screening' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected';

interface Applicant {
  id: number;
  job_posting: number;
  candidate_username: string;
  candidate_email: string;
  candidate_phone: string | null;
  cv: { id: number; label: string; target_role: string; ats_score: number } | null;
  portfolio_url: string | null;
  portfolio_public_snapshot: boolean;
  form_responses: Record<string, string>;
  screening_answers: { question_id: string; answer_text: string }[];
  stage: ApplicationStage;
  stage_updated_at: string;
  applied_at: string;
  latest_note: string | null;
}

const STAGE_BADGE_STYLES: Record<ApplicationStage, string> = {
  applied: 'bg-slate-100 text-slate-600',
  screening: 'bg-blue-50 text-blue-600',
  shortlisted: 'bg-indigo-50 text-indigo-600',
  interview: 'bg-amber-50 text-amber-600',
  offer: 'bg-green-500/10 text-green-700',
  hired: 'bg-green-600/10 text-green-800',
  rejected: 'bg-red-50 text-red-600',
};

function ApplicantsModal({ posting, onClose }: { posting: Posting; onClose: () => void }) {
  const [applicants, setApplicants] = useState<Applicant[] | null>(null);
  const [loadingCvId, setLoadingCvId] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetch(`${HIRING_BASE}/admin/jobs/${posting.id}/applications/`, {
      headers: { Authorization: `Token ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then(setApplicants)
      .catch(() => setApplicants([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posting.id]);

  // The export endpoint needs an Authorization header, so it can't be a
  // plain <a href> — fetch as a blob with the token attached, then open it.
  const openCV = async (applicationId: number, format: 'pdf' | 'docx' = 'pdf') => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setLoadingCvId(applicationId);
    try {
      const res = await fetch(`${HIRING_BASE}/admin/applications/${applicationId}/cv/?type=${format}`, {
        headers: { Authorization: `Token ${token}` },
      });
      if (!res.ok) {
        alert("Couldn't load this CV.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (format === 'pdf') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `application-${applicationId}-cv.docx`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } finally {
      setLoadingCvId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white border border-black/[0.08] rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 px-8 py-6 border-b border-black/[0.08] sticky top-0 bg-white/95 backdrop-blur">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#0b0b0c] flex items-center gap-2">
              <Users size={18} className="text-purple-600" /> Applicants
            </h2>
            <p className="text-sm text-[#0b0b0c]/40 truncate">{posting.title} — {posting.employer_name}</p>
          </div>
          <button onClick={onClose} className="cursor-pointer p-2 rounded-xl bg-black/[0.04] hover:bg-black/[0.05] transition-all text-[#0b0b0c]/40 hover:text-[#0b0b0c] shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-8 py-6">
          {applicants === null ? (
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-purple-500" />
            </div>
          ) : applicants.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-10 h-10 text-[#0b0b0c]/80 mx-auto mb-3" />
              <p className="text-[#0b0b0c]/60 font-medium text-sm">No applicants yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applicants.map((a) => (
                <div key={a.id} className="border border-black/[0.08] rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="font-bold text-[#0b0b0c] text-sm">{a.candidate_username}</div>
                      <div className="text-xs text-[#0b0b0c]/60 flex items-center gap-1 mt-1">
                        <Mail size={11} /> {a.candidate_email}
                      </div>
                      {a.candidate_phone && (
                        <div className="text-xs text-[#0b0b0c]/60 flex items-center gap-1 mt-0.5">
                          <Phone size={11} /> {a.candidate_phone}
                        </div>
                      )}
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${STAGE_BADGE_STYLES[a.stage]}`}>
                      {a.stage}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {a.cv && (
                      <>
                        <button
                          onClick={() => openCV(a.id)}
                          disabled={loadingCvId === a.id}
                          className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold bg-black/[0.05] hover:bg-black/[0.08] px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
                        >
                          {loadingCvId === a.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                          {a.cv.label || a.cv.target_role || 'CV'} &middot; ATS {a.cv.ats_score}%
                        </button>
                        <button
                          onClick={() => openCV(a.id, 'docx')}
                          className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold bg-black/[0.05] hover:bg-black/[0.08] px-3 py-1.5 rounded-full transition-colors"
                          title="Download as DOCX"
                        >
                          <Download size={12} /> DOCX
                        </button>
                      </>
                    )}
                    {a.portfolio_url && (
                      <a
                        href={`https://kaamlee.in${a.portfolio_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-purple-500/10 text-purple-600 px-3 py-1.5 rounded-full hover:bg-purple-500/20 transition-colors"
                      >
                        <ExternalLink size={12} /> View portfolio
                      </a>
                    )}
                  </div>

                  <div className="text-[10px] text-[#0b0b0c]/40 font-mono">
                    Applied {new Date(a.applied_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>

                  {a.latest_note && (
                    <div className="mt-3 text-xs text-red-600 bg-red-500/5 border border-red-500/20 rounded-xl px-3.5 py-2.5">
                      {a.latest_note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
