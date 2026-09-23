'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2, History, ArrowRight, UserPlus, FilePlus2, Megaphone, Users, Inbox,
} from 'lucide-react';
import { getToken, authHeaders } from '@/lib/auth';
import { STAGE_COLUMNS, type ApplicationStage } from '@/lib/hiring-types';

const HIRING_BASE = `${process.env.NEXT_PUBLIC_API_URL}/hiring`;

type EventType = 'stage_change' | 'applied' | 'posting_created' | 'posting_published' | 'member_joined';

// GET /hiring/activity/ — see EmployerActivityView.
interface ActivityEvent {
  type: EventType;
  at: string;
  actor: string | null;
  candidate?: string;
  posting_id?: number;
  posting_title?: string;
  from_stage?: ApplicationStage | '';
  to_stage?: ApplicationStage;
  note?: string;
  role?: string;
}

interface Member { id: number; name: string; role: string }

const TYPE_FILTERS: [EventType | 'all', string][] = [
  ['all', 'Everything'],
  ['stage_change', 'Stage changes'],
  ['applied', 'New applications'],
  ['posting_created', 'Postings created'],
  ['posting_published', 'Postings published'],
  ['member_joined', 'Team'],
];

const EVENT_STYLE: Record<EventType, { icon: React.ReactNode; dot: string }> = {
  stage_change: { icon: <ArrowRight size={14} />, dot: 'bg-purple-500/10 text-purple-600' },
  applied: { icon: <Inbox size={14} />, dot: 'bg-blue-500/10 text-blue-600' },
  posting_created: { icon: <FilePlus2 size={14} />, dot: 'bg-black/[0.05] text-[#0b0b0c]/60' },
  posting_published: { icon: <Megaphone size={14} />, dot: 'bg-green-500/10 text-green-700' },
  member_joined: { icon: <UserPlus size={14} />, dot: 'bg-amber-500/10 text-amber-700' },
};

const STAGE_CHIP: Record<ApplicationStage, string> = {
  applied: 'bg-blue-500/10 text-blue-600',
  screening: 'bg-indigo-500/10 text-indigo-600',
  shortlisted: 'bg-violet-500/10 text-violet-600',
  interview: 'bg-amber-500/10 text-amber-700',
  offer: 'bg-emerald-500/10 text-emerald-700',
  hired: 'bg-green-600/10 text-green-700',
  rejected: 'bg-red-500/10 text-red-600',
};

const stageLabel = (stage?: string) => STAGE_COLUMNS.find((c) => c.key === stage)?.label ?? stage ?? '';

