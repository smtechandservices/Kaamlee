'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, Building2, FileUp, ShieldCheck, UserPlus, FilePlus, Rocket, Inbox, ArrowRightLeft,
  Pencil, ToggleRight, Trash2, UserCog, UserMinus, FileX, Building, RefreshCcw, ExternalLink, Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const HIRING_BASE = `${process.env.NEXT_PUBLIC_API_URL}/hiring`;

// One entry in GET /hiring/admin/activity/ (AdminEmployerActivityView).
// `changes` is {field: [old, new]}.
interface ActivityEvent {
  key: string;
  type: string;
  at: string;
  employer_id: number | null;
  employer_name: string;
  actor: string | null;
  actor_is_admin?: boolean;
  posting_id?: number | null;
  posting_title?: string | null;
  candidate?: string;
  target_label?: string;
  role?: string;
  apply_mode?: 'kaamlee' | 'external';
  via_external_link?: boolean;
  note?: string;
  changes?: Record<string, [unknown, unknown]>;
}

interface FeedResponse {
  count: number;
  page: number;
  has_more: boolean;
  results: ActivityEvent[];
  types: { key: string; label: string }[];
  employers: { id: number; name: string }[];
}

const TYPE_STYLE: Record<string, { icon: typeof Activity; tone: string }> = {
  employer_registered: { icon: Building2, tone: 'bg-purple-500/10 text-purple-600' },
  employer_deleted: { icon: Building, tone: 'bg-red-500/10 text-red-600' },
  profile_updated: { icon: Pencil, tone: 'bg-sky-500/10 text-sky-700' },
  kyc_document_uploaded: { icon: FileUp, tone: 'bg-amber-500/10 text-amber-700' },
  kyc_document_deleted: { icon: FileX, tone: 'bg-red-500/10 text-red-600' },
  kyc_reviewed: { icon: ShieldCheck, tone: 'bg-green-500/10 text-green-700' },
  member_joined: { icon: UserPlus, tone: 'bg-indigo-500/10 text-indigo-600' },
  member_role_changed: { icon: UserCog, tone: 'bg-indigo-500/10 text-indigo-600' },
  member_updated: { icon: UserCog, tone: 'bg-indigo-500/10 text-indigo-600' },
  member_removed: { icon: UserMinus, tone: 'bg-red-500/10 text-red-600' },
  posting_created: { icon: FilePlus, tone: 'bg-green-500/10 text-green-700' },
  posting_published: { icon: Rocket, tone: 'bg-green-500/10 text-green-700' },
  posting_updated: { icon: Pencil, tone: 'bg-sky-500/10 text-sky-700' },
  posting_status_changed: { icon: ToggleRight, tone: 'bg-amber-500/10 text-amber-700' },
  posting_deleted: { icon: Trash2, tone: 'bg-red-500/10 text-red-600' },
  applied: { icon: Inbox, tone: 'bg-emerald-500/10 text-emerald-700' },
  stage_change: { icon: ArrowRightLeft, tone: 'bg-black/[0.05] text-[#0b0b0c]/60' },
};

const FIELD_LABELS: Record<string, string> = {
  salary_min: 'Salary min',
  salary_max: 'Salary max',
  salary_currency: 'Currency',
  is_remote: 'Remote',
  apply_mode: 'How to apply',
  external_apply_url: 'Apply link',
  screening_questions: 'Screening questions',
  application_form_schema: 'Application form fields',
  closes_at: 'Closes at',
  employment_type: 'Employment type',
  experience_level: 'Experience level',
  kyc_status: 'KYC status',
  kyc_rejection_reason: 'Rejection reason',
  logo_url: 'Logo URL',
  contact_email: 'Contact email',
  contact_phone: 'Contact phone',
  legal_name: 'Legal name',
  first_name: 'First name',
  last_name: 'Last name',
};

const fieldLabel = (field: string) =>
  FIELD_LABELS[field] ?? field.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const q = (title?: string | null) => `“${title || 'Untitled posting'}”`;

