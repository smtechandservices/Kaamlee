'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  RefreshCcw,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Mail,
  Phone,
  Copy,
  Check,
  X,
  KeyRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const AMBASSADOR_BASE = `${process.env.NEXT_PUBLIC_API_URL}/ambassador`;

interface AmbassadorApplication {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  college_name: string;
  college_city: string;
  college_state: string;
  course: string;
  degree_level: 'undergrad' | 'postgrad';
  graduation_year: number;
  id_card_image: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  ambassador_username: string | null;
  referral_code: string | null;
}

interface AmbassadorCredentials {
  username: string;
  temp_password: string | null;
  referral_code: string;
  note?: string;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-[#0a0a0a] border border-[#222] px-4 py-3">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#555]">{label}</div>
        <div className="font-mono text-sm text-white truncate">{value}</div>
      </div>
      <button
        onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="cursor-pointer flex-none p-2 rounded-lg bg-[#161616] border border-[#222] hover:bg-[#1c1c1c] transition-all"
      >
        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-[#888]" />}
      </button>
    </div>
  );
}

function CredentialsModal({ credentials, onClose }: { credentials: AmbassadorCredentials; onClose: () => void }) {
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
        className="w-full max-w-md rounded-3xl bg-[#111] border border-[#222] p-7"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-green-500/10 text-green-400 border border-green-500/30">
              <KeyRound size={18} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">Ambassador account created</h2>
              <p className="text-xs text-[#666]">Copy these now — the password won&apos;t be shown again.</p>
            </div>
          </div>
          <button onClick={onClose} className="cursor-pointer p-1.5 rounded-lg text-[#666] hover:text-white hover:bg-[#1c1c1c]">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <CopyField label="Username" value={credentials.username} />
          {credentials.temp_password ? (
            <CopyField label="Temporary password" value={credentials.temp_password} />
          ) : (
            <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 text-sm text-yellow-400">
              {credentials.note || 'This person already has an ambassador account — no new password was generated.'}
            </div>
          )}
          <CopyField label="Referral code" value={credentials.referral_code} />
        </div>

        <button
          onClick={onClose}
          className="cursor-pointer mt-6 w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors"
        >
          Done
        </button>
      </motion.div>
    </motion.div>
  );
}

