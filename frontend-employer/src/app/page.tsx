'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2, Building2, ShieldCheck, ShieldAlert, Clock, Users, ArrowRight,
  Mail, Phone, Globe, AlertCircle, Briefcase,
} from 'lucide-react';
import { getToken, authHeaders } from '@/lib/auth';

const EMPLOYERS_BASE = `${process.env.NEXT_PUBLIC_API_URL}/employers`;

interface KYCDocument {
  id: number;
  doc_type: string;
  file: string;
  uploaded_at: string;
}

interface Employer {
  id: number;
  name: string;
  legal_name: string;
  industry: string;
  size: string;
  website: string;
  logo: string | null;
  address: string;
  contact_email: string;
  contact_phone: string;
  kyc_status: 'pending' | 'approved' | 'rejected';
  kyc_rejection_reason: string;
  kyc_documents: KYCDocument[];
  role: 'owner' | 'admin' | 'recruiter';
  created_at: string;
}

const KYC_BANNER: Record<Employer['kyc_status'], { icon: React.ReactNode; cls: string; title: string }> = {
  pending: {
    icon: <Clock size={20} className="text-yellow-600" />,
    cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700',
    title: 'Your KYC is under review',
  },
  approved: {
    icon: <ShieldCheck size={20} className="text-green-600" />,
    cls: 'bg-green-500/10 border-green-500/30 text-green-700',
    title: "You're verified",
  },
  rejected: {
    icon: <ShieldAlert size={20} className="text-red-500" />,
    cls: 'bg-red-500/10 border-red-500/30 text-red-600',
    title: 'Your KYC was rejected',
  },
};

export default function EmployerDashboard() {
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    fetch(`${EMPLOYERS_BASE}/me/`, { headers: authHeaders(token) })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: Employer) => setEmployer(data))
      .catch((status) => {
        if (status === 401) router.push('/login');
        else setError(true);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (error || !employer) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex flex-col items-center justify-center text-[#0b0b0c] p-8">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Connection Error</h1>
        <p className="text-[#0b0b0c]/60 text-center max-w-md">Could not load your employer profile. Please try again shortly.</p>
      </div>
    );
  }

  const banner = KYC_BANNER[employer.kyc_status];

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-1">Welcome back</h1>
          <p className="text-[#0b0b0c]/60 font-medium">{employer.name}</p>
        </header>

        <div className={`flex items-center justify-between gap-4 border rounded-2xl px-5 py-4 mb-8 ${banner.cls}`}>
          <div className="flex items-center gap-3">
            {banner.icon}
            <div>
              <div className="font-bold text-sm">{banner.title}</div>
              {employer.kyc_status === 'rejected' && employer.kyc_rejection_reason && (
                <div className="text-xs mt-0.5 opacity-80">{employer.kyc_rejection_reason}</div>
              )}
              {employer.kyc_status === 'pending' && (
                <div className="text-xs mt-0.5 opacity-80">We'll notify you once an admin reviews your documents.</div>
              )}
            </div>
          </div>
          {employer.kyc_status !== 'approved' && (
            <Link
              href="/kyc"
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold bg-white/70 hover:bg-white px-3.5 py-2 rounded-xl transition-all"
            >
              {employer.kyc_status === 'rejected' ? 'Resubmit' : 'View submission'} <ArrowRight size={13} />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-black/[0.08] rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              {employer.logo ? (
                <img src={employer.logo} alt="" className="w-12 h-12 rounded-xl object-contain bg-white border border-black/[0.06]" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 font-bold shrink-0">
                  <Building2 size={20} />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate">{employer.name}</h2>
                {employer.industry && <p className="text-xs text-[#0b0b0c]/60 truncate">{employer.industry}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-2 text-sm text-[#0b0b0c]/70">
              <div className="flex items-center gap-2"><Mail size={14} className="shrink-0 text-[#0b0b0c]/40" /> {employer.contact_email}</div>
              {employer.contact_phone && (
                <div className="flex items-center gap-2"><Phone size={14} className="shrink-0 text-[#0b0b0c]/40" /> {employer.contact_phone}</div>
              )}
              {employer.website && (
                <a href={employer.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-purple-600 hover:underline">
                  <Globe size={14} className="shrink-0" /> {employer.website}
                </a>
              )}
            </div>
            <Link href="/kyc" className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:underline">
              Edit employer profile <ArrowRight size={13} />
            </Link>
          </div>

          <div className="bg-white border border-black/[0.08] rounded-3xl p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Team</h2>
                <p className="text-xs text-[#0b0b0c]/60">You're signed in as {employer.role}</p>
              </div>
            </div>
            <p className="text-sm text-[#0b0b0c]/70 flex-1">
              Invite teammates to help manage your employer's hiring once job postings go live.
            </p>
            <Link href="/team" className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:underline">
              Manage team <ArrowRight size={13} />
            </Link>
          </div>

          <div className="bg-white border border-black/[0.08] rounded-3xl p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
                <Briefcase size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Job Postings</h2>
                <p className="text-xs text-[#0b0b0c]/60">{employer.kyc_status === 'approved' ? 'Post roles and review applicants' : 'Unlocks after KYC approval'}</p>
              </div>
            </div>
            <p className="text-sm text-[#0b0b0c]/70 flex-1">
              {employer.kyc_status === 'approved'
                ? "Create a posting, publish it, and track candidates through your hiring pipeline."
                : "Once your KYC is approved, you'll be able to post jobs and review applicants here."}
            </p>
            <Link href="/jobs" className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:underline">
              {employer.kyc_status === 'approved' ? 'Manage postings' : 'View'} <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