// One readable sentence per event.
function describe(e: ActivityEvent): React.ReactNode {
  const who = e.actor || 'Someone';
  const change = (field: string) => e.changes?.[field] ?? [null, null];
  switch (e.type) {
    case 'employer_registered': return <>{e.employer_name} was added to Kaamlee</>;
    case 'employer_deleted': return <>{who} deleted the employer {e.employer_name}</>;
    case 'profile_updated': return <>{who} edited the company profile</>;
    case 'kyc_document_uploaded': return <>A KYC document was uploaded: {e.target_label}</>;
    case 'kyc_document_deleted': return <>{who} removed the KYC document {e.target_label}</>;
    case 'kyc_reviewed': {
      const [from, to] = change('kyc_status');
      return <>{who} {to === 'approved' ? 'approved' : to === 'rejected' ? 'rejected' : `set to ${formatValue(to)}`} KYC{from && from !== to ? ` (was ${from})` : ''}</>;
    }
    case 'member_joined': return <>{e.target_label} joined the team{e.role ? ` as ${e.role}` : ''}</>;
    case 'member_role_changed': {
      const [from, to] = change('role');
      return <>{who} changed {e.target_label}&apos;s role from {formatValue(from)} to {formatValue(to)}</>;
    }
    case 'member_updated': return <>{who} edited teammate {e.target_label}</>;
    case 'member_removed': return <>{who} removed teammate {e.target_label}</>;
    case 'posting_created':
      return <>{who} created the posting {q(e.posting_title)}{e.apply_mode === 'external' && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">external link</span>}</>;
    case 'posting_published': return <>{q(e.posting_title)} was published</>;
    case 'posting_updated': return <>{who} edited {q(e.posting_title)}</>;
    case 'posting_status_changed': {
      const [from, to] = change('status');
      return <>{who} changed {q(e.posting_title)} from {formatValue(from)} to {formatValue(to)}</>;
    }
    case 'posting_deleted': return <>{who} deleted the posting {q(e.posting_title)}</>;
    case 'applied':
      return e.via_external_link
        ? <>{e.candidate} was redirected to the apply link for {q(e.posting_title)}</>
        : <>{e.candidate} applied to {q(e.posting_title)}</>;
    case 'stage_change': {
      const [from, to] = change('stage');
      return <>{who} moved {e.candidate} {from ? `from ${from} ` : ''}to {formatValue(to)} on {q(e.posting_title)}</>;
    }
    default: return <>{e.type}</>;
  }
}

// Field-by-field table for edits; other events say everything in the sentence.
const SHOW_CHANGES = new Set(['posting_updated', 'profile_updated', 'member_updated']);

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EmployerActivityPage() {
  const router = useRouter();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [types, setTypes] = useState<{ key: string; label: string }[]>([]);
  const [employers, setEmployers] = useState<{ id: number; name: string }[]>([]);
  const [employerId, setEmployerId] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number, append: boolean) => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }
    const params = new URLSearchParams({ page: String(nextPage) });
    if (employerId) params.set('employer', employerId);
    if (type) params.set('type', type);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${HIRING_BASE}/admin/activity/?${params}`, { headers: { Authorization: `Token ${token}` } });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) {
        setError('Could not load activity.');
        return;
      }
      const data: FeedResponse = await res.json();
      setEvents((prev) => (append ? [...prev, ...data.results] : data.results));
      setTypes(data.types);
      setEmployers(data.employers);
      setHasMore(data.has_more);
      setCount(data.count);
      setPage(nextPage);
    } catch {
      setError('Could not load activity.');
    } finally {
      setLoading(false);
    }
  }, [employerId, type, router]);

  useEffect(() => {
    load(1, false);
  }, [load]);

  // Group consecutive events by day for the timeline headings.
  const groups: { label: string; items: ActivityEvent[] }[] = [];
  events.forEach((e) => {
    const label = dayLabel(new Date(e.at));
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  });

  const selectCls = 'bg-white border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 cursor-pointer';

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <Activity size={28} className="text-purple-600" />
              Employer activity
            </h1>
            <p className="text-[#0b0b0c]/60 font-medium">
              Everything employers — and Kaamlee admins acting on their accounts — have done, newest first.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={employerId} onChange={(e) => setEmployerId(e.target.value)} className={selectCls} aria-label="Employer">
              <option value="">All employers</option>
              {employers.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls} aria-label="Event type">
              <option value="">All activity</option>
              {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <button
              onClick={() => load(1, false)}
              className="cursor-pointer p-3 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] transition-all"
              title="Refresh"
            >
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        <p className="text-xs text-[#0b0b0c]/45 mb-6">
          {count.toLocaleString()} event{count === 1 ? '' : 's'}. Edits, status changes, deletions and team changes are
          recorded from when this log was added; earlier ones can&apos;t be shown.
        </p>

        {error && (
          <div className="text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 mb-6">{error}</div>
        )}

        {!loading && events.length === 0 && !error ? (
          <div className="bg-white border border-black/[0.08] rounded-3xl py-20 text-center">
            <Activity className="w-12 h-12 text-[#0b0b0c]/25 mx-auto mb-4" />
            <p className="text-[#0b0b0c]/60 font-medium">No activity matches these filters.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.label}>
                <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/45 mb-3">{group.label}</h2>
                <div className="bg-white border border-black/[0.08] rounded-3xl divide-y divide-black/[0.06]">
                  {group.items.map((e) => <EventRow key={e.key} event={e} onPickEmployer={(id) => setEmployerId(String(id))} />)}
                </div>
              </section>
            ))}
          </div>
        )}

        {(hasMore || (loading && events.length > 0)) && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => load(page + 1, true)}
              disabled={loading}
              className="cursor-pointer inline-flex items-center gap-2 bg-white border border-black/[0.08] hover:bg-black/[0.03] px-6 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {loading && <Loader2 size={15} className="animate-spin" />} Load more
            </button>
          </div>
        )}
        {loading && events.length === 0 && (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({ event: e, onPickEmployer }: { event: ActivityEvent; onPickEmployer: (id: number) => void }) {
  const style = TYPE_STYLE[e.type] ?? { icon: Activity, tone: 'bg-black/[0.05] text-[#0b0b0c]/60' };
  const Icon = style.icon;
  const changes = Object.entries(e.changes ?? {});
  const showChanges = SHOW_CHANGES.has(e.type) && changes.length > 0;
  const rawReason = e.type === 'kyc_reviewed' ? e.changes?.kyc_rejection_reason?.[1] : null;
  const reason = rawReason ? String(rawReason) : null;

  return (
    <div className="flex gap-4 px-5 py-4">
      <span className={`grid place-items-center w-9 h-9 rounded-xl shrink-0 ${style.tone}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[#0b0b0c] leading-snug break-words">{describe(e)}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-[#0b0b0c]/50">
          {e.employer_id ? (
            <button onClick={() => onPickEmployer(e.employer_id as number)} className="cursor-pointer font-semibold text-purple-600 hover:underline" title="Show only this employer">
              {e.employer_name}
            </button>
          ) : (
            <span className="font-semibold">{e.employer_name} <span className="font-normal">(deleted)</span></span>
          )}
          {e.actor && e.actor_is_admin && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-700 rounded-md px-1.5 py-0.5">
              Kaamlee admin
            </span>
          )}
          <span>{new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
          {e.type === 'applied' && e.via_external_link && (
            <span className="inline-flex items-center gap-1 text-sky-700"><ExternalLink size={11} /> external link</span>
          )}
        </div>

        {reason && (
          <p className="text-xs text-red-600 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2 mt-2">Reason: {reason}</p>
        )}
        {e.type === 'stage_change' && e.note && (
          <p className="text-xs text-[#0b0b0c]/60 bg-black/[0.03] rounded-lg px-3 py-2 mt-2">Note: {e.note}</p>
        )}

        {showChanges && (
          <div className="mt-3 rounded-xl border border-black/[0.06] overflow-hidden">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-black/[0.05]">
                {changes.map(([field, [from, to]]) => (
                  <tr key={field} className="align-top">
                    <td className="px-3 py-2 font-semibold text-[#0b0b0c]/60 whitespace-nowrap w-40">{fieldLabel(field)}</td>
                    <td className="px-3 py-2 text-red-600/80 line-through break-words max-w-[240px]" title={formatValue(from)}>
                      <span className="line-clamp-3">{formatValue(from)}</span>
                    </td>
                    <td className="px-3 py-2 text-green-700 break-words max-w-[240px]" title={formatValue(to)}>
                      <span className="line-clamp-3">{formatValue(to)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
