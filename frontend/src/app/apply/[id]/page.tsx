'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2, Building2, MapPin, Briefcase, CheckCircle2, FileText, Globe, AlertCircle,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/context/AuthContext';
import type { JobPosting } from '@/lib/hiring-types';
import type { CustomCV } from '@/components/customcv/types';
import { loginPath } from '@/lib/redirect';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export default function ApplyPage() {
  const { id } = useParams<{ id: string }>();
  const { token, logout, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [job, setJob] = useState<JobPosting | null>(null);
  const [cvs, setCvs] = useState<CustomCV[]>([]);
  const [portfolioPublic, setPortfolioPublic] = useState(false);
  // has_resume is the real signal for "is there anything worth sharing" — a
  // Portfolio row always exists (auto-created per user), so its presence
  // alone can't tell a blank shell apart from one built from an uploaded
  // resume (see PortfolioSettingsSerializer.get_has_resume server-side).
  const [hasResume, setHasResume] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedCvId, setSelectedCvId] = useState<number | null>(null);
  const [formResponses, setFormResponses] = useState<Record<string, string>>({});
  const [screeningAnswers, setScreeningAnswers] = useState<Record<string, string>>({});
  const [makePortfolioPublic, setMakePortfolioPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Without this, a visit with no token (logged out, or the sessionStorage-
  // backed session having gone away) left the effect below permanently
  // skipped — `loading` starts true and nothing ever flips it back, so the
  // page just spun forever instead of sending the visitor to log in.
  useEffect(() => {
    if (!isAuthLoading && !token) router.push(loginPath());
  }, [token, isAuthLoading, router]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/hiring/jobs/public/${id}/`, { headers: { Authorization: `Token ${token}` } })
        .then((r) => {
          if (r.status === 401) { logout(); return null; }
          if (!r.ok) { setNotFound(true); return null; }
          return r.json();
        }),
      fetch(`${API_BASE}/api/custom-cv/`, { headers: { Authorization: `Token ${token}` } })
        .then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/api/portfolio/me/`, { headers: { Authorization: `Token ${token}` } })
        .then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([jobData, cvList, portfolio]) => {
        if (jobData) setJob(jobData);
        setCvs(Array.isArray(cvList) ? cvList : []);
        if (Array.isArray(cvList) && cvList.length > 0) setSelectedCvId(cvList[0].id);
        setPortfolioPublic(!!portfolio?.is_public);
        setHasResume(!!portfolio?.has_resume);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !job) return;

    const missingRequired = job.application_form_schema.some((f) => f.required && !formResponses[f.key]?.trim());
    if (missingRequired) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/hiring/jobs/${id}/apply/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cv: selectedCvId,
          form_responses: formResponses,
          screening_answers: job.screening_questions.map((q) => ({
            question_id: q.id,
            answer_text: screeningAnswers[q.id] || '',
          })),
          make_portfolio_public: makePortfolioPublic,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(Object.values(data).flat().join(' ') || 'Failed to submit application.');
      }
    } catch {
      setError('Failed to reach the server.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isAuthLoading || !token || loading) {
    return (
      <main className="h-screen flex bg-[#f2f3f5]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#16a34a] animate-spin" />
        </div>
      </main>
    );
  }

  if (notFound || !job) {
    return (
      <main className="h-screen flex bg-[#f2f3f5]">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-sm text-[#0b0b0c]/60">This posting isn't available anymore.</p>
          <Link href="/map" className="mt-4 text-sm font-semibold text-[#16a34a] hover:underline">Back to Map</Link>
        </div>
      </main>
    );
  }

  const alreadyApplied = job.has_applied || submitted;

  return (
    <main className="h-screen flex bg-[#f2f3f5] text-[#0b0b0c] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/map" title="Apply" wordmark />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto">
            <div className="bg-white border border-black/[0.08] rounded-3xl p-6 mb-6">
              <div className="flex items-center gap-4">
                {job.employer_logo ? (
                  <img src={job.employer_logo} alt="" className="w-14 h-14 rounded-xl object-contain bg-white border border-black/[0.06]" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-[#16a34a]/10 flex items-center justify-center text-[#16a34a] shrink-0">
                    <Building2 size={22} />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-lg font-bold truncate">{job.title}</h1>
                  <p className="text-sm text-black/60 truncate">{job.employer_name}</p>
                  <div className="flex items-center gap-3 text-xs text-black/50 mt-1.5">
                    {(job.city || job.is_remote) && (
                      <span className="flex items-center gap-1"><MapPin size={12} /> {job.is_remote ? 'Remote' : [job.city, job.country].filter(Boolean).join(', ')}</span>
                    )}
                    <span className="flex items-center gap-1"><Briefcase size={12} /> {job.employment_type.replace('_', '-')}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-black/60 mt-4 whitespace-pre-wrap leading-relaxed">{job.description}</p>
            </div>

            {alreadyApplied ? (
              <div className="bg-white border border-black/[0.08] rounded-3xl p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-[#16a34a] mx-auto mb-3" />
                <h2 className="text-lg font-bold mb-1">You've applied</h2>
                <p className="text-sm text-black/55 mb-5">Track this application's status from your tracker.</p>
                <Link href="/applications" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#16a34a] hover:underline">
                  Go to Application Tracker
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
                )}

                <div className="bg-white border border-black/[0.08] rounded-3xl p-6">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-black/50 mb-4">Your CV</h2>
                  {cvs.length === 0 ? (
                    <div className="text-sm text-black/55">
                      You don't have a saved CV yet. <Link href="/custom-cv" className="text-[#16a34a] font-semibold hover:underline">Create one</Link> before applying.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {cvs.map((cv) => (
                        <label key={cv.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedCvId === cv.id ? 'border-[#16a34a]/50 bg-[#16a34a]/5' : 'border-black/[0.08] hover:border-black/20'}`}>
                          <input type="radio" name="cv" checked={selectedCvId === cv.id} onChange={() => setSelectedCvId(cv.id)}
                            className="w-4 h-4 accent-[#16a34a] cursor-pointer" />
                          <FileText size={15} className="text-black/40 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate">{cv.label || cv.target_role || `CV #${cv.id}`}</div>
                            <div className="text-xs text-black/45">ATS score {cv.ats_score}%</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {job.application_form_schema.length > 0 && (
                  <div className="bg-white border border-black/[0.08] rounded-3xl p-6">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-black/50 mb-4">Application details</h2>
                    <div className="flex flex-col gap-4">
                      {job.application_form_schema.map((field) => (
                        <div key={field.key}>
                          <label className="text-xs font-bold uppercase tracking-wider text-black/50 mb-1.5 block">
                            {field.label}{field.required && <span className="text-[#16a34a]"> *</span>}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              required={field.required} rows={4}
                              value={formResponses[field.key] || ''}
                              onChange={(e) => setFormResponses({ ...formResponses, [field.key]: e.target.value })}
                              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#16a34a] transition-all resize-none"
                            />
                          ) : (
                            <input
                              type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
                              required={field.required}
                              value={formResponses[field.key] || ''}
                              onChange={(e) => setFormResponses({ ...formResponses, [field.key]: e.target.value })}
                              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#16a34a] transition-all"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {job.screening_questions.length > 0 && (
                  <div className="bg-white border border-black/[0.08] rounded-3xl p-6">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-black/50 mb-4">Screening questions</h2>
                    <div className="flex flex-col gap-4">
                      {job.screening_questions.map((q) => (
                        <div key={q.id}>
                          <label className="text-xs font-medium text-black/70 mb-1.5 block">{q.question}</label>
                          <textarea
                            required rows={3}
                            value={screeningAnswers[q.id] || ''}
                            onChange={(e) => setScreeningAnswers({ ...screeningAnswers, [q.id]: e.target.value })}
                            className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#16a34a] transition-all resize-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!hasResume ? (
                  <div className="flex items-center gap-3 bg-white border border-black/[0.08] rounded-3xl p-5">
                    <Globe size={16} className="text-black/40 shrink-0" />
                    <span className="text-sm text-black/60 flex-1">
                      You don&apos;t have a portfolio yet — upload a resume to build one you can share with employers.
                    </span>
                    <Link href="/profile" className="text-sm font-semibold text-[#16a34a] hover:underline shrink-0">
                      Add resume
                    </Link>
                  </div>
                ) : !portfolioPublic && (
                  <label className="flex items-center gap-3 bg-white border border-black/[0.08] rounded-3xl p-5 cursor-pointer">
                    <input type="checkbox" checked={makePortfolioPublic} onChange={(e) => setMakePortfolioPublic(e.target.checked)}
                      className="w-4 h-4 accent-[#16a34a] cursor-pointer shrink-0" />
                    <Globe size={16} className="text-black/40 shrink-0" />
                    <span className="text-sm text-black/70">Make my portfolio public so {job.employer_name} can view it</span>
                  </label>
                )}

                <button
                  type="submit" disabled={submitting || cvs.length === 0}
                  className="cursor-pointer w-full bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null} Submit application
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
