'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays, MapPin, Plus, Users, IndianRupee, Info, Trophy, Handshake, Gift, Navigation, Pencil, Trash2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import EventLocationMap from '@/components/EventLocationMap';

interface EventItem {
  id: number;
  title: string;
  description: string;
  banner_image: string | null;
  location: string;
  location_map_url: string;
  latitude: number | null;
  longitude: number | null;
  event_date: string;
  price_paise: number;
  prize_pool_paise: number | null;
  goodies_list: string[];
  collaborators_list: string[];
  capacity: number | null;
  spots_left: number | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_notes: string;
  delete_requested: boolean;
  created_at: string;
}

const CARD_CLS = 'rounded-[22px] border border-[#E7E5E0] bg-white shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]';

const STATUS_STYLES: Record<EventItem['status'], string> = {
  pending: 'bg-[#FDE68A] text-[#3B2A03]',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function EventCard({ event: initialEvent }: { event: EventItem }) {
  const [event, setEvent] = useState(initialEvent);
  const [infoOpen, setInfoOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [requestingDelete, setRequestingDelete] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  async function handleRequestDelete() {
    setRequestingDelete(true);
    try {
      const res = await apiFetch(`/events/${event.id}/request-delete/`, { method: 'POST' });
      if (res.ok) {
        setEvent((e) => ({ ...e, delete_requested: true }));
      }
    } catch (error) {
      console.error('Failed to request deletion:', error);
    } finally {
      setRequestingDelete(false);
      setConfirmDelete(false);
    }
  }

  useEffect(() => {
    if (!infoOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [infoOpen]);

  const hasExtras = event.collaborators_list.length > 0 || event.goodies_list.length > 0;

  return (
    <div className={`${CARD_CLS} relative overflow-visible ${infoOpen ? 'z-20' : ''}`}>
      <div className="relative overflow-hidden rounded-t-[22px]">
        {event.banner_image ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Django media URL, no remotePatterns configured
          <img src={event.banner_image} alt={event.title} className="h-36 w-full object-cover" />
        ) : (
          <div className="flex h-36 w-full items-center justify-center bg-[#16A34A]/5">
            <CalendarDays className="text-[#16A34A]/25" size={32} />
          </div>
        )}
        {event.prize_pool_paise != null && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[10.5px] font-bold text-amber-950 shadow-sm">
            <Trophy size={11} /> ₹{(event.prize_pool_paise / 100).toLocaleString('en-IN')} pool
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-[16px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-outfit)' }}>{event.title}</h3>
          <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[event.status]}`}>
            {event.status}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-black/50 line-clamp-2">{event.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-black/45">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} /> {formatDate(event.event_date)}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {event.location}</span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[15px] font-semibold text-[#16A34A]" style={{ fontFamily: 'var(--font-outfit)' }}>
            {event.price_paise === 0 ? 'Free' : (<><IndianRupee size={14} />{(event.price_paise / 100).toFixed(0)}</>)}
          </span>
          {event.spots_left !== null && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-black/40">
              <Users size={12} /> {event.spots_left} spots left
            </span>
          )}
        </div>

        {event.status === 'rejected' && event.reviewer_notes && (
          <p className="mt-3 rounded-[12px] bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{event.reviewer_notes}</p>
        )}

        {event.delete_requested ? (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-[11.5px] font-semibold text-red-600">
            <Trash2 size={12} /> Deletion requested — admin will review
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/events/${event.id}/edit`}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-black/45 transition-colors hover:text-[#0A0A0A]"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              <Pencil size={12} /> Request changes
            </Link>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] text-black/40">Ask admin to remove this?</span>
                <button
                  type="button"
                  onClick={handleRequestDelete}
                  disabled={requestingDelete}
                  className="text-[12px] font-bold text-red-600 hover:underline disabled:opacity-50"
                >
                  {requestingDelete ? 'Sending…' : 'Yes'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-[12px] font-semibold text-black/40 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-500/70 transition-colors hover:text-red-600"
                style={{ fontFamily: 'var(--font-outfit)' }}
              >
                <Trash2 size={12} /> Request delete
              </button>
            )}
          </div>
        )}

        {/* Actions: info popover trigger + primary action, always visible on the card */}
        <div className="relative mt-4 flex items-center gap-2" ref={infoRef}>
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            className={`grid h-11 w-11 flex-none place-items-center rounded-full border transition-colors ${infoOpen ? 'border-[#16A34A]/40 bg-[#16A34A]/5 text-[#16A34A]' : 'border-black/[0.08] text-black/45 hover:text-[#0A0A0A]'}`}
            title="Event info"
          >
            <Info size={17} />
          </button>

          {event.status === 'approved' ? (
            <Link
              href={`/events/${event.id}/attendees`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#16A34A] py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#0A0A0A]"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              <Users size={16} /> View attendees
            </Link>
          ) : (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-full bg-black/[0.04] py-3 text-[13.5px] font-semibold text-black/40">
              {event.status === 'pending' ? 'Awaiting admin review' : 'Not approved'}
            </div>
          )}

          {/* Info popover — anchored, doesn't reflow the grid */}
          <AnimatePresence>
            {infoOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 right-0 z-30 mb-2 rounded-[20px] border border-[#E7E5E0] bg-white p-5 shadow-[0_20px_48px_-16px_rgba(16,18,26,.28)]"
              >
                <p className="text-[13.5px] leading-relaxed text-black/70 whitespace-pre-wrap">{event.description}</p>

                <div className="mt-3">
                  {event.latitude != null && event.longitude != null && (
                    <EventLocationMap
                      latitude={event.latitude}
                      longitude={event.longitude}
                      label={event.location}
                      className="h-32 w-full rounded-[14px] border border-[#E7E5E0]"
                    />
                  )}
                  <a
                    href={
                      event.location_map_url
                        ? event.location_map_url
                        : event.latitude != null && event.longitude != null
                        ? `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`
                        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.location)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#16A34A] hover:underline"
                  >
                    <Navigation size={12} /> Get directions
                  </a>
                </div>

                {event.capacity != null && (
                  <div className="mt-3 inline-flex items-center gap-2 text-[13px] text-black/60">
                    <Users size={13} className="text-[#16A34A]" /> {event.spots_left} / {event.capacity} spots left
                  </div>
                )}

                {hasExtras && (
                  <div className="mt-3 flex flex-col gap-3">
                    {event.collaborators_list.length > 0 && (
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-black/45">
                          <Handshake size={12} className="text-[#16A34A]" /> Collaborators & sponsors
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {event.collaborators_list.map((name) => (
                            <span key={name} className="rounded-full border border-[#E7E5E0] bg-[#FAF9F6] px-2.5 py-1 text-[11.5px] font-medium text-black/70">{name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {event.goodies_list.length > 0 && (
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-black/45">
                          <Gift size={12} className="text-[#16A34A]" /> Goodies & swag
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {event.goodies_list.map((item) => (
                            <span key={item} className="rounded-full border border-[#16A34A]/20 bg-[#16A34A]/5 px-2.5 py-1 text-[11.5px] font-medium text-[#16A34A]">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await apiFetch('/events/mine/');
      setEvents(await res.json());
    })();
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="block text-[26px] font-bold text-[#16A34A] -rotate-2" style={{ fontFamily: 'var(--font-caveat)' }}>on your campus</span>
          <h1 className="mt-2 font-[var(--font-outfit)] text-[34px] font-semibold tracking-tighter">Events</h1>
          <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-[#6B7280]">
            Submit an event, track its approval, and see who registers once it&apos;s live.
          </p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#16A34A] px-5 py-3 text-[13.5px] font-bold text-white transition-colors hover:bg-[#0A0A0A]"
          style={{ fontFamily: 'var(--font-outfit)' }}
        >
          <Plus size={16} /> Submit an event
        </Link>
      </div>

      <div className="mt-6 rounded-[24px] border border-[#E7E5E0] bg-white p-6 sm:p-7">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#57534E]">Your submitted events</h2>

        {events === null ? null : events.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarDays className="mx-auto mb-3 text-black/15" size={36} />
            <p className="text-[14px] text-[#6B7280]">You have not submitted an event yet.</p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
