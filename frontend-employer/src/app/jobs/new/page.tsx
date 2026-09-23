'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getToken, authHeaders } from '@/lib/auth';
import JobPostingForm, { EMPTY_JOB_FORM, type JobPostingFormValues } from '@/components/JobPostingForm';

const HIRING_BASE = `${process.env.NEXT_PUBLIC_API_URL}/hiring`;

export default function NewJobPage() {
  const [form, setForm] = useState<JobPostingFormValues>(EMPTY_JOB_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${HIRING_BASE}/jobs/`, {
        method: 'POST',
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
        const created = await res.json();
        router.push(`/jobs/${created.id}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(Object.values(data).flat().join(' ') || 'Failed to create posting.');
      }
    } catch {
      setError('Failed to reach the server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <Plus size={28} className="text-purple-600" /> New Job Posting
          </h1>
          <p className="text-[#0b0b0c]/60 font-medium">Saved as a draft first — publish it when you're ready.</p>
        </header>

        <JobPostingForm
          value={form}
          onChange={setForm}
          onSubmit={handleSubmit}
          submitLabel="Create draft"
          saving={saving}
          error={error}
        />
      </div>
    </div>
  );
}
