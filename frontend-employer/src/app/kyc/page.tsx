'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2, Upload, FileText, Clock, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { getToken, authHeaders } from '@/lib/auth';

const EMPLOYERS_BASE = `${process.env.NEXT_PUBLIC_API_URL}/employers`;

interface KYCDocument {
  id: number;
  doc_type: string;
  file: string;
  uploaded_at: string;
}

// Verification only — the employer's own details live on /profile.
interface Employer {
  id: number;
  name: string;
  kyc_status: 'pending' | 'approved' | 'rejected';
  kyc_rejection_reason: string;
  kyc_documents: KYCDocument[];
  role: 'owner' | 'admin' | 'recruiter';
}

const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'registration_certificate', label: 'Registration Certificate' },
  { value: 'tax_id', label: 'Tax ID' },
  { value: 'address_proof', label: 'Address Proof' },
  { value: 'authorized_signatory_id', label: 'Authorized Signatory ID' },
];

export default function EmployerVerificationPage() {
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState(DOC_TYPES[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const canEdit = employer?.role === 'owner' || employer?.role === 'admin';

  const load = () => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    fetch(`${EMPLOYERS_BASE}/me/`, { headers: authHeaders(token) })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: Employer) => setEmployer(data))
      .catch((status) => { if (status === 401) router.push('/login'); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token || !file) return;
    setUploading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('doc_type', docType);
      body.append('file', file);
      const res = await fetch(`${EMPLOYERS_BASE}/kyc/`, {
        method: 'POST',
        headers: authHeaders(token),
        body,
      });
      if (res.ok) {
        setFile(null);
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(Object.values(data).flat().join(' ') || 'Failed to upload document.');
      }
    } catch {
      setError('Failed to reach the server.');
    } finally {
      setUploading(false);
    }
  };

  if (loading || !employer) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <ShieldCheck size={28} className="text-purple-600" /> Verification
          </h1>
          <p className="text-[#0b0b0c]/60 font-medium">
            Submit KYC documents so an admin can verify {employer.name}. Employer details are on your{' '}
            <Link href="/profile" className="text-purple-600 font-semibold hover:underline">Profile</Link>.
          </p>
        </header>

        <div className={`flex items-center gap-3 border rounded-2xl px-5 py-4 mb-8 ${
          employer.kyc_status === 'approved' ? 'bg-green-500/10 border-green-500/30 text-green-700'
          : employer.kyc_status === 'rejected' ? 'bg-red-500/10 border-red-500/30 text-red-600'
          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700'
        }`}>
          {employer.kyc_status === 'approved' && <ShieldCheck size={20} />}
          {employer.kyc_status === 'rejected' && <ShieldAlert size={20} />}
          {employer.kyc_status === 'pending' && <Clock size={20} />}
          <div>
            <div className="font-bold text-sm">
              {employer.kyc_status === 'approved' ? "You're verified" : employer.kyc_status === 'rejected' ? 'Verification rejected' : 'Under review'}
            </div>
            <div className="text-xs mt-0.5 opacity-80">
              {employer.kyc_status === 'approved' && 'You can post jobs and review applicants.'}
              {employer.kyc_status === 'pending' && "An admin will review your documents. Posting unlocks after approval."}
              {employer.kyc_status === 'rejected' && (employer.kyc_rejection_reason || 'Upload corrected documents below to resubmit.')}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
        )}

        {!canEdit && (
          <div className="mb-6 text-sm text-[#0b0b0c]/60 bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-3">
            Only an owner or admin can submit verification documents.
          </div>
        )}

        {canEdit && (
          <form onSubmit={handleUpload} className="bg-white border border-black/[0.08] rounded-3xl p-6 mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-4">Submit a document</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all cursor-pointer"
              >
                {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <label className="flex-1 flex items-center gap-2 bg-black/[0.03] border border-dashed border-black/[0.15] rounded-xl px-4 py-2.5 text-sm cursor-pointer hover:border-purple-600/40 transition-all">
                <Upload size={16} className="text-[#0b0b0c]/50 shrink-0" />
                <span className="truncate text-[#0b0b0c]/60">{file ? file.name : 'Choose a file...'}</span>
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              <button
                type="submit"
                disabled={uploading || !file}
                className="cursor-pointer inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : 'Upload'}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white border border-black/[0.08] rounded-3xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-4">Submitted documents</h2>
          {employer.kyc_documents.length === 0 ? (
            <p className="text-sm text-[#0b0b0c]/60">No documents submitted yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {employer.kyc_documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.file}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-black/[0.03] border border-black/[0.08] hover:border-purple-600/40 transition-all"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <FileText size={15} className="text-purple-600 shrink-0" />
                    {DOC_TYPES.find((d) => d.value === doc.doc_type)?.label || doc.doc_type}
                  </span>
                  <span className="text-xs text-[#0b0b0c]/55">{new Date(doc.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
