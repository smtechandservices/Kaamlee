'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  RefreshCcw,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  IndianRupee,
  Pencil,
  X,
  UploadCloud,
  Navigation,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import EventLocationMap from '@/components/EventLocationMap';

const EVENTS_BASE = `${process.env.NEXT_PUBLIC_API_URL}/events`;

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
  goodies: string;
  collaborators: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_notes: string;
  delete_requested: boolean;
  created_at: string;
  created_by_ambassador_name: string;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_STYLES: Record<EventItem['status'], string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/10 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
};

interface EditFormState {
  title: string;
  description: string;
  location: string;
  location_map_url: string;
  event_date: string;
  registration_deadline: string;
  capacity: string;
  price_inr: string;
  prize_pool_inr: string;
  goodies: string;
  collaborators: string;
}

// datetime-local inputs need "yyyy-MM-ddTHH:mm" in local time, not the ISO
// string (which is UTC) the API returns.
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const editInputClass = 'w-full rounded-xl border border-[#222] bg-[#0a0a0a] px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#555] focus:border-blue-500';
const editLabelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#666]';

function EditEventModal({
  event, token, onClose, onSaved,
}: { event: EventItem; token: string; onClose: () => void; onSaved: (updated: Partial<EventItem>) => void }) {
  const [form, setForm] = useState<EditFormState>({
    title: event.title,
    description: event.description,
    location: event.location,
    location_map_url: event.location_map_url || '',
    event_date: toDatetimeLocalValue(event.event_date),
    registration_deadline: toDatetimeLocalValue(event.registration_deadline),
    capacity: event.capacity != null ? String(event.capacity) : '',
    price_inr: String(event.price_paise / 100),
    prize_pool_inr: event.prize_pool_paise != null ? String(event.prize_pool_paise / 100) : '',
    goodies: event.goodies || '',
    collaborators: event.collaborators || '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationPreview, setLocationPreview] = useState<{ latitude: number; longitude: number } | null>(
    event.latitude != null && event.longitude != null ? { latitude: event.latitude, longitude: event.longitude } : null
  );
  const [resolving, setResolving] = useState(false);

  function set<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Debounced live map preview — re-resolves as the admin edits the pasted
  // Google Maps link, starting from whatever coordinates the event already
  // had saved.
  useEffect(() => {
    const url = form.location_map_url.trim();
    const timeout = setTimeout(async () => {
      if (!url) {
        setLocationPreview(null);
        setResolving(false);
        return;
      }
      setResolving(true);
      try {
        const res = await fetch(`${EVENTS_BASE}/resolve-map-link/?url=${encodeURIComponent(url)}`, {
          headers: { Authorization: `Token ${token}` },
        });
        const data = await res.json();
        setLocationPreview(
          data.latitude != null && data.longitude != null ? { latitude: data.latitude, longitude: data.longitude } : null
        );
      } catch (err) {
        console.error('Failed to preview map link:', err);
      } finally {
        setResolving(false);
      }
    }, 700);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.location_map_url]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('location', form.location);
      formData.append('location_map_url', form.location_map_url.trim());
      if (form.event_date) formData.append('event_date', new Date(form.event_date).toISOString());
      if (form.registration_deadline) formData.append('registration_deadline', new Date(form.registration_deadline).toISOString());
      if (form.capacity.trim()) formData.append('capacity', form.capacity.trim());
      formData.append('price_paise', String(Math.round(Number(form.price_inr || 0) * 100)));
      if (form.prize_pool_inr.trim()) formData.append('prize_pool_paise', String(Math.round(Number(form.prize_pool_inr) * 100)));
      formData.append('goodies', form.goodies.trim());
      formData.append('collaborators', form.collaborators.trim());
      if (file) formData.append('banner_image', file);

      const res = await fetch(`${EVENTS_BASE}/admin/${event.id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}` },
        body: formData,
      });
      if (res.ok) {
        onSaved(await res.json());
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        const firstError = Object.values(data)[0];
        setError(Array.isArray(firstError) ? String(firstError[0]) : String(firstError || 'Could not save changes.'));
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-lg max-h-[88vh] flex-col rounded-3xl bg-[#111] border border-[#222]"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#222] px-7 py-6">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <Pencil size={16} />
            </span>
            <h2 className="text-lg font-bold text-white">Edit event</h2>
          </div>
          <button onClick={onClose} className="cursor-pointer p-1.5 rounded-lg text-[#666] hover:text-white hover:bg-[#1c1c1c]">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-7 py-6">
          <div>
            <label className={editLabelClass}>Title</label>
            <input className={editInputClass} value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label className={editLabelClass}>Description</label>
            <textarea className={`${editInputClass} min-h-[90px] resize-y`} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <label className={editLabelClass}>Location</label>
            <input className={editInputClass} value={form.location} onChange={(e) => set('location', e.target.value)} />
          </div>
          <div>
            <label className={editLabelClass}>Google Maps link</label>
            <input
              className={editInputClass}
              value={form.location_map_url}
              onChange={(e) => set('location_map_url', e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
            />
            {resolving ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] text-[#666]">
                <Loader2 size={11} className="animate-spin" /> Finding this on the map…
              </p>
            ) : locationPreview ? (
              <div className="mt-2">
                <EventLocationMap
                  latitude={locationPreview.latitude}
                  longitude={locationPreview.longitude}
                  label={form.location}
                  className="h-28 w-full rounded-xl border border-[#222]"
                />
                <a
                  href={form.location_map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-blue-400 hover:text-blue-300"
                >
                  <Navigation size={11} /> Preview directions
                </a>
              </div>
            ) : form.location_map_url.trim() ? (
              <p className="mt-1.5 text-[11.5px] text-[#666]">Couldn&apos;t resolve this link — double-check it&apos;s a Google Maps share link.</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={editLabelClass}>Date & time</label>
              <input type="datetime-local" className={editInputClass} value={form.event_date} onChange={(e) => set('event_date', e.target.value)} />
            </div>
            <div>
              <label className={editLabelClass}>Registration deadline</label>
              <input type="datetime-local" className={editInputClass} value={form.registration_deadline} onChange={(e) => set('registration_deadline', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={editLabelClass}>Capacity</label>
              <input type="number" min={1} className={editInputClass} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="Unlimited" />
            </div>
            <div>
              <label className={editLabelClass}>Price (₹)</label>
              <input type="number" min={0} className={editInputClass} value={form.price_inr} onChange={(e) => set('price_inr', e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-[#333] p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#666]">Hackathon extras</p>
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <label className={editLabelClass}>Prize pool (₹)</label>
                <input type="number" min={0} className={editInputClass} value={form.prize_pool_inr} onChange={(e) => set('prize_pool_inr', e.target.value)} placeholder="e.g. 50000" />
              </div>
              <div>
                <label className={editLabelClass}>Collaborators / sponsors</label>
                <input className={editInputClass} value={form.collaborators} onChange={(e) => set('collaborators', e.target.value)} placeholder="Comma-separated, e.g. GitHub, AWS, Razorpay" />
              </div>
              <div>
                <label className={editLabelClass}>Goodies / swag</label>
                <input className={editInputClass} value={form.goodies} onChange={(e) => set('goodies', e.target.value)} placeholder="Comma-separated, e.g. T-shirts, Stickers, Certificates" />
              </div>
            </div>
          </div>

          <div>
            <label className={editLabelClass}>Banner image</label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#333] bg-[#0a0a0a] px-4 py-3 text-sm text-[#888] hover:border-blue-500/50 transition-colors">
              <UploadCloud size={16} className="flex-none text-[#555]" />
              <span className="truncate">{file ? file.name : 'Replace banner image (optional)'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>

        <div className="shrink-0 border-t border-[#222] px-7 py-5">
          {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="cursor-pointer w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function EventsAdminPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

  const getToken = () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return null;
    }
    return token;
  };

  const fetchEvents = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${EVENTS_BASE}/admin/`, {
        headers: { Authorization: `Token ${token}` },
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        setEvents(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStatus(id: number, status: 'approved' | 'rejected') {
    const token = getToken();
    if (!token) return;
    setUpdatingId(id);
    try {
      const res = await fetch(`${EVENTS_BASE}/admin/${id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)));
      }
    } catch (error) {
      console.error('Failed to update event status:', error);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(id: number) {
    const token = getToken();
    if (!token) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`${EVENTS_BASE}/admin/${id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || 'Could not delete this event.');
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
      setDeleteError('Could not reach the server.');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  const counts = {
    all: events.length,
    pending: events.filter((e) => e.status === 'pending').length,
    approved: events.filter((e) => e.status === 'approved').length,
    rejected: events.filter((e) => e.status === 'rejected').length,
  };

  const filtered = events.filter((e) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      e.title.toLowerCase().includes(q) ||
      e.location.toLowerCase().includes(q) ||
      e.created_by_ambassador_name.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <CalendarDays size={28} className="text-blue-500" />
              Events
            </h1>
            <p className="text-[#555] font-medium">
              {events.length} event{events.length !== 1 ? 's' : ''} submitted
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" size={18} />
              <input
                type="text"
                placeholder="Search by title, location, ambassador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-72 bg-[#111] border border-[#222] rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:border-blue-500 transition-all text-sm"
              />
            </div>
            <button
              onClick={fetchEvents}
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all"
              title="Refresh"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {deleteError && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError(null)} className="cursor-pointer text-red-300 hover:text-white">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {([
            ['all', 'All'],
            ['pending', 'Pending'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
          ] as [StatusFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`cursor-pointer px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                statusFilter === key
                  ? 'bg-blue-600/15 text-blue-400 border-blue-500/30'
                  : 'bg-[#111] text-[#888] border-[#222] hover:text-white'
              }`}
            >
              {label} <span className="text-[#555]">({counts[key]})</span>
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-[#555] text-xs font-bold uppercase tracking-widest">Loading events</p>
          </div>
        ) : (
          <div className="bg-[#111] border border-[#222] rounded-3xl overflow-x-auto">
            <table className="w-full border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-[#222] bg-[#161616]/50">
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Event</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Ambassador</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Date & location</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Price</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Status</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Submitted</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]/50">
                <AnimatePresence mode="popLayout">
                  {filtered.map((e) => (
                    <motion.tr
                      key={e.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-[#161616]/30 transition-colors align-top"
                    >
                      <td className="px-6 py-5 max-w-xs">
                        <div className="font-bold text-white text-sm leading-tight whitespace-normal">{e.title}</div>
                        {e.delete_requested && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400">
                            <Trash2 size={9} /> Deletion requested
                          </span>
                        )}
                        <div className="text-xs text-[#555] mt-1 line-clamp-2 whitespace-normal">{e.description}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-white">{e.created_by_ambassador_name}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-xs text-[#888] flex items-center gap-1.5">
                          <CalendarDays size={11} />
                          {new Date(e.event_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-xs text-[#555] flex items-center gap-1.5 mt-1">
                          <MapPin size={11} /> {e.location}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-white flex items-center gap-1">
                          {e.price_paise === 0 ? 'Free' : (<><IndianRupee size={12} />{(e.price_paise / 100).toFixed(0)}</>)}
                        </div>
                        {e.capacity != null && (
                          <div className="text-xs text-[#555] mt-0.5">Cap {e.capacity}</div>
                        )}
                        {e.prize_pool_paise != null && (
                          <div className="text-xs text-amber-400 mt-0.5 flex items-center gap-1">
                            <IndianRupee size={10} />{(e.prize_pool_paise / 100).toLocaleString('en-IN')} pool
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${STATUS_STYLES[e.status]}`}>
                          {e.status === 'pending' && <Clock size={11} />}
                          {e.status === 'approved' && <CheckCircle2 size={11} />}
                          {e.status === 'rejected' && <XCircle size={11} />}
                          {e.status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-[#666] font-mono whitespace-nowrap">
                          {new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {confirmDeleteId === e.id ? (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[11px] text-[#888]">Delete permanently?</span>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleDelete(e.id)}
                                disabled={deletingId === e.id}
                                className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 disabled:opacity-50"
                              >
                                {deletingId === e.id ? <Loader2 size={12} className="animate-spin" /> : null}
                                {deletingId === e.id ? 'Deleting…' : 'Yes, delete'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="cursor-pointer text-xs font-semibold text-[#666] hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {e.status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => updateStatus(e.id, 'approved')}
                                  disabled={updatingId === e.id}
                                  className="cursor-pointer p-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition-all disabled:opacity-50"
                                  title="Approve"
                                >
                                  {updatingId === e.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                </button>
                                <button
                                  onClick={() => updateStatus(e.id, 'rejected')}
                                  disabled={updatingId === e.id}
                                  className="cursor-pointer p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all disabled:opacity-50"
                                  title="Reject"
                                >
                                  {updatingId === e.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => updateStatus(e.id, e.status === 'approved' ? 'rejected' : 'approved')}
                                disabled={updatingId === e.id}
                                className="cursor-pointer text-xs font-semibold text-[#555] hover:text-white transition-colors disabled:opacity-50"
                              >
                                Mark as {e.status === 'approved' ? 'rejected' : 'approved'}
                              </button>
                            )}
                            <button
                              onClick={() => setEditingEvent(e)}
                              className="cursor-pointer p-2 rounded-lg bg-[#161616] text-[#888] border border-[#222] hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30 transition-all"
                              title="Edit event"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(e.id)}
                              className="cursor-pointer p-2 rounded-lg bg-[#161616] text-[#888] border border-[#222] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
                              title="Delete event"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="py-24 text-center">
                <CalendarDays className="w-12 h-12 text-[#222] mx-auto mb-4" />
                <p className="text-[#555] font-medium">
                  {events.length === 0 ? 'No events submitted yet.' : 'No results match your search.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingEvent && (
          <EditEventModal
            event={editingEvent}
            token={getToken() || ''}
            onClose={() => setEditingEvent(null)}
            onSaved={(updated) => setEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? { ...e, ...updated } : e)))}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
