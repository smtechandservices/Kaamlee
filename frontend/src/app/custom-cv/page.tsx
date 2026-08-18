'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Plus, FileText, Trash2, Briefcase, Lightbulb, Target, CheckCircle2, Sparkles, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import type { CustomCV, CVTemplate, ProfessionKeywords } from '@/components/customcv/types';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import PricingModal from '@/components/PricingModal';
import { PRIMARY_BTN_CLS, PRIMARY_BTN_BG } from '@/components/ui/landing-kit';

const TEMPLATE_LABELS: Record<CVTemplate, string> = {
  modern: 'Modern',
  classic: 'Classic',
  ats: 'ATS Optimized',
};

function scoreColor(score: number) {
  if (score >= 80) return 'text-[#16a34a] border-[#16a34a]/25 bg-[#16a34a]/10';
  if (score >= 50) return 'text-amber-700 border-amber-200 bg-amber-50';
  return 'text-red-600 border-red-200 bg-red-50';
}

export default function CustomCVListPage() {
  const { user, token } = useAuth();
  const { isReady, isSubscribed } = useSubscriptionGate({ allowUnsubscribed: true });
  const router = useRouter();

  const [cvs, setCvs] = useState<CustomCV[]>([]);
  const [keywords, setKeywords] = useState<ProfessionKeywords>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newTemplate, setNewTemplate] = useState<CVTemplate>('ats');
  const [newTargetRole, setNewTargetRole] = useState('');
  const [error, setError] = useState('');
  const [addingRole, setAddingRole] = useState<string | null>(null);
  const [suggestionError, setSuggestionError] = useState('');
  const [isPricingOpen, setIsPricingOpen] = useState(false);

  const handleOpenCV = (cv: CustomCV) => {
    if (cv.is_locked) {
      setIsPricingOpen(true);
      return;
    }
    router.push(`/custom-cv/${cv.id}`);
  };

  useEffect(() => {
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/custom-cv/`, {
      headers: { Authorization: `Token ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setCvs(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setIsLoading(false));

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/custom-cv/keywords/`, {
      headers: { Authorization: `Token ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setKeywords(d && typeof d === 'object' ? d : {}))
      .catch(() => {});
  }, [token]);

  // Free plan allows one custom CV total; further creation requires a subscription.
  const atFreeLimit = !isSubscribed && cvs.length >= 1;

  // Failed ATS checks across every CV, deduped by check name — the generic
  // "Keyword coverage for X" check is excluded here since it gets its own
  // per-term breakdown in the ATS Mapping Terms panel below.
  const suggestions = React.useMemo(() => {
    const byCheck = new Map<string, { check: string; message: string; count: number }>();
    for (const cv of cvs) {
      for (const check of cv.ats_breakdown || []) {
        if (check.passed || check.check.startsWith('Keyword coverage for')) continue;
        const existing = byCheck.get(check.check);
        if (existing) {
          existing.count += 1;
        } else {
          byCheck.set(check.check, { check: check.check, message: check.message, count: 1 });
        }
      }
    }
    return Array.from(byCheck.values()).sort((a, b) => b.count - a.count);
  }, [cvs]);

  // Per-CV matched/missing ATS keywords for whatever target_role it's set to,
  // computed client-side against the same profession keyword bank the
  // backend scores against.
  const keywordPanels = React.useMemo(() => {
    return cvs
      .filter((cv) => cv.target_role && (keywords[cv.target_role]?.keywords?.length ?? 0) > 0)
      .map((cv) => {
        const roleKeywords = keywords[cv.target_role].keywords;
        const haystack = JSON.stringify(cv.content || {}).toLowerCase();
        return {
          cvId: cv.id,
          label: cv.label || 'Untitled CV',
          targetRole: cv.target_role,
          matched: roleKeywords.filter((k) => haystack.includes(k.toLowerCase())),
          missing: roleKeywords.filter((k) => !haystack.includes(k.toLowerCase())),
        };
      });
  }, [cvs, keywords]);

  // Roles worth building a CV for, based on how much of each profession's
  // ATS keyword list already shows up in the user's resume — skips roles
  // that already have a CV.
  const suggestedRoles = React.useMemo(() => {
    if (!user?.resume_text) return [];
    const resumeLower = user.resume_text.toLowerCase();
    const existingRoles = new Set(cvs.map((cv) => (cv.target_role || '').toLowerCase()).filter(Boolean));
    return Object.entries(keywords)
      .map(([role, data]) => {
        const list = data.keywords || [];
        const matchCount = list.filter((k) => resumeLower.includes(k.toLowerCase())).length;
        return { role, matchCount, total: list.length };
      })
      .filter((s) => s.total > 0 && s.matchCount >= 2 && s.matchCount / s.total >= 0.3 && !existingRoles.has(s.role.toLowerCase()))
      .sort((a, b) => b.matchCount / b.total - a.matchCount / a.total)
      .slice(0, 4);
  }, [user, cvs, keywords]);

  const handleAddSuggested = async (role: string) => {
    setAddingRole(role);
    setSuggestionError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/custom-cv/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
        body: JSON.stringify({ label: `${role} CV`, template: 'ats', target_role: role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSuggestionError(data.error || `Failed to create a ${role} CV.`);
        return;
      }
      setCvs((prev) => [data, ...prev]);
    } catch {
      setSuggestionError('An error occurred. Please try again.');
    } finally {
      setAddingRole(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/custom-cv/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
        body: JSON.stringify({
          label: newLabel || 'Untitled CV',
          template: newTemplate,
          target_role: newTargetRole || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create CV.');
        return;
      }
      setCvs((prev) => [data, ...prev]);
      setShowNewForm(false);
      setNewLabel('');
      setNewTargetRole('');
      router.push(`/custom-cv/${data.id}`);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this custom CV? This cannot be undone.')) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/custom-cv/${id}/`, {
      method: 'DELETE',
      headers: { Authorization: `Token ${token}` },
    });
    setCvs((prev) => prev.filter((cv) => cv.id !== id));
  };

  if (!isReady) {
    return (
      <div className="h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#16a34a] animate-spin" />
      </div>
    );
  }

  const hasResume = !!user?.resume_text;

  return (
    <main className="h-screen flex bg-[#f2f3f5] text-[#0b0b0c] overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/profile" title="Custom CVs" wordmark />

        <div className="flex-1 overflow-y-auto p-6 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#16a34a]/[0.06] blur-[120px] rounded-full pointer-events-none" />

      <div className="mx-auto z-10 relative">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
        <div className="bg-white border border-black/[0.08] rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 md:p-10 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-[#16a34a]" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>Custom CVs</h2>
            </div>
            {hasResume && !atFreeLimit && (
              <button
                type="button"
                onClick={() => setShowNewForm((s) => !s)}
                className="cursor-pointer flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#16a34a] hover:text-[#15803d]"
                style={{ fontFamily: 'var(--font-outfit)' }}
              >
                <Plus className="w-3.5 h-3.5" /> New CV
              </button>
            )}
          </div>

          {!hasResume ? (
            <div className="bg-black/[0.02] border border-dashed border-black/[0.14] rounded-2xl p-6 text-center">
              <Briefcase className="w-8 h-8 text-black/25 mx-auto mb-3" />
              <p className="text-xs text-black/45 font-medium">Upload a resume in your profile to create a custom CV.</p>
            </div>
          ) : (
            <>
              {atFreeLimit && (
                <div className="flex items-center justify-between gap-3 bg-[#16a34a]/10 border border-[#16a34a]/20 rounded-2xl p-4 mb-6">
                  <p className="text-[11px] text-[#15803d] font-semibold">
                    Free plan includes 1 custom CV. Subscribe to create more.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/pricing')}
                    className="cursor-pointer shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold text-white shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_10px_24px_-10px_rgba(22,163,74,.85)] transition-transform duration-300 hover:-translate-y-0.5"
                    style={{ ...PRIMARY_BTN_BG, fontFamily: 'var(--font-outfit)' }}
                  >
                    Unlock
                  </button>
                </div>
              )}
              {showNewForm && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  onSubmit={handleCreate}
                  className="space-y-4 bg-black/[0.02] border border-black/[0.08] rounded-2xl p-5 mb-6"
                >
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-xs py-3 px-4 rounded-xl">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-black/45 uppercase tracking-widest ml-1" style={{ fontFamily: 'var(--font-outfit)' }}>Label</label>
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="e.g. Fullstack CV"
                      className="w-full bg-white border border-black/[0.10] rounded-xl px-4 py-3 text-xs text-[#0b0b0c] placeholder:text-black/35 focus:border-[#16a34a]/50 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-black/45 uppercase tracking-widest ml-1" style={{ fontFamily: 'var(--font-outfit)' }}>Template</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(TEMPLATE_LABELS) as CVTemplate[]).map((tmpl) => (
                        <button
                          key={tmpl}
                          type="button"
                          onClick={() => setNewTemplate(tmpl)}
                          className={`cursor-pointer rounded-xl py-2.5 text-[11px] font-bold border transition-all ${
                            newTemplate === tmpl ? 'border-[#16a34a] bg-[#16a34a]/10 text-[#16a34a]' : 'border-black/[0.10] text-black/45 hover:border-black/20'
                          }`}
                        >
                          {TEMPLATE_LABELS[tmpl]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-black/45 uppercase tracking-widest ml-1" style={{ fontFamily: 'var(--font-outfit)' }}>Target Role (optional)</label>
                    <input
                      type="text"
                      value={newTargetRole}
                      onChange={(e) => setNewTargetRole(e.target.value)}
                      placeholder="e.g. Fullstack Developer"
                      className="w-full bg-white border border-black/[0.10] rounded-xl px-4 py-3 text-xs text-[#0b0b0c] placeholder:text-black/35 focus:border-[#16a34a]/50 outline-none transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className={`${PRIMARY_BTN_CLS} w-full uppercase tracking-widest text-xs`}
                    style={PRIMARY_BTN_BG}
                  >
                    {isCreating ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    Create CV
                  </button>
                </motion.form>
              )}

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-[#16a34a] animate-spin" />
                </div>
              ) : cvs.length === 0 ? (
                <div className="bg-black/[0.02] border border-dashed border-black/[0.14] rounded-2xl p-6 text-center">
                  <FileText className="w-8 h-8 text-black/25 mx-auto mb-3" />
                  <p className="text-xs text-black/45 font-medium">No custom CVs yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cvs.map((cv) => (
                    <motion.div
                      key={cv.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white border border-black/[0.08] rounded-[18px] p-4 flex items-center justify-between gap-3 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)] transition-all duration-300 ${cv.is_locked ? 'opacity-60' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenCV(cv)}
                        className="cursor-pointer flex-1 text-left"
                      >
                        <p className="text-xs font-semibold text-[#0b0b0c] flex items-center gap-1.5" style={{ fontFamily: 'var(--font-outfit)' }}>
                          {cv.label || 'Untitled CV'}
                          {cv.is_locked && <Lock className="w-3 h-3 text-black/35" />}
                        </p>
                        <p className="text-[10px] text-black/45 mt-0.5">
                          {TEMPLATE_LABELS[cv.template]}
                          {cv.target_role && ` · ${cv.target_role}`}
                          {cv.is_locked && ' · Subscribe to open'}
                        </p>
                      </button>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${scoreColor(cv.ats_score)}`} style={{ fontFamily: 'var(--font-outfit)' }}>
                        {cv.ats_score} ATS
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(cv.id)}
                        className="cursor-pointer text-black/35 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Recommended CVs */}
        <div className="bg-white border border-black/[0.08] rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-[#16a34a]" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>Recommended CVs</h2>
          </div>

          {suggestionError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs py-3 px-4 rounded-xl mb-4">
              {suggestionError}
            </div>
          )}

          {!hasResume ? (
            <p className="text-xs text-black/45 font-medium">Upload a resume to get CV recommendations.</p>
          ) : suggestedRoles.length === 0 ? (
            <div className="bg-black/[0.02] border border-dashed border-black/[0.14] rounded-2xl p-6 text-center">
              <Sparkles className="w-8 h-8 text-black/25 mx-auto mb-3" />
              <p className="text-xs text-black/45 font-medium">
                {cvs.length > 0
                  ? "You've already covered the roles that best match your resume."
                  : 'No strong role matches found yet — try creating a CV manually.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestedRoles.map((s) => (
                <div key={s.role} className="flex items-center justify-between gap-3 bg-black/[0.02] border border-black/[0.08] rounded-xl p-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#0b0b0c] truncate" style={{ fontFamily: 'var(--font-outfit)' }}>{s.role}</p>
                    <p className="text-[10px] text-black/45 mt-0.5">{s.matchCount}/{s.total} keywords match your resume</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => (atFreeLimit ? router.push('/pricing') : handleAddSuggested(s.role))}
                    disabled={addingRole === s.role}
                    className="cursor-pointer shrink-0 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#16a34a] hover:text-[#15803d] border border-[#16a34a]/30 hover:border-[#16a34a]/50 bg-[#16a34a]/10 rounded-full px-3 py-1.5 disabled:opacity-50 transition-all"
                    style={{ fontFamily: 'var(--font-outfit)' }}
                  >
                    {addingRole === s.role ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    {atFreeLimit ? 'Unlock' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>

        {/* Suggestions + ATS Mapping Terms */}
        <div className="space-y-4">
          <div className="bg-white border border-black/[0.08] rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
            <div className="flex items-center gap-3 mb-6">
              <Lightbulb className="w-5 h-5 text-[#16a34a]" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>Suggestions</h2>
            </div>

            {!hasResume ? (
              <p className="text-xs text-black/45 font-medium">Upload a resume to get improvement suggestions.</p>
            ) : cvs.length === 0 ? (
              <div className="bg-black/[0.02] border border-dashed border-black/[0.14] rounded-2xl p-6 text-center">
                <Lightbulb className="w-8 h-8 text-black/25 mx-auto mb-3" />
                <p className="text-xs text-black/45 font-medium">Create a custom CV to see improvement suggestions.</p>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="bg-black/[0.02] border border-dashed border-black/[0.14] rounded-2xl p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-[#16a34a]/40 mx-auto mb-3" />
                <p className="text-xs text-black/45 font-medium">All checks are passing across your CVs. Nice work!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s) => (
                  <div key={s.check} className="flex items-start gap-3 bg-black/[0.02] border border-black/[0.08] rounded-xl p-4">
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>{s.check}</p>
                      <p className="text-[10px] text-black/50 mt-0.5">{s.message}</p>
                    </div>
                    {s.count > 1 && (
                      <span className="text-[9px] font-bold text-black/45 bg-black/[0.04] border border-black/[0.08] rounded-full px-2 py-0.5 shrink-0" style={{ fontFamily: 'var(--font-outfit)' }}>
                        {s.count} CVs
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-black/[0.08] rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
            <div className="flex items-center gap-3 mb-6">
              <Target className="w-5 h-5 text-[#16a34a]" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>ATS Mapping Terms</h2>
            </div>

            {keywordPanels.length === 0 ? (
              <div className="bg-black/[0.02] border border-dashed border-black/[0.14] rounded-2xl p-6 text-center">
                <Target className="w-8 h-8 text-black/25 mx-auto mb-3" />
                <p className="text-xs text-black/45 font-medium">Set a target role on a CV to see the ATS keywords it&apos;s matched against.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {keywordPanels.map((p) => (
                  <div key={p.cvId}>
                    <p className="text-[10px] font-bold text-black/45 uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-outfit)' }}>
                      {p.label} <span className="text-black/20">·</span> {p.targetRole}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.matched.map((k) => (
                        <span key={k} className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#16a34a]/25 bg-[#16a34a]/10 text-[#16a34a]">
                          {k}
                        </span>
                      ))}
                      {p.missing.map((k) => (
                        <span key={k} className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-black/[0.10] bg-black/[0.02] text-black/40">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
        </div>
      </div>

      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
    </main>
  );
}
