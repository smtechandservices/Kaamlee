'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Briefcase, Plus, MapPin, Users, ShieldAlert } from 'lucide-react';
import { getToken, authHeaders } from '@/lib/auth';
import type { JobPosting, JobStatus } from '@/lib/hiring-types';

const HIRING_BASE = `${process.env.NEXT_PUBLIC_API_URL}/hiring`;
const EMPLOYERS_BASE = `${process.env.NEXT_PUBLIC_API_URL}/employers`;

const STATUS_STYLES: Record<JobStatus, string> = {
  draft: 'bg-black/[0.05] text-[#0b0b0c]/55',
  published: 'bg-green-500/10 text-green-700',
  paused: 'bg-yellow-500/10 text-yellow-700',
  closed: 'bg-red-500/10 text-red-600',
};

export default function JobsListPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [kycApproved, setKycApproved] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    fetch(`${EMPLOYERS_BASE}/me/`, { headers: authHeaders(token) })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        setKycApproved(data.kyc_status === 'approved');
        if (data.kyc_status !== 'approved') {
          setLoading(false);
          return null;
        }
        return fetch(`${HIRING_BASE}/jobs/?page_size=100`, { headers: authHeaders(token) })
          .then((res) => (res.ok ? res.json() : { results: [] }))
          .then((data) => setJobs(data.results));
      })
      .catch((status) => { if (status === 401) router.push('/login'); })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!kycApproved) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans flex items-center justify-center">
        <div className="max-w-md text-center bg-white border border-black/[0.08] rounded-3xl p-8">
          <ShieldAlert className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">KYC review required</h1>
          <p className="text-sm text-[#0b0b0c]/60 mb-5">
            Job posting unlocks once your employer's KYC is approved by an admin.
          </p>
          <Link href="/kyc" className="inline-flex items-center gap-1.5 text-sm font-bold text-purple-600 hover:underline">
            Check your submission
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <Briefcase size={28} className="text-purple-600" /> Job Postings
            </h1>
            <p className="text-[#0b0b0c]/60 font-medium">{jobs.length} posting{jobs.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/jobs/new"
            className="cursor-pointer inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
            <Plus size={16} /> New posting
          </Link>
        </header>

        {jobs.length === 0 ? (
          <div className="bg-white border border-black/[0.08] rounded-3xl p-16 text-center">
            <Briefcase className="w-12 h-12 text-[#0b0b0c]/20 mx-auto mb-4" />
            <p className="text-sm text-[#0b0b0c]/60 mb-5">You haven't posted any jobs yet.</p>
            <Link href="/jobs/new" className="inline-flex items-center gap-1.5 text-sm font-bold text-purple-600 hover:underline">
              Post your first job
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <div key={job.id}
                className="bg-white border border-black/[0.08] rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-purple-500/40 transition-all">
                <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 mb-1">
                    <h3 className="text-base font-bold truncate">{job.title}</h3>
                    <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[job.status]}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#0b0b0c]/55">
                    {(job.city || job.is_remote) && (
                      <span className="flex items-center gap-1"><MapPin size={12} /> {job.is_remote ? 'Remote' : job.city}</span>
                    )}
                    <span>{job.employment_type.replace('_', '-')}</span>
                  </div>
                </Link>
                <Link href={`/jobs/${job.id}/applicants`}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-500 bg-purple-600/5 px-3 py-2 rounded-xl">
                  <Users size={13} /> Applicants
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
