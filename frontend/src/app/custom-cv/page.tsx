'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Plus, FileText, Trash2, Briefcase, Lightbulb, Target, CheckCircle2, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { CustomCV, CVTemplate, ProfessionKeywords } from '@/components/customcv/types';
import Sidebar from '@/components/Sidebar';
import SidebarToggle from '@/components/SidebarToggle';
import Link from 'next/link';

const TEMPLATE_LABELS: Record<CVTemplate, string> = {
  modern: 'Modern',
  classic: 'Classic',
  ats: 'ATS Optimized',
};

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-400 border-green-500/30 bg-green-500/10';
  if (score >= 50) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
  return 'text-red-400 border-red-500/30 bg-red-500/10';
}

export default function CustomCVListPage() {
  const { user, token, isLoading: isAuthLoading } = useAuth();
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

  useEffect(() => {
    if (!isAuthLoading && !token) {
      router.push('/login');
    }
  }, [token, isAuthLoading, router]);

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

  if (isAuthLoading || !token) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  const hasResume = !!user?.resume_text;

  return (
    <main className="h-screen flex bg-[#0a0a0a] text-white overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-[#222] px-4 sm:px-6 flex items-center justify-between glass z-20 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 overflow-hidden">
            <Link href="/profile" className="group flex md:hidden items-center gap-1.5 sm:gap-2 text-[#555] hover:text-white transition-colors mr-1 sm:mr-2 shrink-0">
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] hidden sm:inline">Back</span>
            </Link>
            <div className="w-px h-4 bg-[#222] mr-1 sm:mr-2 shrink-0 md:hidden" />
            <h1 className="hidden sm:inline text-lg sm:text-xl font-black tracking-tighter text-white mr-2 sm:mr-4 cursor-default truncate">KAAMLEE</h1>
          </div>
          <SidebarToggle />
        </header>

        <div className="flex-1 overflow-y-auto p-6 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="mx-auto z-10 relative">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
        <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 md:p-10 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-green-500" />
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Custom CVs</h2>
            </div>
            {hasResume && (
              <button
                type="button"
                onClick={() => setShowNewForm((s) => !s)}
                className="cursor-pointer flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-green-500 hover:text-green-400"
              >
                <Plus className="w-3.5 h-3.5" /> New CV
              </button>
            )}
          </div>

          {!hasResume ? (
            <div className="bg-[#0a0a0a] border border-dashed border-[#333] rounded-2xl p-6 text-center">
              <Briefcase className="w-8 h-8 text-[#444] mx-auto mb-3" />
              <p className="text-xs text-[#555] font-medium">Upload a resume in your profile to create a custom CV.</p>
            </div>
          ) : (
            <>
              {showNewForm && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  onSubmit={handleCreate}
                  className="space-y-4 bg-[#0a0a0a] border border-[#222] rounded-2xl p-5 mb-6"
                >
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-3 px-4 rounded-xl">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#555] uppercase tracking-widest ml-1">Label</label>
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="e.g. Fullstack CV"
                      className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-xs focus:border-green-500/50 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#555] uppercase tracking-widest ml-1">Template</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(TEMPLATE_LABELS) as CVTemplate[]).map((tmpl) => (
                        <button
                          key={tmpl}
                          type="button"
                          onClick={() => setNewTemplate(tmpl)}
                          className={`cursor-pointer rounded-xl py-2.5 text-[11px] font-bold border transition-all ${
                            newTemplate === tmpl ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-[#222] text-[#888] hover:border-[#333]'
                          }`}
                        >
                          {TEMPLATE_LABELS[tmpl]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#555] uppercase tracking-widest ml-1">Target Role (optional)</label>
                    <input
                      type="text"
                      value={newTargetRole}
                      onChange={(e) => setNewTargetRole(e.target.value)}
                      placeholder="e.g. Fullstack Developer"
                      className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-xs focus:border-green-500/50 outline-none transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="cursor-pointer w-full bg-white text-black font-black uppercase tracking-widest py-3 rounded-xl hover:bg-[#ededed] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
                  >
                    {isCreating ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    Create CV
                  </button>
                </motion.form>
              )}

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
                </div>
              ) : cvs.length === 0 ? (
                <div className="bg-[#0a0a0a] border border-dashed border-[#333] rounded-2xl p-6 text-center">
                  <FileText className="w-8 h-8 text-[#444] mx-auto mb-3" />
                  <p className="text-xs text-[#555] font-medium">No custom CVs yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cvs.map((cv) => (
                    <motion.div
                      key={cv.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-[#333] transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/custom-cv/${cv.id}`)}
                        className="cursor-pointer flex-1 text-left"
                      >
                        <p className="text-xs font-black text-white">{cv.label || 'Untitled CV'}</p>
                        <p className="text-[10px] text-[#555] mt-0.5">
                          {TEMPLATE_LABELS[cv.template]}
                          {cv.target_role && ` · ${cv.target_role}`}
                        </p>
                      </button>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${scoreColor(cv.ats_score)}`}>
                        {cv.ats_score} ATS
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(cv.id)}
                        className="cursor-pointer text-[#555] hover:text-red-400 transition-colors p-1"
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
        <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Recommended CVs</h2>
          </div>

          {suggestionError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-3 px-4 rounded-xl mb-4">
              {suggestionError}
            </div>
          )}

          {!hasResume ? (
            <p className="text-xs text-[#555] font-medium">Upload a resume to get CV recommendations.</p>
          ) : suggestedRoles.length === 0 ? (
            <div className="bg-[#0a0a0a] border border-dashed border-[#333] rounded-2xl p-6 text-center">
              <Sparkles className="w-8 h-8 text-[#444] mx-auto mb-3" />
              <p className="text-xs text-[#555] font-medium">
                {cvs.length > 0
                  ? "You've already covered the roles that best match your resume."
                  : 'No strong role matches found yet — try creating a CV manually.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestedRoles.map((s) => (
                <div key={s.role} className="flex items-center justify-between gap-3 bg-[#0a0a0a] border border-[#222] rounded-xl p-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{s.role}</p>
                    <p className="text-[10px] text-[#555] mt-0.5">{s.matchCount}/{s.total} keywords match your resume</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddSuggested(s.role)}
                    disabled={addingRole === s.role}
                    className="cursor-pointer shrink-0 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-green-400 hover:text-green-300 border border-green-500/30 hover:border-green-500/50 bg-green-500/10 rounded-full px-3 py-1.5 disabled:opacity-50 transition-all"
                  >
                    {addingRole === s.role ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>

        {/* Suggestions + ATS Mapping Terms */}
        <div className="space-y-4">
          <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Lightbulb className="w-5 h-5 text-green-500" />
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Suggestions</h2>
            </div>

            {!hasResume ? (
              <p className="text-xs text-[#555] font-medium">Upload a resume to get improvement suggestions.</p>
            ) : cvs.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-dashed border-[#333] rounded-2xl p-6 text-center">
                <Lightbulb className="w-8 h-8 text-[#444] mx-auto mb-3" />
                <p className="text-xs text-[#555] font-medium">Create a custom CV to see improvement suggestions.</p>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-dashed border-[#333] rounded-2xl p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500/40 mx-auto mb-3" />
                <p className="text-xs text-[#555] font-medium">All checks are passing across your CVs. Nice work!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s) => (
                  <div key={s.check} className="flex items-start gap-3 bg-[#0a0a0a] border border-[#222] rounded-xl p-4">
                    <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white">{s.check}</p>
                      <p className="text-[10px] text-[#888] mt-0.5">{s.message}</p>
                    </div>
                    {s.count > 1 && (
                      <span className="text-[9px] font-bold text-[#555] bg-[#161616] border border-[#222] rounded-full px-2 py-0.5 shrink-0">
                        {s.count} CVs
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Target className="w-5 h-5 text-green-500" />
              <h2 className="text-sm font-black uppercase tracking-widest text-white">ATS Mapping Terms</h2>
            </div>

            {keywordPanels.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-dashed border-[#333] rounded-2xl p-6 text-center">
                <Target className="w-8 h-8 text-[#444] mx-auto mb-3" />
                <p className="text-xs text-[#555] font-medium">Set a target role on a CV to see the ATS keywords it&apos;s matched against.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {keywordPanels.map((p) => (
                  <div key={p.cvId}>
                    <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-2">
                      {p.label} <span className="text-[#333]">·</span> {p.targetRole}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.matched.map((k) => (
                        <span key={k} className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-400">
                          {k}
                        </span>
                      ))}
                      {p.missing.map((k) => (
                        <span key={k} className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#333] bg-[#0a0a0a] text-[#555]">
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
    </main>
  );
}
