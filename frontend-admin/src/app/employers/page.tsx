'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  RefreshCcw,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Mail,
  Phone,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  UserPlus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const EMPLOYERS_BASE = `${process.env.NEXT_PUBLIC_API_URL}/employers`;
const PAGE_SIZE = 20;

interface KYCDocument {
  id: number;
  doc_type: string;
  file: string;
  uploaded_at: string;
}

interface EmployerMember {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'owner' | 'admin' | 'recruiter';
  created_at: string;
}

interface Employer {
  id: number;
  name: string;
  legal_name: string;
  industry: string;
  size: string;
  website: string;
  logo: string | null;
  logo_url: string;
  address: string;
  contact_email: string;
  contact_phone: string;
  kyc_status: 'pending' | 'approved' | 'rejected';
  kyc_reviewed_at: string | null;
  kyc_rejection_reason: string;
  kyc_documents: KYCDocument[];
  members: EmployerMember[];
  created_at: string;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_STYLES: Record<Employer['kyc_status'], string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  approved: 'bg-green-500/10 text-green-700 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const ROLE_STYLES: Record<EmployerMember['role'], string> = {
  owner: 'bg-purple-600/10 text-purple-600',
  admin: 'bg-blue-500/10 text-blue-600',
  recruiter: 'bg-black/[0.05] text-[#0b0b0c]/55',
};

// Mirrors the actual backend gate for each action (see
// employers/permissions.py) — IsEmployerMember/IsEmployerAdmin/
// IsEmployerOwner — not just a general label.
const ROLE_DESCRIPTIONS: Record<EmployerMember['role'], string> = {
  owner: 'Full access: edit the company profile, submit KYC documents, manage the team (invite, change roles, remove members), and post/manage jobs. The only role that can manage the team.',
  admin: 'Can edit the company profile, submit KYC documents, and post/manage jobs — same hiring access as Owner. Cannot manage team members (no inviting, role changes, or removals).',
  recruiter: 'Can post and manage jobs and applicants — same hiring access as Owner/Admin. Read-only on the company profile; cannot submit KYC documents or manage the team.',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  registration_certificate: 'Registration Certificate',
  tax_id: 'Tax ID',
  address_proof: 'Address Proof',
  authorized_signatory_id: 'Authorized Signatory ID',
};