const STATUS_STYLES: Record<AmbassadorApplication['status'], string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/10 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export default function AmbassadorsPage() {
  const [applications, setApplications] = useState<AmbassadorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [credentials, setCredentials] = useState<AmbassadorCredentials | null>(null);
  const router = useRouter();

  const getToken = () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return null;
    }
    return token;
  };

  const fetchApplications = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${AMBASSADOR_BASE}/admin/applications/`, {
        headers: { Authorization: `Token ${token}` },
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        setApplications(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch ambassador applications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStatus(id: number, status: 'approved' | 'rejected') {
    const token = getToken();
    if (!token) return;
    setUpdatingId(id);
    try {
      const res = await fetch(`${AMBASSADOR_BASE}/admin/applications/${id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        const { credentials: newCredentials, ...applicationFields } = updated;
        setApplications((prev) => prev.map((a) => (a.id === id ? {
          ...a,
          ...applicationFields,
          ...(newCredentials ? { ambassador_username: newCredentials.username, referral_code: newCredentials.referral_code } : {}),
        } : a)));
        if (newCredentials) setCredentials(newCredentials);
      }
    } catch (error) {
      console.error('Failed to update application status:', error);
    } finally {
      setUpdatingId(null);
    }
  }

  async function regeneratePassword(id: number) {
    const token = getToken();
    if (!token) return;
    setUpdatingId(id);
    try {
      const res = await fetch(`${AMBASSADOR_BASE}/admin/applications/${id}/regenerate-password/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}` },
      });
      if (res.ok) {
        setCredentials(await res.json());
      }
    } catch (error) {
      console.error('Failed to regenerate password:', error);
    } finally {
      setUpdatingId(null);
    }
  }

  const counts = {
    all: applications.length,
    pending: applications.filter((a) => a.status === 'pending').length,
    approved: applications.filter((a) => a.status === 'approved').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  const filtered = applications.filter((a) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      a.full_name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.college_name.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <GraduationCap size={28} className="text-blue-500" />
              Campus Ambassadors
            </h1>
            <p className="text-[#555] font-medium">
              {applications.length} application{applications.length !== 1 ? 's' : ''} submitted
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" size={18} />
              <input
                type="text"
                placeholder="Search by name, email, college..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-72 bg-[#111] border border-[#222] rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:border-blue-500 transition-all text-sm"
              />
            </div>
            <button
              onClick={fetchApplications}
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all"
              title="Refresh"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

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
            <p className="text-[#555] text-xs font-bold uppercase tracking-widest">Loading applications</p>
          </div>
        ) : (
          <div className="bg-[#111] border border-[#222] rounded-3xl overflow-x-auto">
            <table className="w-full border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-[#222] bg-[#161616]/50">
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Student</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">College</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Course</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">ID card</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Status</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Account</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Referral code</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Applied</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]/50">
                <AnimatePresence mode="popLayout">
                  {filtered.map((a) => (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-[#161616]/30 transition-colors align-top"
                    >
                      <td className="px-6 py-5">
                        <div className="font-bold text-white text-sm leading-tight">{a.full_name}</div>
                        <div className="text-xs text-[#555] flex items-center gap-1 mt-1">
                          <Mail size={11} /> {a.email}
                        </div>
                        <div className="text-xs text-[#555] flex items-center gap-1 mt-0.5">
                          <Phone size={11} /> {a.phone}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-white">{a.college_name}</div>
                        {(a.college_city || a.college_state) && (
                          <div className="text-xs text-[#555] mt-0.5">
                            {[a.college_city, a.college_state].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-white">{a.course}</div>
                        <div className="text-xs text-[#555] mt-0.5 capitalize">
                          {a.degree_level} · Batch {a.graduation_year}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <a
                          href={a.id_card_image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
                        >
                          View <ExternalLink size={12} />
                        </a>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${STATUS_STYLES[a.status]}`}>
                          {a.status === 'pending' && <Clock size={11} />}
                          {a.status === 'approved' && <CheckCircle2 size={11} />}
                          {a.status === 'rejected' && <XCircle size={11} />}
                          {a.status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        {a.ambassador_username ? (
                          <div className="text-xs font-mono text-[#888] whitespace-nowrap">@{a.ambassador_username}</div>
                        ) : (
                          <span className="text-xs text-[#444]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {a.referral_code ? (
                          <div className="inline-flex items-center gap-1.5 w-fit">
                            <span className="text-[11px] font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5">
                              {a.referral_code}
                            </span>
                            <button
                              onClick={() => navigator.clipboard.writeText(a.referral_code!)}
                              className="cursor-pointer text-[#555] hover:text-white transition-colors"
                              title="Copy referral code"
                            >
                              <Copy size={11} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#444]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-[#666] font-mono whitespace-nowrap">
                          {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {a.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateStatus(a.id, 'approved')}
                              disabled={updatingId === a.id}
                              className="cursor-pointer p-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition-all disabled:opacity-50"
                              title="Approve"
                            >
                              {updatingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            </button>
                            <button
                              onClick={() => updateStatus(a.id, 'rejected')}
                              disabled={updatingId === a.id}
                              className="cursor-pointer p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all disabled:opacity-50"
                              title="Reject"
                            >
                              {updatingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => updateStatus(a.id, a.status === 'approved' ? 'rejected' : 'approved')}
                              disabled={updatingId === a.id}
                              className="cursor-pointer text-xs font-semibold text-[#555] hover:text-white transition-colors disabled:opacity-50"
                            >
                              Mark as {a.status === 'approved' ? 'rejected' : 'approved'}
                            </button>
                            &nbsp;|&nbsp;
                            {a.ambassador_username && (
                              <button
                                onClick={() => regeneratePassword(a.id)}
                                disabled={updatingId === a.id}
                                title="Regenerate temp password"
                                className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                              >
                                {updatingId === a.id ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                                Regenerate password
                              </button>
                            )}
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
                <GraduationCap className="w-12 h-12 text-[#222] mx-auto mb-4" />
                <p className="text-[#555] font-medium">
                  {applications.length === 0 ? 'No applications submitted yet.' : 'No results match your search.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {credentials && (
          <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
