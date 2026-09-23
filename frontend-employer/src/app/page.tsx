'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2, ShieldCheck, ShieldAlert, Clock, Users, ArrowRight, ArrowUpRight,
  Mail, Phone, Globe, AlertCircle, Briefcase, Plus, FileText, MapPin, TrendingUp,
  TrendingDown, UserCheck, Inbox, Lock,
} from 'lucide-react';
import { getToken, authHeaders } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL;

interface KYCDocument {
  id: number;
  doc_type: string;
  file: string;
  uploaded_at: string;
}

interface Employer {
  id: number;
  name: string;
  legal_name: string;
  industry: string;
  size: string;
  website: string;
  logo: string | null;
  address: string;
  contact_email: string;
  contact_phone: string;
  kyc_status: 'pending' | 'approved' | 'rejected';
  kyc_rejection_reason: string;
  kyc_documents: KYCDocument[];
  role: 'owner' | 'admin' | 'recruiter';
  created_at: string;
}

type Stage = 'applied' | 'screening' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected';
type PostingStatus = 'draft' | 'published' | 'paused' | 'closed';

// GET /hiring/dashboard/ — see EmployerDashboardView.
interface Dashboard {
  kyc_approved: boolean;
  postings: { total: number; published: number; draft: number; paused: number; closed: number };
  applications: { total: number; this_week: number; last_week: number; in_progress: number; hired: number; rejected: number };
  pipeline: { stage: Stage; label: string; count: number }[];
  top_postings: {
    id: number; title: string; status: PostingStatus; category: string; employment_type: string;
    location: string; is_remote: boolean; published_at: string | null; created_at: string;
    applications_count: number; new_this_week: number; in_progress: number; hired: number;
  }[];
  recent_applications: {
    id: number; candidate_name: string; candidate_username: string;
    job_posting_id: number; job_posting_title: string; stage: Stage; applied_at: string;
  }[];
  team: {
    total: number;
    members: { id: number; name: string; username: string; email: string; role: Employer['role']; is_you: boolean }[];
  };
}

const KYC_BANNER: Record<Employer['kyc_status'], { icon: React.ReactNode; cls: string; title: string }> = {
  pending: { icon: <Clock size={18} className="text-yellow-600" />, cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700', title: 'Your KYC is under review' },
  approved: { icon: <ShieldCheck size={18} className="text-green-600" />, cls: 'bg-green-500/10 border-green-500/30 text-green-700', title: "You're verified" },
  rejected: { icon: <ShieldAlert size={18} className="text-red-500" />, cls: 'bg-red-500/10 border-red-500/30 text-red-600', title: 'Your KYC was rejected' },
};

// One colour per pipeline stage, reused by the bar, its legend and the
// recent-applicant chips so a stage always reads the same.
const STAGE_COLORS: Record<Stage, { bar: string; chip: string }> = {
  applied: { bar: 'bg-blue-500', chip: 'bg-blue-500/10 text-blue-600' },
  screening: { bar: 'bg-indigo-500', chip: 'bg-indigo-500/10 text-indigo-600' },
  shortlisted: { bar: 'bg-violet-500', chip: 'bg-violet-500/10 text-violet-600' },
  interview: { bar: 'bg-amber-500', chip: 'bg-amber-500/10 text-amber-700' },
  offer: { bar: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-700' },
  hired: { bar: 'bg-green-600', chip: 'bg-green-600/10 text-green-700' },
  rejected: { bar: 'bg-red-400', chip: 'bg-red-500/10 text-red-600' },
};

const POSTING_STATUS_CLS: Record<PostingStatus, string> = {
  published: 'bg-green-500/10 text-green-700',
  draft: 'bg-black/[0.05] text-[#0b0b0c]/55',
  paused: 'bg-amber-500/10 text-amber-700',
  closed: 'bg-red-500/10 text-red-600',
};

const ROLE_CLS: Record<Employer['role'], string> = {
  owner: 'bg-purple-600/10 text-purple-600',
  admin: 'bg-blue-500/10 text-blue-600',
  recruiter: 'bg-black/[0.05] text-[#0b0b0c]/55',
};

const DOC_LABELS: Record<string, string> = {
  registration_certificate: 'Registration Certificate',
  tax_id: 'Tax ID',
  address_proof: 'Address Proof',
  authorized_signatory_id: 'Authorized Signatory ID',
};

const CARD = 'bg-white border border-black/[0.08] rounded-3xl';

function timeAgo(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: React.ReactNode }) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b0b0c]/50">{label}</span>
        <span className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-[#0b0b0c]/55">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 hover:underline">
          {linkLabel} <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}

