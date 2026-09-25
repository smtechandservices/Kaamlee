'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  RefreshCcw,
  School,
  Plus,
  Pencil,
  Trash2,
  X,
  MapPin,
  BookOpen,
  Calendar,
  Landmark,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getCached, setCache, invalidatePrefix } from '@/lib/cache';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface College {
  id: number;
  name: string;
  ownership: 'public' | 'private';
  courses_offered: number;
  logo_url: string;
  location: string;
  established: number | null;
  created_at: string;
}

type OwnershipFilter = 'all' | 'public' | 'private';
type CollegeFormData = Omit<College, 'id' | 'created_at'>;

const EMPTY_FORM: CollegeFormData = {
  name: '',
  ownership: 'public',
  courses_offered: 0,
  logo_url: '',
  location: '',
  established: null,
};

const OWNERSHIP_STYLES: Record<College['ownership'], string> = {
  public: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  private: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
};

export default function CollegesPage() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<College | null>(null);
  const [deleting, setDeleting] = useState<College | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const router = useRouter();

  const getToken = useCallback(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return null;
    }
    return token;
  }, [router]);

  const fetchColleges = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      const token = getToken();
      if (!token) return;
      const cacheKey = 'colleges:all';
      if (!force) {
        const cached = getCached<College[]>(cacheKey);
        if (cached) {
          setColleges(cached);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/admin/colleges/?page_size=2000`, {
          headers: { Authorization: `Token ${token}` },
        });
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          const rows: College[] = Array.isArray(data) ? data : data.results;
          setColleges(rows);
          setCache(cacheKey, rows);
        }
      } catch (err) {
        console.error('Failed to fetch colleges:', err);
      } finally {
        setLoading(false);
      }
    },
    [getToken, router]
  );

  useEffect(() => {
    fetchColleges();
  }, [fetchColleges]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (college: College) => {
    setEditing(college);
    setModalOpen(true);
  };

  const handleSaved = (saved: College) => {
    setColleges((prev) => {
      const exists = prev.some((c) => c.id === saved.id);
      const next = exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
    invalidatePrefix('colleges:');
    setModalOpen(false);
    setEditing(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const token = getToken();
    if (!token) return;
    setDeletingBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/colleges/${deleting.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      });
      if (res.ok) {
        setColleges((prev) => prev.filter((c) => c.id !== deleting.id));
        invalidatePrefix('colleges:');
        setDeleting(null);
      } else {
        alert('Failed to delete college');
      }
    } catch {
      alert('Failed to delete college');
    } finally {
      setDeletingBusy(false);
    }
  };

  const counts = {
    all: colleges.length,
    public: colleges.filter((c) => c.ownership === 'public').length,
    private: colleges.filter((c) => c.ownership === 'private').length,
  };

  const filtered = colleges.filter((c) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q);
    const matchesOwnership = ownershipFilter === 'all' || c.ownership === ownershipFilter;
    return matchesSearch && matchesOwnership;
  });

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              Colleges
            </h1>
            <p className="text-[#0b0b0c]/60 font-medium">
              {colleges.length} college{colleges.length !== 1 ? 's' : ''} we collaborate with
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0b0b0c]/60" size={18} />
              <input
                type="text"
                placeholder="Search by name or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-72 bg-white border border-black/[0.08] rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:border-green-600 transition-all text-sm"
              />
            </div>
            <button
              onClick={() => fetchColleges({ force: true })}
              className="cursor-pointer p-3 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] transition-all"
              title="Refresh"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={openAdd}
              className="cursor-pointer flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-green-600/20"
            >
              <Plus size={18} /> Add college
            </button>
          </div>
        </header>

        {/* Ownership filter tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {([
            ['all', 'All'],
            ['public', 'Public'],
            ['private', 'Private'],
          ] as [OwnershipFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setOwnershipFilter(key)}
              className={`cursor-pointer px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                ownershipFilter === key
                  ? 'bg-green-600/15 text-green-600 border-green-600/30'
                  : 'bg-white text-[#0b0b0c]/40 border-black/[0.08] hover:text-[#0b0b0c]'
              }`}
            >
              {label} <span className="text-[#0b0b0c]/60">({counts[key]})</span>
            </button>
          ))}
        </div>

        {/* Cards */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-4" />
            <p className="text-[#0b0b0c]/60 text-xs font-bold uppercase tracking-widest">Loading colleges</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-black/[0.08] rounded-3xl py-24 text-center">
            <School className="w-12 h-12 text-[#0b0b0c]/80 mx-auto mb-4" />
            <p className="text-[#0b0b0c]/60 font-medium">
              {colleges.length === 0 ? 'No colleges added yet.' : 'No results match your search.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence mode="popLayout">
              {filtered.map((c) => (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="group relative bg-white border border-black/[0.08] rounded-3xl p-6 flex flex-col hover:shadow-[0_1px_2px_rgba(16,18,26,.05),0_12px_28px_-12px_rgba(16,18,26,.18)] transition-shadow"
                >
                  {/* Ownership tag — top right */}
                  <span className={`absolute top-5 right-5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${OWNERSHIP_STYLES[c.ownership]}`}>
                    <Landmark size={10} />
                    {c.ownership}
                  </span>

                  {/* Logo + name */}
                  <div className="flex flex-col items-start gap-3 mb-5 pr-24">
                    <CollegeLogo college={c} size={48} />
                    <div className="w-100 max-w-[98%]">
                      <h3 className="font-bold text-[#0b0b0c] text-[15px] leading-snug line-clamp-2 min-h-[2.75em]">{c.name}</h3>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-2.5 text-sm border-t border-black/[0.06] pt-4">
                    <div className="flex items-center gap-2 text-[#0b0b0c]/70">
                      <BookOpen size={14} className="text-[#0b0b0c]/35 shrink-0" />
                      <span><span className="font-semibold text-[#0b0b0c]">{c.courses_offered}</span> course{c.courses_offered !== 1 ? 's' : ''} offered</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#0b0b0c]/70">
                      <MapPin size={14} className="text-[#0b0b0c]/35 shrink-0" />
                      <span className="truncate">{c.location || <span className="text-[#0b0b0c]/30">Location not set</span>}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#0b0b0c]/70">
                      <Calendar size={14} className="text-[#0b0b0c]/35 shrink-0" />
                      <span>{c.established ? `Est. ${c.established}` : <span className="text-[#0b0b0c]/30">Year not set</span>}</span>
                    </div>
                  </div>

                  {/* Actions — bottom right */}
                  <div className="-mt-6 flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEdit(c)}
                      className="cursor-pointer p-2 rounded-lg bg-black/[0.05] text-[#0b0b0c]/50 hover:bg-green-600/15 hover:text-green-600 transition-all"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleting(c)}
                      className="cursor-pointer p-2 rounded-lg bg-black/[0.05] text-[#0b0b0c]/40 hover:bg-red-600/20 hover:text-red-500 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <CollegeModal
            key="college-modal"
            college={editing}
            getToken={getToken}
            onClose={() => {
              setModalOpen(false);
              setEditing(null);
            }}
            onSaved={handleSaved}
          />
        )}
        {deleting && (
          <DeleteCollegeModal
            key="delete-modal"
            college={deleting}
            deleting={deletingBusy}
            onCancel={() => setDeleting(null)}
            onConfirm={confirmDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CollegeLogo({ college, size = 36 }: { college: College; size?: number }) {
  const [errored, setErrored] = useState(false);
  const style = { width: size, height: size };
  if (college.logo_url && !errored) {
    return (
      <img
        src={college.logo_url}
        alt={college.name}
        onError={() => setErrored(true)}
        style={style}
        className="rounded-lg object-cover border border-black/[0.08] bg-white shrink-0"
      />
    );
  }
  return (
    <span
      style={style}
      className="grid place-items-center rounded-lg border border-black/[0.08] bg-black/[0.03] text-[#0b0b0c]/40 shrink-0"
    >
      <School size={Math.round(size * 0.44)} />
    </span>
  );
}

function CollegeModal({
  college,
  getToken,
  onClose,
  onSaved,
}: {
  college: College | null;
  getToken: () => string | null;
  onClose: () => void;
  onSaved: (saved: College) => void;
}) {
  const [form, setForm] = useState<CollegeFormData>(
    college
      ? {
          name: college.name,
          ownership: college.ownership,
          courses_offered: college.courses_offered,
          logo_url: college.logo_url,
          location: college.location,
          established: college.established,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CollegeFormData>(key: K, value: CollegeFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const token = getToken();
    if (!token) return;
    if (!form.name.trim()) {
      setError('College name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = college
        ? `${API_BASE}/admin/colleges/${college.id}/`
        : `${API_BASE}/admin/colleges/`;
      const res = await fetch(url, {
        method: college ? 'PATCH' : 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          location: form.location.trim(),
          logo_url: form.logo_url.trim(),
          courses_offered: Number(form.courses_offered) || 0,
          established: form.established ? Number(form.established) : null,
        }),
      });
      if (res.ok) {
        onSaved(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        const firstError =
          typeof data === 'object' && data
            ? Object.values(data).flat()[0]
            : null;
        setError((firstError as string) || 'Failed to save college.');
      }
    } catch {
      setError('Failed to save college.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-black/[0.08] rounded-3xl w-full max-w-lg overflow-hidden"
      >
        <div className="p-8 border-b border-black/[0.08] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{college ? 'Edit college' : 'Add college'}</h2>
            <p className="text-sm text-[#0b0b0c]/60 mt-1">
              {college ? 'Update this collaboration.' : 'Add a college we collaborate with.'}
            </p>
          </div>
          <button onClick={onClose} className="cursor-pointer p-2 rounded-lg hover:bg-black/[0.05] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-5 max-h-[60vh] overflow-y-auto">
          <Field label="College name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Indian Institute of Technology, Delhi"
              className="w-full bg-black/[0.02] border border-black/[0.08] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-600 transition-all"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Ownership">
              <select
                value={form.ownership}
                onChange={(e) => set('ownership', e.target.value as College['ownership'])}
                className="w-full bg-black/[0.02] border border-black/[0.08] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-600 transition-all cursor-pointer"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </Field>
            <Field label="Courses offered">
              <input
                type="number"
                min={0}
                value={form.courses_offered}
                onChange={(e) => set('courses_offered', e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full bg-black/[0.02] border border-black/[0.08] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-600 transition-all"
              />
            </Field>
          </div>

          <Field label="Location">
            <input
              type="text"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. New Delhi, India"
              className="w-full bg-black/[0.02] border border-black/[0.08] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-600 transition-all"
            />
          </Field>

          <Field label="Established (year)">
            <input
              type="number"
              min={1800}
              max={new Date().getFullYear()}
              value={form.established ?? ''}
              onChange={(e) => set('established', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="e.g. 1961"
              className="w-full bg-black/[0.02] border border-black/[0.08] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-600 transition-all"
            />
          </Field>

          <Field label="Logo URL">
            <input
              type="url"
              value={form.logo_url}
              onChange={(e) => set('logo_url', e.target.value)}
              placeholder="https://..."
              className="w-full bg-black/[0.02] border border-black/[0.08] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-600 transition-all"
            />
            {form.logo_url.trim() && (
              <img
                src={form.logo_url}
                alt="Logo preview"
                className="mt-3 w-12 h-12 rounded-lg object-cover border border-black/[0.08] bg-white"
              />
            )}
          </Field>

          {error && (
            <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
          )}
        </div>

        <div className="p-8 bg-black/[0.02] border-t border-black/[0.08] flex items-center justify-end gap-4">
          <button onClick={onClose} className="cursor-pointer px-6 py-3 font-bold text-[#0b0b0c]/60 hover:text-[#0b0b0c] transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="cursor-pointer bg-green-600 text-white hover:bg-green-700 px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {college ? 'Save changes' : 'Add college'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#0b0b0c]/50 mb-1.5 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function DeleteCollegeModal({
  college,
  deleting,
  onCancel,
  onConfirm,
}: {
  college: College;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-black/[0.08] rounded-3xl w-full max-w-md overflow-hidden"
      >
        <div className="p-8 border-b border-black/[0.08]">
          <h2 className="text-xl font-bold">Remove college</h2>
          <p className="text-sm text-[#0b0b0c]/60 mt-1">{college.name}</p>
        </div>
        <div className="p-8">
          <p className="text-sm text-[#0b0b0c]/70">
            This permanently removes <span className="font-semibold text-[#0b0b0c]">{college.name}</span> from the
            collaborated colleges list. This can&apos;t be undone.
          </p>
        </div>
        <div className="p-8 bg-black/[0.02] border-t border-black/[0.08] flex items-center justify-end gap-4">
          <button onClick={onCancel} className="cursor-pointer px-6 py-3 font-bold text-[#0b0b0c]/60 hover:text-[#0b0b0c] transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="cursor-pointer bg-red-500 text-white hover:bg-red-600 px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center gap-2"
          >
            {deleting && <Loader2 size={16} className="animate-spin" />}
            Delete college
          </button>
        </div>
      </motion.div>
    </div>
  );
}
