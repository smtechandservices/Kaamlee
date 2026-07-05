'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Plus, FileText, Trash2, Briefcase } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { CustomCV, CVTemplate } from '@/components/customcv/types';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newTemplate, setNewTemplate] = useState<CVTemplate>('ats');
  const [newTargetRole, setNewTargetRole] = useState('');
  const [error, setError] = useState('');

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
  }, [token]);

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
    <main className="min-h-screen bg-[#0a0a0a] text-white p-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-2xl mx-auto z-10 relative pt-8 sm:pt-12">
        <button
          onClick={() => router.push('/profile')}
          className="cursor-pointer inline-flex items-center gap-2 text-[#888] hover:text-white transition-colors mb-4 group text-sm"
        >
          <ArrowLeft className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          Back to Profile
        </button>

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
      </div>
    </main>
  );
}