export default function EmployerDashboard() {
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    const load = (url: string) => fetch(url, { headers: authHeaders(token) }).then((res) => (res.ok ? res.json() : Promise.reject(res.status)));
    Promise.all([load(`${API}/employers/me/`), load(`${API}/hiring/dashboard/`)])
      .then(([me, dash]: [Employer, Dashboard]) => { setEmployer(me); setDashboard(dash); })
      .catch((status) => {
        if (status === 401) router.push('/login');
        else setError(true);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (error || !employer || !dashboard) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex flex-col items-center justify-center text-[#0b0b0c] p-8">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Connection Error</h1>
        <p className="text-[#0b0b0c]/60 text-center max-w-md">Could not load your dashboard. Please try again shortly.</p>
      </div>
    );
  }

  const banner = KYC_BANNER[employer.kyc_status];
  const approved = employer.kyc_status === 'approved';
  const { postings, applications, pipeline, top_postings, recent_applications, team } = dashboard;
  const pipelineTotal = pipeline.reduce((sum, p) => sum + p.count, 0);
  const weekDelta = applications.this_week - applications.last_week;
  const hireRate = applications.total ? Math.round((applications.hired / applications.total) * 100) : 0;
  const canManageTeam = employer.role === 'owner';

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-6 sm:p-8 font-sans">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6">
          <div className="flex items-center gap-4 min-w-0">
            {employer.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={employer.logo} alt="" className="w-14 h-14 rounded-2xl object-contain bg-white border border-black/[0.08] shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600 font-bold text-lg shrink-0">
                {initials(employer.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm text-[#0b0b0c]/55 font-medium">Welcome back</p>
              <h1 className="text-3xl font-bold tracking-tight truncate">{employer.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${ROLE_CLS[employer.role]}`}>{employer.role}</span>
                {employer.industry && <span className="text-[#0b0b0c]/55">{employer.industry}</span>}
                <span className="text-[#0b0b0c]/35">·</span>
                <span className="text-[#0b0b0c]/55">On Kaamlee since {new Date(employer.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
          {approved && (
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/jobs" className="inline-flex items-center gap-2 bg-white border border-black/[0.08] hover:bg-black/[0.03] px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
                <Briefcase size={16} /> All postings
              </Link>
              <Link href="/jobs/new" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-500/20">
                <Plus size={16} /> New posting
              </Link>
            </div>
          )}
        </header>

        {/* KYC */}
        <div className={`flex items-center justify-between gap-4 border rounded-2xl px-5 py-3.5 mb-6 ${banner.cls}`}>
          <div className="flex items-center gap-3">
            {banner.icon}
            <div>
              <div className="font-bold text-sm">{banner.title}</div>
              {employer.kyc_status === 'approved' && (
                <div className="text-xs mt-0.5 opacity-80">You can post jobs and review applicants.</div>
              )}
              {employer.kyc_status === 'rejected' && employer.kyc_rejection_reason && (
                <div className="text-xs mt-0.5 opacity-80">{employer.kyc_rejection_reason}</div>
              )}
              {employer.kyc_status === 'pending' && (
                <div className="text-xs mt-0.5 opacity-80">We&apos;ll notify you once an admin reviews your documents. Posting unlocks after approval.</div>
              )}
            </div>
          </div>
          {!approved && (
            <Link href="/kyc" className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold bg-white/70 hover:bg-white px-3.5 py-2 rounded-xl transition-all">
              {employer.kyc_status === 'rejected' ? 'Resubmit' : 'View submission'} <ArrowRight size={13} />
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<Briefcase size={16} />}
            label="Live postings"
            value={postings.published}
            sub={`${postings.total} total · ${postings.draft} draft · ${postings.paused} paused · ${postings.closed} closed`}
          />
          <StatCard
            icon={<Inbox size={16} />}
            label="Applications"
            value={applications.total}
            sub={`${applications.in_progress} in progress · ${applications.rejected} rejected`}
          />
          <StatCard
            icon={weekDelta >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            label="This week"
            value={applications.this_week}
            sub={
              <span className={weekDelta > 0 ? 'text-green-700' : weekDelta < 0 ? 'text-red-600' : ''}>
                {weekDelta === 0 ? 'Same as last week' : `${weekDelta > 0 ? '+' : ''}${weekDelta} vs last week (${applications.last_week})`}
              </span>
            }
          />
          <StatCard
            icon={<UserCheck size={16} />}
            label="Hired"
            value={applications.hired}
            sub={applications.total ? `${hireRate}% of applicants` : 'No applicants yet'}
          />
        </div>

        {/* Pipeline */}
        <section className={`${CARD} p-6 mb-6`}>
          <SectionHeader title="Hiring pipeline" href={approved ? '/jobs' : undefined} linkLabel="Open boards" />
          {pipelineTotal === 0 ? (
            <p className="text-sm text-[#0b0b0c]/50">No applications yet. They&apos;ll show up here by stage as candidates apply.</p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/[0.04]">
                {pipeline.filter((p) => p.count > 0).map((p) => (
                  <div key={p.stage} className={STAGE_COLORS[p.stage].bar} style={{ width: `${(p.count / pipelineTotal) * 100}%` }} title={`${p.label}: ${p.count}`} />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {pipeline.map((p) => (
                  <div key={p.stage} className="rounded-2xl border border-black/[0.06] bg-black/[0.02] px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0b0b0c]/55">
                      <span className={`w-2 h-2 rounded-full ${STAGE_COLORS[p.stage].bar}`} /> {p.label}
                    </div>
                    <div className="mt-1 text-xl font-bold">{p.count}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-6">
          {/* Postings */}
          <section className={`${CARD} p-6 xl:col-span-3`}>
            <SectionHeader title="Your postings" href={approved ? '/jobs' : undefined} linkLabel="Manage postings" />
            {!approved ? (
              <div className="py-10 text-center">
                <Lock className="w-8 h-8 text-[#0b0b0c]/25 mx-auto mb-3" />
                <p className="text-sm text-[#0b0b0c]/55">Posting unlocks once your KYC is approved.</p>
              </div>
            ) : top_postings.length === 0 ? (
              <div className="py-10 text-center">
                <Briefcase className="w-8 h-8 text-[#0b0b0c]/25 mx-auto mb-3" />
                <p className="text-sm text-[#0b0b0c]/55 mb-4">You haven&apos;t posted any jobs yet.</p>
                <Link href="/jobs/new" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
                  <Plus size={15} /> Create your first posting
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-[0.16em] text-[#0b0b0c]/45">
                      <th className="px-2 pb-3">Role</th>
                      <th className="px-2 pb-3">Status</th>
                      <th className="px-2 pb-3 text-right">Applicants</th>
                      <th className="px-2 pb-3 text-right">New (7d)</th>
                      <th className="px-2 pb-3 text-right">Active</th>
                      <th className="px-2 pb-3 text-right">Hired</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.06]">
                    {top_postings.map((p) => (
                      <tr key={p.id} className="hover:bg-black/[0.02] transition-colors">
                        <td className="px-2 py-3">
                          <Link href={`/jobs/${p.id}`} className="font-semibold text-sm hover:text-purple-600 transition-colors">{p.title}</Link>
                          <div className="text-xs text-[#0b0b0c]/50 flex items-center gap-1 mt-0.5">
                            {p.location && <><MapPin size={11} /> {p.location}{p.is_remote && p.location !== 'Remote' ? ' · Remote' : ''} · </>}
                            {p.category}
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${POSTING_STATUS_CLS[p.status]}`}>{p.status}</span>
                        </td>
                        <td className="px-2 py-3 text-right font-semibold text-sm">{p.applications_count}</td>
                        <td className="px-2 py-3 text-right text-sm">
                          {p.new_this_week > 0 ? <span className="text-green-700 font-semibold">+{p.new_this_week}</span> : <span className="text-[#0b0b0c]/35">0</span>}
                        </td>
                        <td className="px-2 py-3 text-right text-sm text-[#0b0b0c]/70">{p.in_progress}</td>
                        <td className="px-2 py-3 text-right text-sm text-[#0b0b0c]/70">{p.hired}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent applicants */}
          <section className={`${CARD} p-6 xl:col-span-2`}>
            <SectionHeader title="Recent applicants" />
            {recent_applications.length === 0 ? (
              <div className="py-10 text-center">
                <Inbox className="w-8 h-8 text-[#0b0b0c]/25 mx-auto mb-3" />
                <p className="text-sm text-[#0b0b0c]/55">No one has applied yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recent_applications.map((a) => (
                  <Link key={a.id} href={`/jobs/${a.job_posting_id}`} className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-black/[0.02] px-3 py-2.5 hover:border-purple-500/30 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {initials(a.candidate_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{a.candidate_name}</div>
                      <div className="text-xs text-[#0b0b0c]/50 truncate">{a.job_posting_title} · {timeAgo(a.applied_at)}</div>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${STAGE_COLORS[a.stage].chip}`}>{a.stage}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company profile */}
          <section className={`${CARD} p-6`}>
            <SectionHeader title="Company profile" href="/profile" linkLabel="Edit profile" />
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {([
                ['Legal name', employer.legal_name],
                ['Industry', employer.industry],
                ['Company size', employer.size],
                ['Address', employer.address],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0b0b0c]/45 mb-1">{label}</dt>
                  <dd className={value ? 'text-[#0b0b0c]/80' : 'text-[#0b0b0c]/35 italic'}>{value || 'Not set'}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 pt-5 border-t border-black/[0.06] flex flex-col gap-2 text-sm text-[#0b0b0c]/75">
              <div className="flex items-center gap-2"><Mail size={14} className="shrink-0 text-[#0b0b0c]/40" /> {employer.contact_email}</div>
              {employer.contact_phone && <div className="flex items-center gap-2"><Phone size={14} className="shrink-0 text-[#0b0b0c]/40" /> {employer.contact_phone}</div>}
              {employer.website && (
                <a href={employer.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-purple-600 hover:underline truncate">
                  <Globe size={14} className="shrink-0" /> <span className="truncate">{employer.website}</span> <ArrowUpRight size={12} className="shrink-0" />
                </a>
              )}
            </div>
            <div className="mt-5 pt-5 border-t border-black/[0.06]">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0b0b0c]/45 mb-2">KYC documents</div>
              {employer.kyc_documents.length === 0 ? (
                <p className="text-sm text-[#0b0b0c]/45">None submitted yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {employer.kyc_documents.map((doc) => (
                    <a key={doc.id} href={doc.file} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-black/[0.02] px-2.5 py-1.5 text-xs font-semibold text-[#0b0b0c]/70 hover:text-purple-600 transition-colors">
                      <FileText size={12} /> {DOC_LABELS[doc.doc_type] || doc.doc_type}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Team */}
          <section className={`${CARD} p-6`}>
            <SectionHeader title={`Team · ${team.total}`} href="/team" linkLabel={canManageTeam ? 'Manage team' : 'View team'} />
            <div className="flex flex-col divide-y divide-black/[0.06]">
              {team.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-2.5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {initials(m.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate flex items-center gap-2">
                      {m.name}
                      {m.is_you && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/[0.05] text-[#0b0b0c]/55">You</span>}
                    </div>
                    <div className="text-xs text-[#0b0b0c]/50 truncate">{m.email}</div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${ROLE_CLS[m.role]}`}>{m.role}</span>
                </div>
              ))}
            </div>
            {team.total > team.members.length && (
              <p className="mt-2 text-xs text-[#0b0b0c]/50">+{team.total - team.members.length} more</p>
            )}
            {canManageTeam && team.total <= 1 && (
              <Link href="/team" className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-purple-600/40 text-purple-600 text-sm font-semibold py-3 hover:bg-purple-600/5 transition-all">
                <Users size={15} /> Invite a teammate
              </Link>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