export default function EmployersKYCPage() {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [rejectingEmployer, setRejectingEmployer] = useState<Employer | null>(null);
  const [editingMember, setEditingMember] = useState<{ employerId: number; member: EmployerMember } | null>(null);
  const [managingTeamId, setManagingTeamId] = useState<number | null>(null);
  const [deletingEmployer, setDeletingEmployer] = useState<Employer | null>(null);
  const [editingEmployer, setEditingEmployer] = useState<Employer | null>(null);
  const managingTeamEmployer = employers.find((e) => e.id === managingTeamId) ?? null;
  const [removingDocId, setRemovingDocId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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

  const fetchEmployers = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search) params.set('search', search);

    setLoading(true);
    try {
      const res = await fetch(`${EMPLOYERS_BASE}/admin/kyc/?${params.toString()}`, {
        headers: { Authorization: `Token ${token}` },
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setEmployers(data.results);
        setCount(data.count);
      }
    } catch (error) {
      console.error('Failed to fetch employers:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchEmployers();
  }, [fetchEmployers]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const selectStatus = (status: StatusFilter) => {
    setStatusFilter(status);
    setPage(1);
  };

  const approve = async (employer: Employer) => {
    const token = getToken();
    if (!token) return;
    setUpdatingId(employer.id);
    try {
      const res = await fetch(`${EMPLOYERS_BASE}/admin/kyc/${employer.id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kyc_status: 'approved', kyc_rejection_reason: '' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEmployers((prev) => prev.map((e) => (e.id === employer.id ? { ...e, ...updated } : e)));
      }
    } catch (error) {
      console.error('Failed to approve employer:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const reject = async (employer: Employer, reason: string) => {
    const token = getToken();
    if (!token) return;
    setUpdatingId(employer.id);
    try {
      const res = await fetch(`${EMPLOYERS_BASE}/admin/kyc/${employer.id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kyc_status: 'rejected', kyc_rejection_reason: reason }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEmployers((prev) => prev.map((e) => (e.id === employer.id ? { ...e, ...updated } : e)));
        setRejectingEmployer(null);
      }
    } catch (error) {
      console.error('Failed to reject employer:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  // Called from DeleteEmployerModal once the admin has typed the name.
  const deleteEmployer = async (employer: Employer) => {
    const token = getToken();
    if (!token) return;
    setUpdatingId(employer.id);
    try {
      const res = await fetch(`${EMPLOYERS_BASE}/admin/kyc/${employer.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      });
      if (res.ok) {
        setEmployers((prev) => prev.filter((e) => e.id !== employer.id));
        setCount((c) => c - 1);
        setDeletingEmployer(null);
      } else {
        alert('Failed to delete employer');
      }
    } catch {
      alert('Failed to delete employer');
    } finally {
      setUpdatingId(null);
    }
  };

  const removeDocument = async (employerId: number, doc: KYCDocument) => {
    if (!window.confirm(`Remove "${DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}"? The employer will need to resubmit it.`)) return;
    const token = getToken();
    if (!token) return;
    setRemovingDocId(doc.id);
    try {
      const res = await fetch(`${EMPLOYERS_BASE}/admin/kyc-documents/${doc.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      });
      if (res.ok) {
        setEmployers((prev) => prev.map((e) => (
          e.id === employerId
            ? { ...e, kyc_documents: e.kyc_documents.filter((d) => d.id !== doc.id) }
            : e
        )));
      } else {
        alert('Failed to remove document');
      }
    } catch (error) {
      alert('Failed to remove document');
    } finally {
      setRemovingDocId(null);
    }
  };

  const counts = {
    pending: employers.filter((e) => e.kyc_status === 'pending').length,
  };

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              Employer KYC
            </h1>
            <p className="text-[#0b0b0c]/60 font-medium">
              {count.toLocaleString()} employer{count !== 1 ? 's' : ''}{statusFilter !== 'all' ? ` · ${statusFilter}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0b0b0c]/60" size={18} />
              <input
                type="text"
                placeholder="Search by name, email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                className="w-72 bg-white border border-black/[0.08] rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="cursor-pointer flex items-center gap-2 px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-all"
            >
              <Plus size={18} /> Add employer
            </button>
            <button
              onClick={() => fetchEmployers()}
              className="cursor-pointer p-3 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] transition-all"
              title="Refresh"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 mb-8">
          {([
            ['all', 'All'],
            ['approved', 'Approved'],
            ['pending', 'Pending'],
            ['rejected', 'Rejected'],
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
              {label}{key === 'pending' && counts.pending > 0 ? ` (${counts.pending})` : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
            <p className="text-[#0b0b0c]/60 text-xs font-bold uppercase tracking-widest">Loading employers</p>
          </div>
        ) : (
          <div className="bg-white border border-black/[0.08] rounded-3xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] bg-black/[0.02]">
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Employer</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Team</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Documents</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Status</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Submitted</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                <AnimatePresence mode="popLayout">
                  {employers.map((e) => (
                    <motion.tr
                      key={e.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-black/[0.02] transition-colors align-top"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          {e.logo ? (
                            <img src={e.logo} alt="" className="w-10 h-10 rounded-xl object-contain bg-white border border-black/[0.06] shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 font-bold text-sm shrink-0">
                              {e.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-[#0b0b0c] text-sm leading-tight truncate">{e.name}</div>
                            {e.industry && <div className="text-xs text-[#0b0b0c]/60 mt-0.5 truncate">{e.industry}</div>}
                            <div className="text-xs text-[#0b0b0c]/60 flex items-center gap-1 mt-1">
                              <Mail size={11} /> {e.contact_email}
                            </div>
                            {e.contact_phone && (
                              <div className="text-xs text-[#0b0b0c]/60 flex items-center gap-1 mt-0.5">
                                <Phone size={11} /> {e.contact_phone}
                              </div>
                            )}
                            {e.website && (
                              <a href={e.website} target="_blank" rel="noreferrer" className="text-xs text-purple-600 hover:text-purple-500 flex items-center gap-1 mt-0.5">
                                <ExternalLink size={11} /> {e.website}
                              </a>
                            )}
                          </div>
                        </div>
                        {e.kyc_status === 'rejected' && e.kyc_rejection_reason && (
                          <div className="mt-2 text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            {e.kyc_rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {e.members.length === 0 ? (
                          <span className="text-xs text-[#0b0b0c]/40">No members</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {e.members.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => setEditingMember({ employerId: e.id, member: m })}
                                className="cursor-pointer flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity text-left"
                                title="Edit team member"
                              >
                                <span className="font-semibold truncate max-w-[110px]">{m.username}</span>
                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${ROLE_STYLES[m.role]}`}>
                                  {m.role}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => setManagingTeamId(e.id)}
                          className="cursor-pointer mt-2 inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-500 transition-colors"
                        >
                          <Users size={12} /> Manage team
                        </button>
                      </td>
                      <td className="px-6 py-5">
                        {e.kyc_documents.length === 0 ? (
                          <span className="text-xs text-[#0b0b0c]/40">None submitted</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {e.kyc_documents.map((doc) => (
                              <div key={doc.id} className="inline-flex items-center gap-1.5">
                                <a
                                  href={doc.file}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-500"
                                >
                                  <FileText size={12} /> {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                                </a>
                                <button
                                  onClick={() => removeDocument(e.id, doc)}
                                  disabled={removingDocId === doc.id}
                                  className="cursor-pointer text-[#0b0b0c]/55 hover:text-red-500 transition-colors disabled:opacity-50"
                                  title="Remove document"
                                >
                                  {removingDocId === doc.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${STATUS_STYLES[e.kyc_status]}`}>
                          {e.kyc_status === 'pending' && <Clock size={11} />}
                          {e.kyc_status === 'approved' && <CheckCircle2 size={11} />}
                          {e.kyc_status === 'rejected' && <XCircle size={11} />}
                          {e.kyc_status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-[#0b0b0c]/55 font-mono whitespace-nowrap">
                          {new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {e.kyc_status !== 'approved' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => approve(e)}
                              disabled={updatingId === e.id}
                              className="cursor-pointer p-2 rounded-lg bg-green-500/10 text-green-700 border border-green-500/30 hover:bg-green-600/20 transition-all disabled:opacity-50"
                              title="Approve"
                            >
                              {updatingId === e.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            </button>
                            <button
                              onClick={() => setRejectingEmployer(e)}
                              disabled={updatingId === e.id}
                              className="cursor-pointer p-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-600/20 transition-all disabled:opacity-50"
                              title="Reject"
                            >
                              {updatingId === e.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                            </button>
                          </div>
                        )}
                        {e.kyc_status === 'approved' && (
                          <button
                            onClick={() => setRejectingEmployer(e)}
                            disabled={updatingId === e.id}
                            className="cursor-pointer text-xs font-semibold text-[#0b0b0c]/60 hover:text-[#0b0b0c] transition-colors disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        )}
                        <button
                          onClick={() => setEditingEmployer(e)}
                          disabled={updatingId === e.id}
                          className="cursor-pointer mt-2 flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-500 transition-colors disabled:opacity-50"
                          title="Edit employer"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => setDeletingEmployer(e)}
                          disabled={updatingId === e.id}
                          className="cursor-pointer mt-2 flex items-center gap-1 text-xs font-semibold text-red-500/80 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Delete employer"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>

            {employers.length === 0 && (
              <div className="py-24 text-center">
                <Building2 className="w-12 h-12 text-[#0b0b0c]/80 mx-auto mb-4" />
                <p className="text-[#0b0b0c]/60 font-medium">
                  {count === 0 && !search ? 'No employers in this queue yet.' : 'No results match your search.'}
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
        {rejectingEmployer && (
          <RejectReasonModal
            employer={rejectingEmployer}
            onClose={() => setRejectingEmployer(null)}
            onConfirm={(reason) => reject(rejectingEmployer, reason)}
            submitting={updatingId === rejectingEmployer.id}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCreating && (
          <CreateEmployerModal
            onClose={() => setIsCreating(false)}
            onCreated={(created) => {
              setIsCreating(false);
              if (page === 1 && (statusFilter === 'all' || statusFilter === created.kyc_status) && !search) {
                setEmployers((prev) => [created, ...prev].slice(0, PAGE_SIZE));
                setCount((c) => c + 1);
              } else {
                fetchEmployers();
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingEmployer && (
          <EditEmployerModal
            employer={editingEmployer}
            onClose={() => setEditingEmployer(null)}
            onSaved={(updated) => {
              setEmployers((prev) => prev.map((e) => (e.id === editingEmployer.id ? { ...e, ...updated } : e)));
              setEditingEmployer(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingEmployer && (
          <DeleteEmployerModal
            employer={deletingEmployer}
            deleting={updatingId === deletingEmployer.id}
            onClose={() => setDeletingEmployer(null)}
            onConfirm={() => deleteEmployer(deletingEmployer)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {managingTeamEmployer && (
          <ManageTeamModal
            employer={managingTeamEmployer}
            onClose={() => setManagingTeamId(null)}
            onEdit={(member) => setEditingMember({ employerId: managingTeamEmployer.id, member })}
            onMembersChange={(members) => setEmployers((prev) => prev.map((e) => (
              e.id === managingTeamEmployer.id ? { ...e, members } : e
            )))}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingMember && (
          <EditMemberModal
            member={editingMember.member}
            onClose={() => setEditingMember(null)}
            onSaved={(updated) => {
              setEmployers((prev) => prev.map((e) => (
                e.id === editingMember.employerId
                  ? { ...e, members: e.members.map((m) => (m.id === updated.id ? updated : m)) }
                  : e
              )));
              setEditingMember(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Deleting an employer wipes a lot at once, so spell out exactly what goes
// and make the admin type the employer's name before the button unlocks.
function DeleteEmployerModal({ employer, deleting, onClose, onConfirm }: {
  employer: Employer;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === employer.name.trim().toLowerCase();
  const members = employer.members.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => !deleting && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-employer-title"
        className="bg-white border border-black/[0.12] rounded-3xl w-full max-w-md shadow-2xl flex flex-col"
      >
        <div className="p-6 border-b border-black/[0.12] bg-red-500/[0.04] rounded-t-3xl shrink-0 flex items-center justify-between">
          <h2 id="delete-employer-title" className="text-xl font-bold flex items-center gap-2 min-w-0">
            <Trash2 size={20} className="text-red-500 shrink-0" />
            <span className="truncate">Delete {employer.name}?</span>
          </h2>
          <button onClick={onClose} disabled={deleting} className="cursor-pointer p-2 hover:bg-black/[0.08] rounded-lg transition-colors text-[#0b0b0c]/40 hover:text-[#0b0b0c] disabled:opacity-40">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-[#0b0b0c]/70">This permanently deletes:</p>
          <ul className="text-sm text-[#0b0b0c]/80 space-y-1.5 list-disc pl-5">
            <li>The employer account and its profile</li>
            <li>All of its job postings, and every application to them</li>
            <li>Its KYC documents{employer.kyc_documents.length ? ` (${employer.kyc_documents.length})` : ''} and logo</li>
            <li>The login{members !== 1 ? 's' : ''} of {members === 0 ? 'its team (none yet)' : `all ${members} team member${members !== 1 ? 's' : ''}`}</li>
          </ul>
          <p className="text-sm font-semibold text-red-600">This can&apos;t be undone.</p>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">
              Type <span className="normal-case tracking-normal font-mono text-[#0b0b0c]">{employer.name}</span> to confirm
            </label>
            <input
              type="text"
              autoFocus
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && matches && !deleting) onConfirm(); }}
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red-500 transition-all"
            />
          </div>
        </div>

        <div className="p-6 bg-black/[0.04] border-t border-black/[0.12] flex gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} disabled={deleting} className="cursor-pointer flex-1 py-3 rounded-xl bg-black/[0.05] hover:bg-black/[0.10] font-bold transition-all disabled:opacity-40">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!matches || deleting}
            className="cursor-pointer flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all flex items-center justify-center gap-2"
          >
            {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={16} />}
            Delete employer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RejectReasonModal({ employer, onClose, onConfirm, submitting }: {
  employer: Employer;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState(employer.kyc_rejection_reason || '');

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
        className="bg-white border border-black/[0.12] rounded-3xl w-full max-w-md shadow-2xl flex flex-col"
      >
        <div className="p-6 border-b border-black/[0.12] bg-black/[0.04] rounded-t-3xl shrink-0 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <XCircle size={20} className="text-red-500" />
            Reject {employer.name}
          </h2>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-black/[0.08] rounded-lg transition-colors text-[#0b0b0c]/40 hover:text-[#0b0b0c]">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 block">
            Reason<span className="text-purple-600"> *</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Registration certificate is unreadable — please resubmit."
            rows={4}
            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm text-[#0b0b0c] placeholder-black/30 focus:border-purple-500 outline-none transition-all resize-none"
          />
        </div>

        <div className="p-6 bg-black/[0.04] border-t border-black/[0.12] flex gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="cursor-pointer flex-1 py-3 rounded-xl bg-black/[0.05] hover:bg-black/[0.10] font-bold transition-all">
            Cancel
          </button>
          <button
            disabled={submitting || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="cursor-pointer flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
            Reject
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EditMemberModal({ member, onClose, onSaved }: {
  member: EmployerMember;
  onClose: () => void;
  onSaved: (updated: EmployerMember) => void;
}) {
  const [username, setUsername] = useState(member.username);
  const [email, setEmail] = useState(member.email);
  const [firstName, setFirstName] = useState(member.first_name);
  const [lastName, setLastName] = useState(member.last_name);
  const [role, setRole] = useState(member.role);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSave = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/login'); return; }
    setSaving(true);
    setError('');
    try {
      const body: Record<string, string> = { username, email, first_name: firstName, last_name: lastName, role };
      if (newPassword || confirmPassword) {
        body.new_password = newPassword;
        body.confirm_password = confirmPassword;
      }
      const res = await fetch(`${EMPLOYERS_BASE}/admin/members/${member.id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved(data as EmployerMember);
      } else {
        setError(Object.values(data).flat().join(' ') || 'Failed to save changes.');
      }
    } catch {
      setError('Failed to reach the server.');
    } finally {
      setSaving(false);
    }
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
        className="bg-white border border-black/[0.12] rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-black/[0.12] bg-black/[0.04] rounded-t-3xl shrink-0 flex items-center justify-between">
          <h2 className="text-xl font-bold">Edit team member</h2>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-black/[0.08] rounded-lg transition-colors text-[#0b0b0c]/40 hover:text-[#0b0b0c]">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">First name</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Last name</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 transition-all" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 transition-all" />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 transition-all" />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as EmployerMember['role'])}
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 transition-all cursor-pointer">
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="recruiter">Recruiter</option>
            </select>
            <p className="text-xs text-[#0b0b0c]/50 mt-2 leading-relaxed">{ROLE_DESCRIPTIONS[role]}</p>
          </div>

          <div className="pt-2 border-t border-black/[0.08]">
            <p className="text-xs text-[#0b0b0c]/50 mb-3">Leave blank to keep the current password.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">New password</label>
                <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Confirm password</label>
                <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 transition-all" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-black/[0.04] border-t border-black/[0.12] flex gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="cursor-pointer flex-1 py-3 rounded-xl bg-black/[0.05] hover:bg-black/[0.10] font-bold transition-all">
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={handleSave}
            className="cursor-pointer flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            Save changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

type Availability = 'idle' | 'checking' | 'available' | 'taken';

// Debounced live duplicate check against /api/check-existence/ (the same
// endpoint candidate signup uses). The backend re-validates on submit, so
// this is only for early feedback.
function useAvailability(field: 'username' | 'email', value: string): Availability {
  const [state, setState] = useState<Availability>('idle');

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed || (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))) {
      setState('idle');
      return;
    }
    setState('checking');
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/check-existence/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field, value: trimmed }),
          signal: controller.signal,
        });
        if (!res.ok) { setState('idle'); return; }
        const data = await res.json();
        setState(data.exists ? 'taken' : 'available');
      } catch {
        if (!controller.signal.aborted) setState('idle');
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [field, value]);

  return state;
}

// Same idea for the company contact email, checked against existing
// employers via the admin list endpoint's exact contact_email filter.
// `excludeId` skips the employer being edited so its own email isn't "taken".
function useContactEmailAvailability(value: string, excludeId?: number): Availability {
  const [state, setState] = useState<Availability>('idle');

  useEffect(() => {
    const trimmed = value.trim();
    const token = localStorage.getItem('admin_token');
    if (!token || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setState('idle');
      return;
    }
    setState('checking');
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ contact_email: trimmed, page_size: '1' });
        const res = await fetch(`${EMPLOYERS_BASE}/admin/kyc/?${params}`, {
          headers: { Authorization: `Token ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) { setState('idle'); return; }
        const data = await res.json();
        const taken = (data.results as { id: number }[]).some((r) => r.id !== excludeId);
        setState(taken ? 'taken' : 'available');
      } catch {
        if (!controller.signal.aborted) setState('idle');
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, excludeId]);

  return state;
}

function AvailabilityHint({ state, takenLabel }: { state: Availability; takenLabel: string }) {
  if (state === 'idle') return null;
  if (state === 'checking') {
    return <p className="text-xs text-[#0b0b0c]/50 mt-1.5 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Checking…</p>;
  }
  if (state === 'taken') {
    return <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><XCircle size={11} /> {takenLabel}</p>;
  }
  return <p className="text-xs text-green-700 mt-1.5 flex items-center gap-1"><CheckCircle2 size={11} /> Available</p>;
}

const INPUT_CLASS = 'w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 transition-all';
const LABEL_CLASS = 'text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block';

// Employers can't self-sign-up — an admin creates the company and its first
// login here, always as Owner. The owner invites the rest of the team from
// the employer portal.
function CreateEmployerModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (created: Employer) => void;
}) {
  const [form, setForm] = useState({
    employer_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    industry: '',
    logo_url: '',
    owner_first_name: '',
    owner_last_name: '',
    owner_username: '',
    owner_email: '',
    password: '',
    confirm_password: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const usernameState = useAvailability('username', form.owner_username);
  const emailState = useAvailability('email', form.owner_email);
  const contactEmailState = useContactEmailAvailability(form.contact_email);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const canSubmit = form.employer_name.trim() && form.contact_email.trim() && form.owner_username.trim()
    && form.owner_email.trim() && form.password && form.confirm_password
    && usernameState !== 'taken' && emailState !== 'taken' && contactEmailState !== 'taken';

  const handleCreate = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/login'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${EMPLOYERS_BASE}/admin/kyc/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        onCreated(data as Employer);
      } else {
        setError(Object.values(data).flat().join(' ') || 'Failed to create employer.');
      }
    } catch {
      setError('Failed to reach the server.');
    } finally {
      setSaving(false);
    }
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
        className="bg-white border border-black/[0.12] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-black/[0.12] bg-black/[0.04] rounded-t-3xl shrink-0 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 size={20} className="text-purple-600" />
            Add employer
          </h2>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-black/[0.08] rounded-lg transition-colors text-[#0b0b0c]/40 hover:text-[#0b0b0c]">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
          )}

          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Company</p>
          <div>
            <label className={LABEL_CLASS}>Company name<span className="text-purple-600"> *</span></label>
            <input type="text" value={form.employer_name} onChange={set('employer_name')} className={INPUT_CLASS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Contact email<span className="text-purple-600"> *</span></label>
              <input type="email" value={form.contact_email} onChange={set('contact_email')}
                className={`${INPUT_CLASS} ${contactEmailState === 'taken' ? '!border-red-500' : ''}`} />
              <AvailabilityHint state={contactEmailState} takenLabel="Another employer uses this email" />
            </div>
            <div>
              <label className={LABEL_CLASS}>Contact phone</label>
              <input type="tel" value={form.contact_phone} onChange={set('contact_phone')} className={INPUT_CLASS} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Website</label>
              <input type="url" placeholder="https://" value={form.website} onChange={set('website')} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Industry</label>
              <input type="text" value={form.industry} onChange={set('industry')} className={INPUT_CLASS} />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Logo URL</label>
            <div className="flex items-center gap-3">
              <input type="url" placeholder="https://example.com/logo.png" value={form.logo_url} onChange={set('logo_url')} className={INPUT_CLASS} />
              <div className="w-10 h-10 rounded-xl bg-black/[0.03] border border-black/[0.08] flex items-center justify-center overflow-hidden shrink-0">
                {/^https?:\/\//.test(form.logo_url.trim()) ? (
                  <img src={form.logo_url.trim()} alt="" className="w-full h-full object-contain bg-white" />
                ) : (
                  <Building2 size={16} className="text-[#0b0b0c]/30" />
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-black/[0.08] space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Owner login</p>
              <p className="text-xs text-[#0b0b0c]/50 mt-1 leading-relaxed">{ROLE_DESCRIPTIONS.owner}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>First name</label>
                <input type="text" value={form.owner_first_name} onChange={set('owner_first_name')} className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Last name</label>
                <input type="text" value={form.owner_last_name} onChange={set('owner_last_name')} className={INPUT_CLASS} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Username<span className="text-purple-600"> *</span></label>
                <input type="text" autoComplete="off" value={form.owner_username} onChange={set('owner_username')}
                  className={`${INPUT_CLASS} ${usernameState === 'taken' ? '!border-red-500' : ''}`} />
                <AvailabilityHint state={usernameState} takenLabel="Username already taken" />
              </div>
              <div>
                <label className={LABEL_CLASS}>Email<span className="text-purple-600"> *</span></label>
                <input type="email" autoComplete="off" value={form.owner_email} onChange={set('owner_email')}
                  className={`${INPUT_CLASS} ${emailState === 'taken' ? '!border-red-500' : ''}`} />
                <AvailabilityHint state={emailState} takenLabel="Email already in use" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Password<span className="text-purple-600"> *</span></label>
                <input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Confirm password<span className="text-purple-600"> *</span></label>
                <input type="password" autoComplete="new-password" value={form.confirm_password} onChange={set('confirm_password')} className={INPUT_CLASS} />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-black/[0.04] border-t border-black/[0.12] flex gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="cursor-pointer flex-1 py-3 rounded-xl bg-black/[0.05] hover:bg-black/[0.10] font-bold transition-all">
            Cancel
          </button>
          <button
            disabled={saving || !canSubmit}
            onClick={handleCreate}
            className="cursor-pointer flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            Create employer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Edit the company profile only. KYC status goes through approve/reject and
// logins through Manage team; an uploaded logo file still wins over logo_url.
function EditEmployerModal({ employer, onClose, onSaved }: {
  employer: Employer;
  onClose: () => void;
  onSaved: (updated: Partial<Employer>) => void;
}) {
  const [form, setForm] = useState({
    name: employer.name,
    legal_name: employer.legal_name,
    industry: employer.industry,
    size: employer.size,
    website: employer.website,
    logo_url: employer.logo_url,
    address: employer.address,
    contact_email: employer.contact_email,
    contact_phone: employer.contact_phone,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const contactEmailState = useContactEmailAvailability(form.contact_email, employer.id);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const canSubmit = form.name.trim() && form.contact_email.trim() && contactEmailState !== 'taken';

  const handleSave = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/login'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${EMPLOYERS_BASE}/admin/kyc/${employer.id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved(data as Partial<Employer>);
      } else {
        setError(Object.values(data).flat().join(' ') || 'Failed to update employer.');
      }
    } catch {
      setError('Failed to reach the server.');
    } finally {
      setSaving(false);
    }
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
        className="bg-white border border-black/[0.12] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-black/[0.12] bg-black/[0.04] rounded-t-3xl shrink-0 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Pencil size={20} className="text-purple-600" />
            Edit employer
          </h2>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-black/[0.08] rounded-lg transition-colors text-[#0b0b0c]/40 hover:text-[#0b0b0c]">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Company name<span className="text-purple-600"> *</span></label>
              <input type="text" value={form.name} onChange={set('name')} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Legal name</label>
              <input type="text" value={form.legal_name} onChange={set('legal_name')} className={INPUT_CLASS} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Contact email<span className="text-purple-600"> *</span></label>
              <input type="email" value={form.contact_email} onChange={set('contact_email')}
                className={`${INPUT_CLASS} ${contactEmailState === 'taken' ? '!border-red-500' : ''}`} />
              <AvailabilityHint state={contactEmailState} takenLabel="Another employer uses this email" />
            </div>
            <div>
              <label className={LABEL_CLASS}>Contact phone</label>
              <input type="tel" value={form.contact_phone} onChange={set('contact_phone')} className={INPUT_CLASS} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Industry</label>
              <input type="text" value={form.industry} onChange={set('industry')} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Company size</label>
              <input type="text" placeholder="e.g. 11-50" value={form.size} onChange={set('size')} className={INPUT_CLASS} />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Website</label>
            <input type="url" placeholder="https://" value={form.website} onChange={set('website')} className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Address</label>
            <input type="text" value={form.address} onChange={set('address')} className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Logo URL</label>
            <div className="flex items-center gap-3">
              <input type="url" placeholder="https://example.com/logo.png" value={form.logo_url} onChange={set('logo_url')} className={INPUT_CLASS} />
              <div className="w-10 h-10 rounded-xl bg-black/[0.03] border border-black/[0.08] flex items-center justify-center overflow-hidden shrink-0">
                {/^https?:\/\//.test(form.logo_url.trim()) ? (
                  <img src={form.logo_url.trim()} alt="" className="w-full h-full object-contain bg-white" />
                ) : (
                  <Building2 size={16} className="text-[#0b0b0c]/30" />
                )}
              </div>
            </div>
            {employer.logo && employer.logo !== employer.logo_url && (
              <p className="text-xs text-[#0b0b0c]/50 mt-1.5">This employer uploaded a logo file, which is shown instead of this URL.</p>
            )}
          </div>
        </div>

        <div className="p-6 bg-black/[0.04] border-t border-black/[0.12] flex gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="cursor-pointer flex-1 py-3 rounded-xl bg-black/[0.05] hover:bg-black/[0.10] font-bold transition-all">
            Cancel
          </button>
          <button
            disabled={saving || !canSubmit}
            onClick={handleSave}
            className="cursor-pointer flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            Save changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Full team management for one employer — list, add, edit (via
// EditMemberModal), remove. The backend refuses to remove or demote an
// employer's only owner; that error is surfaced here as-is.
function ManageTeamModal({ employer, onClose, onEdit, onMembersChange }: {
  employer: Employer;
  onClose: () => void;
  onEdit: (member: EmployerMember) => void;
  onMembersChange: (members: EmployerMember[]) => void;
}) {
  const [showAdd, setShowAdd] = useState(employer.members.length === 0);
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm_password: '', role: 'recruiter' as EmployerMember['role'] });
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  const usernameState = useAvailability('username', form.username);
  const emailState = useAvailability('email', form.email);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const getToken = () => {
    const token = localStorage.getItem('admin_token');
    if (!token) router.push('/login');
    return token;
  };

  const canAdd = form.username.trim() && form.email.trim() && form.password && form.confirm_password
    && usernameState !== 'taken' && emailState !== 'taken';

  const handleAdd = async () => {
    const token = getToken();
    if (!token) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch(`${EMPLOYERS_BASE}/admin/kyc/${employer.id}/members/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onMembersChange([...employer.members, data as EmployerMember]);
        setForm({ username: '', email: '', password: '', confirm_password: '', role: 'recruiter' });
        setShowAdd(false);
      } else {
        setError(Object.values(data).flat().join(' ') || 'Failed to add member.');
      }
    } catch {
      setError('Failed to reach the server.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (member: EmployerMember) => {
    if (!window.confirm(`Remove ${member.username} from ${employer.name}? This deletes their login.`)) return;
    const token = getToken();
    if (!token) return;
    setRemovingId(member.id);
    setError('');
    try {
      const res = await fetch(`${EMPLOYERS_BASE}/admin/members/${member.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      });
      if (res.ok) {
        onMembersChange(employer.members.filter((m) => m.id !== member.id));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(Object.values(data).flat().join(' ') || 'Failed to remove member.');
      }
    } catch {
      setError('Failed to reach the server.');
    } finally {
      setRemovingId(null);
    }
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
        className="bg-white border border-black/[0.12] rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-black/[0.12] bg-black/[0.04] rounded-t-3xl shrink-0 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users size={20} className="text-purple-600" /> Team
            </h2>
            <p className="text-sm text-[#0b0b0c]/60 truncate">
              {employer.name} · {employer.members.length} member{employer.members.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="cursor-pointer p-2 hover:bg-black/[0.08] rounded-lg transition-colors text-[#0b0b0c]/40 hover:text-[#0b0b0c]">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
          )}

          {employer.members.length === 0 ? (
            <p className="text-sm text-[#0b0b0c]/50 text-center py-4">No team members yet.</p>
          ) : (
            <div className="border border-black/[0.08] rounded-2xl divide-y divide-black/[0.06] overflow-hidden">
              {employer.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">
                        {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.username}
                      </span>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${ROLE_STYLES[m.role]}`}>
                        {m.role}
                      </span>
                    </div>
                    <div className="text-xs text-[#0b0b0c]/60 flex items-center gap-1 mt-0.5 truncate">
                      <span className="truncate">@{m.username}</span>
                      <span>·</span>
                      <Mail size={11} className="shrink-0" /> <span className="truncate">{m.email}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onEdit(m)}
                    className="cursor-pointer p-2 rounded-lg text-[#0b0b0c]/50 hover:text-[#0b0b0c] hover:bg-black/[0.05] transition-all"
                    title="Edit member"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleRemove(m)}
                    disabled={removingId === m.id}
                    className="cursor-pointer p-2 rounded-lg text-[#0b0b0c]/50 hover:text-red-500 hover:bg-red-500/5 transition-all disabled:opacity-50"
                    title="Remove member"
                  >
                    {removingId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAdd ? (
            <div className="border border-black/[0.08] rounded-2xl p-4 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Add member</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Username<span className="text-purple-600"> *</span></label>
                  <input type="text" autoComplete="off" value={form.username} onChange={set('username')}
                    className={`${INPUT_CLASS} ${usernameState === 'taken' ? '!border-red-500' : ''}`} />
                  <AvailabilityHint state={usernameState} takenLabel="Username already taken" />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Email<span className="text-purple-600"> *</span></label>
                  <input type="email" autoComplete="off" value={form.email} onChange={set('email')}
                    className={`${INPUT_CLASS} ${emailState === 'taken' ? '!border-red-500' : ''}`} />
                  <AvailabilityHint state={emailState} takenLabel="Email already in use" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Password<span className="text-purple-600"> *</span></label>
                  <input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Confirm password<span className="text-purple-600"> *</span></label>
                  <input type="password" autoComplete="new-password" value={form.confirm_password} onChange={set('confirm_password')} className={INPUT_CLASS} />
                </div>
              </div>
              <div>
                <label className={LABEL_CLASS}>Role</label>
                <select value={form.role} onChange={set('role')} className={`${INPUT_CLASS} cursor-pointer`}>
                  <option value="recruiter">Recruiter</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
                <p className="text-xs text-[#0b0b0c]/50 mt-2 leading-relaxed">{ROLE_DESCRIPTIONS[form.role]}</p>
              </div>
              <div className="flex gap-3">
                {employer.members.length > 0 && (
                  <button onClick={() => { setShowAdd(false); setError(''); }} className="cursor-pointer px-5 py-2.5 rounded-xl bg-black/[0.05] hover:bg-black/[0.10] text-sm font-bold transition-all">
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleAdd}
                  disabled={adding || !canAdd}
                  className="cursor-pointer flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {adding ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  Add member
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="cursor-pointer w-full py-3 rounded-2xl border border-dashed border-purple-600/40 text-purple-600 text-sm font-semibold hover:bg-purple-600/5 transition-all flex items-center justify-center gap-2"
            >
              <UserPlus size={16} /> Add member
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
