'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, MapPin, Navigation, UploadCloud } from 'lucide-react';
import { apiFetch, getToken } from '@/lib/api';
import EventLocationMap from '@/components/EventLocationMap';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kaamlee.in';
const MAX_FILE_MB = 5;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const inputClass = 'w-full rounded-[14px] border border-black/[0.10] bg-white px-4 py-3.5 text-[14.5px] outline-none transition-all placeholder:text-black/35 focus:border-[#16a34a] focus:shadow-[0_0_0_4px_rgba(22,163,74,.12)]';
const labelClass = 'mb-2 block text-[13px] font-semibold text-black/55';

type FormState = {
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
};

interface EventDetail {
  title: string;
  description: string;
  location: string;
  location_map_url: string;
  event_date: string;
  registration_deadline: string | null;
  capacity: number | null;
  price_paise: number;
  prize_pool_paise: number | null;
  goodies: string;
  collaborators: string;
  status: 'pending' | 'approved' | 'rejected';
}

// datetime-local inputs need "yyyy-MM-ddTHH:mm" in local time, not the ISO
// string (which is UTC) the API returns.
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Field({
  id, label, required, error, children,
}: { id: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>{label}{required && <span className="text-[#16a34a]"> *</span>}</label>
      {children}
      {error && <p className="mt-1.5 text-[13px] text-red-600">{error}</p>}
    </div>
  );
}

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [wasReviewed, setWasReviewed] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [locationPreview, setLocationPreview] = useState<{ latitude: number; longitude: number } | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await apiFetch(`/events/mine/${params.id}/`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data: EventDetail = await res.json();
      setWasReviewed(data.status !== 'pending');
      setForm({
        title: data.title,
        description: data.description,
        location: data.location,
        location_map_url: data.location_map_url || '',
        event_date: toDatetimeLocalValue(data.event_date),
        registration_deadline: toDatetimeLocalValue(data.registration_deadline),
        capacity: data.capacity != null ? String(data.capacity) : '',
        price_inr: String(data.price_paise / 100),
        prize_pool_inr: data.prize_pool_paise != null ? String(data.prize_pool_paise / 100) : '',
        goodies: data.goodies || '',
        collaborators: data.collaborators || '',
      });
      setLoading(false);
    })();
  }, [params.id]);

  // Debounced live map preview as the ambassador edits the Google Maps link.
  useEffect(() => {
    if (!form) return;
    const url = form.location_map_url.trim();
    const timeout = setTimeout(async () => {
      if (!url) {
        setLocationPreview(null);
        setResolving(false);
        return;
      }
      setResolving(true);
      try {
        const res = await apiFetch(`/events/resolve-map-link/?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        setLocationPreview(
          data.latitude != null && data.longitude != null ? { latitude: data.latitude, longitude: data.longitude } : null
        );
      } catch (error) {
        console.error('Failed to preview map link:', error);
      } finally {
        setResolving(false);
      }
    }, 700);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.location_map_url]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => { const { [key]: _omit, ...rest } = e; return rest; });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    if (f && f.size > MAX_FILE_BYTES) {
      setErrors((prev) => ({ ...prev, banner_image: `Image is too large, max ${MAX_FILE_MB} MB.` }));
      setFile(null);
      e.target.value = '';
      return;
    }
    setErrors((prev) => { const { banner_image: _omit, ...rest } = prev; return rest; });
    setFile(f);
  }

  function validate(): boolean {
    if (!form) return false;
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = 'Give the event a title.';
    if (!form.description.trim()) next.description = 'Add a short description.';
    if (!form.location.trim()) next.location = 'Enter a location.';
    if (!form.event_date) next.event_date = 'Pick a date and time.';
    if (form.price_inr && (Number.isNaN(Number(form.price_inr)) || Number(form.price_inr) < 0)) {
      next.price_inr = 'Enter a valid amount.';
    }
    if (form.capacity && (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) <= 0)) {
      next.capacity = 'Enter a valid capacity.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!form || !validate()) return;
    setStatus('submitting');

    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('description', form.description);
    formData.append('location', form.location);
    formData.append('location_map_url', form.location_map_url.trim());
    formData.append('event_date', new Date(form.event_date).toISOString());
    if (form.registration_deadline) {
      formData.append('registration_deadline', new Date(form.registration_deadline).toISOString());
    }
    if (form.capacity) formData.append('capacity', form.capacity);
    formData.append('price_paise', String(Math.round(Number(form.price_inr || 0) * 100)));
    if (form.prize_pool_inr) formData.append('prize_pool_paise', String(Math.round(Number(form.prize_pool_inr) * 100)));
    formData.append('goodies', form.goodies.trim());
    formData.append('collaborators', form.collaborators.trim());
    if (file) formData.append('banner_image', file);

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/events/mine/${params.id}/`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Token ${token}` } : undefined,
        body: formData,
      });

      if (res.ok) {
        setStatus('success');
        return;
      }

      const data = await res.json().catch(() => ({}));
      const fieldErrors: Record<string, string> = {};
      Object.entries(data).forEach(([key, val]) => {
        fieldErrors[key] = Array.isArray(val) ? String(val[0]) : String(val);
      });
      setErrors(fieldErrors);
      setStatus('error');
    } catch {
      setErrors({ detail: 'Could not reach the server. Check your connection and try again.' });
      setStatus('error');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={22} className="animate-spin text-[#16a34a]" />
      </div>
    );
  }

  if (notFound || !form) {
    return (
      <div>
        <Link href="/events" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-black/50 transition-colors hover:text-black/80" style={{ fontFamily: 'var(--font-outfit)' }}>
          <ArrowLeft size={15} /> Back to Events
        </Link>
        <p className="mt-6 text-[14.5px] text-black/50">This event isn&apos;t yours, or it doesn&apos;t exist.</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="mx-auto w-full">
        <span className="mx-auto block w-fit text-[22px] font-bold text-[#16A34A] -rotate-2" style={{ fontFamily: 'var(--font-caveat)' }}>updated,</span>
        <div className="relative mt-3 overflow-hidden rounded-[28px] border border-black/[0.08] bg-white p-10 text-center shadow-[0_1px_2px_rgba(16,18,26,.05),0_20px_48px_-20px_rgba(16,18,26,.14)]">
          <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-[#FDE68A]/50" />
          <div className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-[#34D399]/25" />

          <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#eafaf0] text-[#16a34a] ring-8 ring-[#eafaf0]/50">
            <CheckCircle2 size={30} />
          </span>
          <h1 className="relative mt-6 text-[26px] font-semibold tracking-[-0.03em]" style={{ fontFamily: 'var(--font-outfit)' }}>Changes submitted</h1>
          <p className="relative mx-auto mt-3 max-w-sm text-[14.5px] leading-relaxed text-black/55">
            {wasReviewed
              ? "Since this event was already reviewed, it's back to pending — an admin will take another look before it's live again."
              : "It's still pending review, so your changes are saved directly."}
          </p>
          <Link
            href="/events"
            className="relative mt-8 inline-flex items-center justify-center rounded-full bg-[#0b0b0c] px-7 py-[13px] text-[14.5px] font-bold text-white transition-transform duration-300 hover:-translate-y-0.5"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/events" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-black/50 transition-colors hover:text-black/80" style={{ fontFamily: 'var(--font-outfit)' }}>
        <ArrowLeft size={15} /> Back to Events
      </Link>

      <h1 className="mt-4 font-[var(--font-outfit)] text-[30px] font-semibold tracking-tighter">Request changes</h1>
      <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-[#6B7280]">
        {wasReviewed
          ? "This event was already reviewed — saving changes puts it back to pending so an admin can take another look."
          : 'This event is still pending — changes save directly.'}
      </p>

      <div className="mt-6 rounded-[24px] border border-[#E7E5E0] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-5">
          <Field id="title" label="Title" required error={errors.title}>
            <input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} className={inputClass} placeholder="Resume Clinic — VIT Vellore" />
          </Field>

          <Field id="description" label="Description" required error={errors.description}>
            <textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} className={`${inputClass} min-h-[110px] resize-y`} placeholder="What's it about, who's it for, what should people expect?" />
          </Field>

          <Field id="location" label="Location" required error={errors.location}>
            <input id="location" value={form.location} onChange={(e) => set('location', e.target.value)} className={inputClass} placeholder="Seminar Hall 2, VIT Vellore" />
          </Field>

          <Field id="location_map_url" label="Google Maps link (recommended)" error={errors.location_map_url}>
            <input
              id="location_map_url"
              value={form.location_map_url}
              onChange={(e) => set('location_map_url', e.target.value)}
              className={inputClass}
              placeholder="Paste a share link — open the spot in Google Maps, tap Share, Copy link"
            />
            <p className="mt-1.5 text-[12.5px] text-black/40">Shows a map and gives attendees turn-by-turn directions to this exact spot.</p>
            {resolving ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-black/40">
                <Loader2 size={12} className="animate-spin" /> Finding this on the map…
              </p>
            ) : locationPreview ? (
              <div className="mt-2">
                <EventLocationMap
                  latitude={locationPreview.latitude}
                  longitude={locationPreview.longitude}
                  label={form.location}
                  className="h-32 w-full rounded-[14px] border border-black/[0.10]"
                />
                <a
                  href={form.location_map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#16a34a] hover:underline"
                >
                  <Navigation size={12} /> Preview directions
                </a>
              </div>
            ) : form.location_map_url.trim() ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-black/40">
                <MapPin size={12} /> Couldn&apos;t resolve this link — double-check it&apos;s a Google Maps share link.
              </p>
            ) : null}
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="event_date" label="Date & time" required error={errors.event_date}>
              <input id="event_date" type="datetime-local" value={form.event_date} onChange={(e) => set('event_date', e.target.value)} className={inputClass} />
            </Field>
            <Field id="registration_deadline" label="Registration deadline (optional)" error={errors.registration_deadline}>
              <input id="registration_deadline" type="datetime-local" value={form.registration_deadline} onChange={(e) => set('registration_deadline', e.target.value)} className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="capacity" label="Capacity (optional)" error={errors.capacity}>
              <input id="capacity" type="number" min={1} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} className={inputClass} placeholder="Leave blank for unlimited" />
            </Field>
            <Field id="price_inr" label="Price in ₹ (0 for free)" error={errors.price_inr}>
              <input id="price_inr" type="number" min={0} value={form.price_inr} onChange={(e) => set('price_inr', e.target.value)} className={inputClass} placeholder="0" />
            </Field>
          </div>

          <div className="rounded-[16px] border border-dashed border-black/[0.12] p-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-black/40">Hackathon extras (optional)</p>
            <p className="mt-1 text-[12.5px] text-black/40">Running a hackathon? Add these to show them on the event page.</p>
            <div className="mt-4 flex flex-col gap-5">
              <Field id="prize_pool_inr" label="Prize pool in ₹">
                <input id="prize_pool_inr" type="number" min={0} value={form.prize_pool_inr} onChange={(e) => set('prize_pool_inr', e.target.value)} className={inputClass} placeholder="e.g. 50000" />
              </Field>
              <Field id="collaborators" label="Collaborators / sponsors">
                <input id="collaborators" value={form.collaborators} onChange={(e) => set('collaborators', e.target.value)} className={inputClass} placeholder="Comma-separated, e.g. GitHub, AWS, Razorpay" />
              </Field>
              <Field id="goodies" label="Goodies / swag">
                <input id="goodies" value={form.goodies} onChange={(e) => set('goodies', e.target.value)} className={inputClass} placeholder="Comma-separated, e.g. T-shirts, Stickers, Certificates" />
              </Field>
            </div>
          </div>

          <Field id="banner_image" label="Banner image (optional)" error={errors.banner_image}>
            <label
              htmlFor="banner_image"
              className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-dashed border-black/[0.16] bg-[#fafafa] px-4 py-4 text-[14px] text-black/55 transition-colors hover:border-[#16a34a]/50"
            >
              <UploadCloud size={18} className="flex-none text-black/35" />
              <span className="truncate">{file ? `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)` : 'Replace the banner image (optional)'}</span>
            </label>
            <input id="banner_image" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <p className="mt-1.5 text-[12.5px] text-black/40">JPG or PNG, up to {MAX_FILE_MB} MB. Leave blank to keep the current one.</p>
          </Field>

          {errors.detail && (
            <p className="rounded-[12px] bg-red-50 px-4 py-3 text-[13.5px] text-red-700">{errors.detail}</p>
          )}

          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/events')}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.10] px-6 py-[13px] text-[14.5px] font-semibold text-black/60 transition-colors hover:border-black/25 hover:text-black"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={status === 'submitting'}
              className="ml-auto flex flex-1 items-center justify-center gap-2 rounded-full bg-[#4ADE80] py-[15px] text-[15px] font-bold text-black transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              {status === 'submitting' ? (<><Loader2 size={17} className="animate-spin" /> Saving…</>) : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
