'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Pencil, Users, Rocket, Pause, Ban, ArrowLeft } from 'lucide-react';
import { getToken, authHeaders } from '@/lib/auth';
import JobPostingForm, { type JobPostingFormValues } from '@/components/JobPostingForm';
import type { JobPosting, JobStatus } from '@/lib/hiring-types';

const HIRING_BASE = `${process.env.NEXT_PUBLIC_API_URL}/hiring`;

const STATUS_STYLES: Record<JobStatus, string> = {
  draft: 'bg-black/[0.05] text-[#0b0b0c]/55',
  published: 'bg-green-500/10 text-green-700',
  paused: 'bg-yellow-500/10 text-yellow-700',
  closed: 'bg-red-500/10 text-red-600',
};

function toFormValues(job: JobPosting): JobPostingFormValues {
  return {
    title: job.title,
    description: job.description,
    employment_type: job.employment_type,
    experience_level: job.experience_level,
    category: job.category,
    salary_min: job.salary_min?.toString() ?? '',
    salary_max: job.salary_max?.toString() ?? '',
    salary_currency: job.salary_currency,
    city: job.city,
    state: job.state,
    country: job.country,
    latitude: job.latitude?.toString() ?? '',
    longitude: job.longitude?.toString() ?? '',
    is_remote: job.is_remote,
    screening_questions: job.screening_questions,
    application_form_schema: job.application_form_schema,
  };
}

export default function EditJobPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [form, setForm] = useState<JobPostingFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const load = () => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    fetch(`${HIRING_BASE}/jobs/${id}/`, { headers: authHeaders(token) })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: JobPosting) => {
        setJob(data);
        setForm(toFormValues(data));
      })
      .catch((status) => { if (status === 401) router.push('/login'); })
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token || !form) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${HIRING_BASE}/jobs/${id}/`, {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          salary_min: form.salary_min ? Number(form.salary_min) : null,
          salary_max: form.salary_max ? Number(form.salary_max) : null,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
        }),
      });
      if (res.ok) {
        router.push('/jobs');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(Object.values(data).flat().join(' ') || 'Failed to save changes.');
      }
    } catch {
      setError('Failed to reach the server.');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: JobStatus) => {
    const token = getToken();
    if (!token) return;
    setStatusUpdating(true);
    try {
      const url = status === 'published' ? `${HIRING_BASE}/jobs/${id}/publish/` : `${HIRING_BASE}/jobs/${id}/`;
      const res = await fetch(url, {
        method: status === 'published' ? 'POST' : 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: status === 'published' ? undefined : JSON.stringify({ status }),
      });
      if (res.ok) setJob(await res.json());
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading || !job || !form) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <Link href="/jobs" className="cursor-pointer inline-flex items-center gap-1.5 text-sm font-semibold text-[#0b0b0c]/60 hover:text-[#0b0b0c] transition-colors mb-4">
          <ArrowLeft size={15} /> Back to jobs
        </Link>

        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <Pencil size={26} className="text-purple-600" /> {job.title}
            </h1>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[job.status]}`}>
                {job.status}
              </span>
              <Link href={`/jobs/${job.id}/applicants`} className="text-xs font-bold text-purple-600 hover:underline inline-flex items-center gap-1">
                <Users size={12} /> View applicants
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {job.status !== 'published' && (
              <button onClick={() => setStatus('published')} disabled={statusUpdating}
                className="cursor-pointer inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
                <Rocket size={15} /> Publish
              </button>
            )}
            {job.status === 'published' && (
              <button onClick={() => setStatus('paused')} disabled={statusUpdating}
                className="cursor-pointer inline-flex items-center gap-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
                <Pause size={15} /> Pause
              </button>
            )}
            {job.status !== 'closed' && (
              <button onClick={() => setStatus('closed')} disabled={statusUpdating}
                className="cursor-pointer inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
                <Ban size={15} /> Close
              </button>
            )}
          </div>
        </header>

        <JobPostingForm
          value={form}
          onChange={setForm}
          onSubmit={handleSave}
          submitLabel="Save changes"
          saving={saving}
          error={error}
        />
      </div>
    </div>
  );
}