function StageChip({ stage }: { stage: ApplicationStage }) {
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${STAGE_CHIP[stage]}`}>{stageLabel(stage)}</span>;
}

function dayLabel(value: string) {
  const d = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function PostingLink({ event }: { event: ActivityEvent }) {
  if (!event.posting_id) return null;
  return (
    <Link href={`/jobs/${event.posting_id}/applicants`} className="font-semibold text-[#0b0b0c] hover:text-purple-600 transition-colors">
      {event.posting_title}
    </Link>
  );
}

function EventText({ event }: { event: ActivityEvent }) {
  const actor = <span className="font-semibold text-[#0b0b0c]">{event.actor}</span>;
  switch (event.type) {
    case 'stage_change':
      return (
        <>
          {actor} moved <span className="font-semibold text-[#0b0b0c]">{event.candidate}</span>{' '}
          {event.from_stage ? <>from <StageChip stage={event.from_stage} /> </> : null}
          to {event.to_stage && <StageChip stage={event.to_stage} />} for <PostingLink event={event} />
        </>
      );
    case 'applied':
      return <>{actor} applied to <PostingLink event={event} /></>;
    case 'posting_created':
      return <>{actor} created the posting <PostingLink event={event} /></>;
    case 'posting_published':
      return <><PostingLink event={event} /> was published and went live</>;
    case 'member_joined':
      return <>{actor} joined the team as <span className="font-semibold text-[#0b0b0c] capitalize">{event.role}</span></>;
  }
}

export default function ActivityPage() {
  const router = useRouter();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [type, setType] = useState<EventType | 'all'>('all');
  const [member, setMember] = useState('');

  const fetchPage = useCallback(async (pageNumber: number, append: boolean) => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    const params = new URLSearchParams({ page: String(pageNumber) });
    if (type !== 'all') params.set('type', type);
    if (member) params.set('member', member);
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await fetch(`${HIRING_BASE}/activity/?${params}`, { headers: authHeaders(token) });
      if (res.status === 401) { router.push('/login'); return; }
      if (res.ok) {
        const data = await res.json();
        setEvents((prev) => (append ? [...prev, ...data.results] : data.results));
        setMembers(data.members);
        setCount(data.count);
        setHasMore(data.has_more);
        setPage(pageNumber);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [router, type, member]);

  useEffect(() => { fetchPage(1, false); }, [fetchPage]);

  // Group consecutive events under a day heading.
  const groups: { day: string; items: ActivityEvent[] }[] = [];
  for (const event of events) {
    const day = dayLabel(event.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(event);
    else groups.push({ day, items: [event] });
  }

  const memberFilterHidesType = member && (type === 'applied' || type === 'posting_published');

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-6 sm:p-8 font-sans">
      <div className="mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <History size={28} className="text-purple-600" /> Activity
          </h1>
          <p className="text-[#0b0b0c]/60 font-medium">Who did what across your postings and team — newest first.</p>
        </header>

        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setType(key)}
                className={`cursor-pointer px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  type === key ? 'bg-purple-600/15 text-purple-600 border-purple-600/30' : 'bg-white text-[#0b0b0c]/45 border-black/[0.08] hover:text-[#0b0b0c]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="md:ml-auto flex items-center gap-2 text-sm text-[#0b0b0c]/55">
            <Users size={15} />
            <select
              value={member}
              onChange={(e) => setMember(e.target.value)}
              className="cursor-pointer bg-white border border-black/[0.08] rounded-xl py-2.5 px-3 text-sm text-[#0b0b0c] focus:outline-none focus:border-purple-500"
              aria-label="Filter by teammate"
            >
              <option value="">Whole team</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="py-32 flex justify-center"><Loader2 className="w-8 h-8 text-purple-600 animate-spin" /></div>
        ) : events.length === 0 ? (
          <div className="bg-white border border-black/[0.08] rounded-3xl py-20 text-center">
            <History className="w-12 h-12 text-[#0b0b0c]/20 mx-auto mb-4" />
            <p className="text-[#0b0b0c]/60 font-medium">
              {memberFilterHidesType ? "This kind of activity isn't done by a teammate — pick “Whole team”." : 'Nothing here yet.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <section key={group.day}>
                <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0b0b0c]/45 mb-3">{group.day}</h2>
                <div className="bg-white border border-black/[0.08] rounded-3xl divide-y divide-black/[0.06]">
                  {group.items.map((event, i) => (
                    <div key={`${event.type}-${event.at}-${i}`} className="flex items-start gap-3 px-5 py-4">
                      <span className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${EVENT_STYLE[event.type].dot}`}>
                        {EVENT_STYLE[event.type].icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[#0b0b0c]/70 leading-relaxed">
                          <EventText event={event} />
                        </p>
                        {event.type === 'stage_change' && event.note && (
                          <p className="mt-1.5 text-xs text-[#0b0b0c]/60 bg-black/[0.03] border border-black/[0.06] rounded-lg px-3 py-2 whitespace-pre-wrap">
                            “{event.note}”
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-[#0b0b0c]/45 shrink-0 mt-1">{timeLabel(event.at)}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <div className="flex flex-col items-center gap-2 pb-4">
              <p className="text-xs text-[#0b0b0c]/45">Showing {events.length} of {count}</p>
              {hasMore && (
                <button
                  onClick={() => fetchPage(page + 1, true)}
                  disabled={loadingMore}
                  className="cursor-pointer inline-flex items-center gap-2 bg-white border border-black/[0.08] hover:bg-black/[0.03] px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {loadingMore && <Loader2 size={14} className="animate-spin" />} Load more
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
