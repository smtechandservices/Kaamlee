'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { loadRazorpayScript } from '@/lib/razorpay';
import { PRIMARY_BTN_CLS, PRIMARY_BTN_BG, SECONDARY_BTN_CLS, CARD_CLS } from '@/components/ui/landing-kit';
import EventLocationMap from '@/components/EventLocationMap';
import {
  Loader2, CalendarDays, MapPin, IndianRupee, Users, CheckCircle2, ShieldCheck, RotateCcw,
  Trophy, Handshake, Gift, Share2, Check, ClipboardCheck, Info, Navigation,
} from 'lucide-react';

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
  registration_deadline: string | null;
  capacity: number | null;
  price_paise: number;
  prize_pool_paise: number | null;
  goodies_list: string[];
  collaborators_list: string[];
  spots_left: number | null;
  is_registered: boolean;
  created_by_ambassador_name: string;
}

type AuthUser = ReturnType<typeof useAuth>['user'];

function EventCard({
  event, token, user, autoOpenInfo, onApplied,
}: {
  event: EventItem;
  token: string;
  user: AuthUser;
  autoOpenInfo: boolean;
  onApplied: (id: number) => void;
}) {
  const [infoOpen, setInfoOpen] = useState(autoOpenInfo);
  const [applyExpanded, setApplyExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

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

  const isFull = event.spots_left !== null && event.spots_left <= 0 && !event.is_registered;
  const deadlinePassed = event.registration_deadline
    ? new Date(event.registration_deadline) < new Date()
    : new Date(event.event_date) < new Date();

  const handleShareLink = async () => {
    const url = `${window.location.origin}/events?event=${event.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  // Fire-and-forget: a failed confirmation email shouldn't block or error out
  // the application flow, which already succeeded server-side by this point.
  const notifyRegistrationEmail = () => {
    fetch('/api/events/registration-email', {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: event.id }),
    }).catch((error) => console.error('Failed to send registration confirmation email:', error));
  };

  const handleApplyWithKaamlee = async () => {
    setPaymentError(null);
    setIsProcessing(true);
    try {
      const orderRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${event.id}/create-order/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      });
      if (!orderRes.ok) {
        const data = await orderRes.json().catch(() => ({}));
        throw new Error(data.error || 'Could not start your application. Please try again.');
      }
      const order = await orderRes.json();

      // Free events are confirmed immediately server-side, no Razorpay needed.
      if (order.free) {
        onApplied(event.id);
        notifyRegistrationEmail();
        setIsProcessing(false);
        return;
      }

      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error('Payment gateway failed to load. Please refresh and try again.');
      }

      const razorpay = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
        amount: order.amount,
        currency: order.currency,
        name: 'Kaamlee',
        description: `Event — ${event.title}`,
        order_id: order.order_id,
        prefill: {
          name: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || undefined,
          email: user?.email,
        },
        theme: { color: '#22c55e' },
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${event.id}/verify-payment/`, {
              method: 'POST',
              headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            });
            if (!verifyRes.ok) throw new Error();
            onApplied(event.id);
            notifyRegistrationEmail();
          } catch {
            setPaymentError('Payment received but confirmation failed. Try "Check payment status" below or contact support.');
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: () => setIsProcessing(false),
        },
      });
      razorpay.on('payment.failed', () => {
        setPaymentError('Payment failed. Please try again.');
        setIsProcessing(false);
      });
      razorpay.open();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${event.id}/check-status/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        onApplied(event.id);
        notifyRegistrationEmail();
        setPaymentError(null);
      } else {
        setPaymentError(data.message || 'Still pending or not found. Try again in a moment.');
      }
    } catch (error) {
      console.error('Failed to check payment status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const hasExtras = event.collaborators_list.length > 0 || event.goodies_list.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${CARD_CLS} relative overflow-visible ${infoOpen ? 'z-20' : ''}`}
    >
      <div className="relative overflow-hidden rounded-t-[22px]">
        {event.banner_image ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Django media URL, no remotePatterns configured
          <img src={event.banner_image} alt={event.title} className="h-36 w-full object-cover" />
        ) : (
          <div className="h-36 w-full bg-[#16a34a]/10 flex items-center justify-center">
            <CalendarDays className="w-10 h-10 text-[#16a34a]/40" />
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
          <h3 className="font-semibold text-[16px] tracking-tight text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>{event.title}</h3>
          {event.is_registered && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#16a34a]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#16a34a] shrink-0">
              <CheckCircle2 size={11} /> Applied
            </span>
          )}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-black/50 line-clamp-2">{event.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-black/45">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={13} />
            {new Date(event.event_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </span>
          <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {event.location}</span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[15px] font-semibold text-[#16a34a]" style={{ fontFamily: 'var(--font-outfit)' }}>
            {event.price_paise === 0 ? 'Free' : (<><IndianRupee size={14} />{(event.price_paise / 100).toFixed(0)}</>)}
          </span>
          {event.spots_left !== null && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-black/40">
              <Users size={12} /> {event.spots_left} spots left
            </span>
          )}
        </div>

        {/* Actions: info popover trigger + apply, always visible on the card */}
        <div className="relative mt-4 flex items-center gap-2" ref={infoRef}>
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            className={`grid h-11 w-11 flex-none place-items-center rounded-full border transition-colors ${infoOpen ? 'border-[#16a34a]/40 bg-[#16a34a]/5 text-[#16a34a]' : 'border-black/[0.08] text-black/45 hover:text-[#0b0b0c]'}`}
            title="Event info"
          >
            <Info size={17} />
          </button>

          {!event.is_registered && !applyExpanded && (
            <button
              type="button"
              onClick={() => setApplyExpanded(true)}
              disabled={isFull || deadlinePassed}
              className={`${PRIMARY_BTN_CLS} flex-1 py-3 text-[14px]`}
              style={{ ...PRIMARY_BTN_BG, fontFamily: 'var(--font-outfit)' }}
            >
              {isFull ? (
                <span>Event is full</span>
              ) : deadlinePassed ? (
                <span>Applications closed</span>
              ) : (
                <><ClipboardCheck size={16} /><span className="cursor-pointer">Apply to this event</span></>
              )}
            </button>
          )}

          {event.is_registered && (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#16a34a]/10 py-3 text-[13.5px] font-semibold text-[#16a34a]">
              <CheckCircle2 size={16} /> Applied
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
                className="absolute bottom-full left-0 right-0 z-30 mb-2 rounded-[20px] border border-black/[0.08] bg-white p-5 shadow-[0_20px_48px_-16px_rgba(16,18,26,.28)]"
              >
                <p className="text-[13px] text-black/40">Hosted by {event.created_by_ambassador_name}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[rgba(61,61,61,0.85)] whitespace-pre-wrap">{event.description}</p>

                <div className="mt-3">
                  {event.latitude != null && event.longitude != null && (
                    <EventLocationMap
                      latitude={event.latitude}
                      longitude={event.longitude}
                      label={event.location}
                      className="h-32 w-full rounded-[14px] border border-black/[0.08]"
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
                    className={`mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#16a34a] hover:underline`}
                  >
                    <Navigation size={12} /> Get directions to {event.location}
                  </a>
                </div>

                {event.capacity != null && (
                  <div className="mt-3 inline-flex items-center gap-2 text-[13px] text-black/60">
                    <Users size={13} className="text-[#16a34a]" /> {event.spots_left} / {event.capacity} spots left
                  </div>
                )}

                {hasExtras && (
                  <div className="mt-3 flex flex-col gap-3">
                    {event.collaborators_list.length > 0 && (
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-black/45">
                          <Handshake size={12} className="text-[#16a34a]" /> Collaborators & sponsors
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {event.collaborators_list.map((name) => (
                            <span key={name} className="rounded-full border border-black/[0.08] bg-[#fafafa] px-2.5 py-1 text-[11.5px] font-medium text-black/70">{name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {event.goodies_list.length > 0 && (
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-black/45">
                          <Gift size={12} className="text-[#16a34a]" /> Goodies & swag
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {event.goodies_list.map((item) => (
                            <span key={item} className="rounded-full border border-[#16a34a]/20 bg-[#16a34a]/5 px-2.5 py-1 text-[11.5px] font-medium text-[#16a34a]">{item}</span>
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

        {applyExpanded && !event.is_registered && (
          <div className="mt-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => { setApplyExpanded(false); setPaymentError(null); }}
                className="text-[12px] font-semibold text-black/40 transition-colors hover:text-black/70"
              >
                Cancel
              </button>
            </div>
            <button
              onClick={handleApplyWithKaamlee}
              disabled={isProcessing}
              className={`${PRIMARY_BTN_CLS} w-full py-3 text-[14px]`}
              style={{ ...PRIMARY_BTN_BG, fontFamily: 'var(--font-outfit)' }}
            >
              {isProcessing ? (
                <><Loader2 size={16} className="animate-spin" /><span>Processing…</span></>
              ) : event.price_paise === 0 ? (
                <span className="cursor-pointer">Apply with Kaamlee</span>
              ) : (
                <span className="cursor-pointer">Apply with Kaamlee, Pay ₹{(event.price_paise / 100).toFixed(0)}</span>
              )}
            </button>
            <button
              onClick={handleShareLink}
              className={`${SECONDARY_BTN_CLS} w-full py-3 text-[14px] cursor-pointer`}
            >
              {linkCopied ? (<><Check size={15} className="text-[#16a34a]" /><span>Link copied</span></>) : (<><Share2 size={15} /><span>Share event link</span></>)}
            </button>

            {paymentError && (
              <div className="flex flex-col items-center gap-1.5 pt-1">
                <p className="text-[12px] text-red-500 text-center">{paymentError}</p>
                <button
                  onClick={handleCheckStatus}
                  disabled={checkingStatus}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#16a34a] hover:underline"
                >
                  <RotateCcw size={11} className={checkingStatus ? 'animate-spin' : ''} /> Check payment status
                </button>
              </div>
            )}

            {event.price_paise > 0 && (
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-black/40" style={{ fontFamily: 'var(--font-outfit)' }}>
                <ShieldCheck size={11} className="text-[#16a34a]/70 shrink-0" />
                Secured by Razorpay
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function EventsPage() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  // A shared link (?event=123) auto-opens that event's info popover — plain
  // browser API, not useSearchParams, so this page doesn't need a Suspense
  // boundary just to read one query param.
  const [autoOpenId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const eventParam = new URLSearchParams(window.location.search).get('event');
    return eventParam ? Number(eventParam) : null;
  });

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login');
    }
  }, [token, isLoading, router]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/`, {
          headers: { Authorization: `Token ${token}` },
        });
        if (res.ok) setEvents(await res.json());
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  function handleApplied(id: number) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, is_registered: true } : e)));
  }

  // Computed once per page load rather than on every render — a stable cutoff
  // for the session is fine here, no need to re-derive it live.
  const [now] = useState(() => Date.now());
  const upcomingEvents = events.filter((e) => new Date(e.event_date).getTime() >= now);
  const pastAttendedEvents = events
    .filter((e) => new Date(e.event_date).getTime() < now && e.is_registered)
    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

  if (isLoading || loading) {
    return (
      <div className="h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#16a34a] animate-spin" />
      </div>
    );
  }

  return (
    <main className="h-screen flex bg-[#f2f3f5] text-[#0b0b0c] overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/dashboard" title="Events" wordmark />

        <div className="flex-1 overflow-y-auto p-6 relative bg-[#f2f3f5]">
          <div className="mx-auto z-10 relative">
            {events.length === 0 ? (
              <div className={`${CARD_CLS} p-12 text-center`}>
                <CalendarDays className="w-12 h-12 text-black/20 mx-auto mb-4" />
                <p className="text-black/45 font-medium">No events yet, check back soon.</p>
              </div>
            ) : (
              <>
                {upcomingEvents.length === 0 ? (
                  <div className={`${CARD_CLS} p-12 text-center`}>
                    <CalendarDays className="w-12 h-12 text-black/20 mx-auto mb-4" />
                    <p className="text-black/45 font-medium">No upcoming events right now, check back soon.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2">
                    {upcomingEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        token={token || ''}
                        user={user}
                        autoOpenInfo={event.id === autoOpenId}
                        onApplied={handleApplied}
                      />
                    ))}
                  </div>
                )}

                {pastAttendedEvents.length > 0 && (
                  <div className="mt-10">
                    <h2 className="text-[13px] font-semibold uppercase tracking-wide text-black/40">Past events you attended</h2>
                    <div className="mt-4 grid grid-cols-1 items-start gap-5 sm:grid-cols-2">
                      {pastAttendedEvents.map((event) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          token={token || ''}
                          user={user}
                          autoOpenInfo={event.id === autoOpenId}
                          onApplied={handleApplied}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
