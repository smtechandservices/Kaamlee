'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Save, CheckCircle2, Download, Sparkles, Plus, Trash2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { CustomCV, CVTemplate } from '@/components/customcv/types';
import type { ResumeParsed, ExpEntry, Project, EduEntry, SkillGroup } from '@/components/portfolio/types';
import { CV_TEMPLATE_COMPONENTS } from '@/components/customcv/templates';

const TEMPLATE_LABELS: Record<CVTemplate, string> = {
  modern: 'Modern',
  classic: 'Classic',
  ats: 'ATS Optimized',
};

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

const emptyExp: ExpEntry = { company: '', location: '', period: '', role: '', bullets: [] };
const emptyProject: Project = { name: '', description: '', tech: [], bullets: [], url: '' };
const emptyEdu: EduEntry = { institution: '', degree: '', period: '', location: '' };
const emptySkillGroup: SkillGroup = { category: '', items: [] };

export default function CustomCVEditorPage() {
  const { token, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [cv, setCv] = useState<CustomCV | null>(null);
  const [content, setContent] = useState<ResumeParsed | null>(null);
  const [template, setTemplate] = useState<CVTemplate>('ats');
  const [label, setLabel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [isDownloading, setIsDownloading] = useState<'pdf' | 'docx' | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthLoading && !token) router.push('/login');
  }, [token, isAuthLoading, router]);

  useEffect(() => {
    if (!token || !id) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/custom-cv/${id}/`, {
      headers: { Authorization: `Token ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((d: CustomCV) => {
        setCv(d);
        setContent(d.content);
        setTemplate(d.template);
        setLabel(d.label);
        setTargetRole(d.target_role || '');
      })
      .catch(() => setError('Could not load this CV.'))
      .finally(() => setIsLoading(false));
  }, [token, id]);

  const handleSave = useCallback(async () => {
    if (!content) return;
    setIsSaving(true);
    setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/custom-cv/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
        body: JSON.stringify({ content, template, label }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError('Failed to save changes.');
        return;
      }
      setCv(data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      setError('An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  }, [content, template, label, id, token]);

  const handleTailor = async () => {
    if (!targetRole.trim()) return;
    setIsTailoring(true);
    setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/custom-cv/${id}/tailor/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
        body: JSON.stringify({ target_role: targetRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to retarget CV.');
        return;
      }
      setCv(data);
      setContent(data.content);
    } catch {
      setError('An error occurred while retargeting.');
    } finally {
      setIsTailoring(false);
    }
  };

  const handleDownload = async (type: 'pdf' | 'docx') => {
    setIsDownloading(type);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/custom-cv/${id}/export/?type=${type}`, {
        headers: { Authorization: `Token ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const name = content?.name || 'resume';
      const role = cv?.target_role || content?.role || '';
      const filename = [name, role, 'CV'].filter(Boolean).join('_').replace(/\s+/g, '_');
      a.download = `${filename}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(null);
    }
  };

  if (isAuthLoading || !token || isLoading || !content || !cv) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  const PreviewComponent = CV_TEMPLATE_COMPONENTS[template];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.push('/custom-cv')}
          className="cursor-pointer inline-flex items-center gap-2 text-[#888] hover:text-white transition-colors mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Custom CVs
        </button>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-3 px-5 rounded-2xl mb-4">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left: controls */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1">
            <div className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#555] uppercase tracking-widest ml-1">Label</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5 text-xs focus:border-green-500/50 outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#555] uppercase tracking-widest ml-1">Template</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(TEMPLATE_LABELS) as CVTemplate[]).map((tmpl) => (
                    <button
                      key={tmpl}
                      type="button"
                      onClick={() => setTemplate(tmpl)}
                      className={`cursor-pointer rounded-xl py-2 text-[10px] font-bold border transition-all ${
                        template === tmpl ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-[#222] text-[#888] hover:border-[#333]'
                      }`}
                    >
                      {TEMPLATE_LABELS[tmpl]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="cursor-pointer w-full bg-white text-black font-black uppercase tracking-widest py-3 rounded-xl hover:bg-[#ededed] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
              >
                {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
              {saveSuccess && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-green-400 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </motion.div>
              )}
            </div>

            {/* Retarget for role */}
            <div className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-green-500" />
                <h3 className="text-xs font-black uppercase tracking-widest">Retarget for a Role</h3>
              </div>
              <p className="text-[10px] text-[#555]">
                Rewrite this CV to emphasize skills relevant to a different profession, using your existing experience.
              </p>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Fullstack Developer"
                className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5 text-xs focus:border-green-500/50 outline-none"
              />
              <button
                type="button"
                onClick={handleTailor}
                disabled={isTailoring || !targetRole.trim()}
                className="cursor-pointer w-full bg-green-500 text-black font-black uppercase tracking-widest py-3 rounded-xl hover:bg-green-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
              >
                {isTailoring ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                Retarget CV
              </button>
            </div>

            {/* ATS score */}
            <div className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest">ATS Score</h3>
                <span className={`text-2xl font-black ${scoreColor(cv.ats_score)}`}>{cv.ats_score}</span>
              </div>
              <div className="space-y-1.5">
                {cv.ats_breakdown.map((check, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px]">
                    <span className={check.passed ? 'text-green-400' : 'text-[#555]'}>{check.passed ? '✓' : '✗'}</span>
                    <span className={check.passed ? 'text-[#888]' : 'text-[#666]'}>{check.message}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Downloads */}
            <div className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-widest mb-2">Export</h3>
              <button
                type="button"
                onClick={() => handleDownload('pdf')}
                disabled={isDownloading !== null}
                className="cursor-pointer w-full bg-[#0a0a0a] border border-[#222] hover:border-[#333] font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
              >
                {isDownloading === 'pdf' ? <Loader2 className="animate-spin w-4 h-4" /> : <Download className="w-4 h-4" />}
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => handleDownload('docx')}
                disabled={isDownloading !== null}
                className="cursor-pointer w-full bg-[#0a0a0a] border border-[#222] hover:border-[#333] font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
              >
                {isDownloading === 'docx' ? <Loader2 className="animate-spin w-4 h-4" /> : <Download className="w-4 h-4" />}
                Download DOCX
              </button>
            </div>

            {/* Content editor */}
            <ContentEditor content={content} onChange={setContent} />
          </div>

          {/* Right: live preview */}
          <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 sm:p-8 overflow-x-auto">
            <PreviewComponent r={content} />
          </div>
        </div>
      </div>
    </main>
  );
}

function ContentEditor({ content, onChange }: { content: ResumeParsed; onChange: (c: ResumeParsed) => void }) {
  const set = <K extends keyof ResumeParsed>(key: K, value: ResumeParsed[K]) => {
    onChange({ ...content, [key]: value });
  };

  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl p-5 space-y-5">
      <h3 className="text-xs font-black uppercase tracking-widest">Edit Content</h3>

      <Field label="Name">
        <input className={inputCls} value={content.name || ''} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Role">
        <input className={inputCls} value={content.role || ''} onChange={(e) => set('role', e.target.value)} />
      </Field>
      <Field label="Summary">
        <textarea className={`${inputCls} min-h-[80px]`} value={content.summary || ''} onChange={(e) => set('summary', e.target.value)} />
      </Field>

      <ArraySection
        title="Skills"
        items={content.skills || []}
        onChange={(items) => set('skills', items)}
        empty={emptySkillGroup}
        render={(group, update) => (
          <>
            <input
              className={inputCls}
              placeholder="Category (e.g. Languages)"
              value={group.category}
              onChange={(e) => update({ ...group, category: e.target.value })}
            />
            <textarea
              className={`${inputCls} min-h-[50px] mt-2`}
              placeholder="Comma-separated skills"
              value={(group.items || []).join(', ')}
              onChange={(e) => update({ ...group, items: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
          </>
        )}
      />

      <ArraySection
        title="Experience"
        items={content.experience || []}
        onChange={(items) => set('experience', items)}
        empty={emptyExp}
        render={(exp, update) => (
          <>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder="Role" value={exp.role} onChange={(e) => update({ ...exp, role: e.target.value })} />
              <input className={inputCls} placeholder="Company" value={exp.company} onChange={(e) => update({ ...exp, company: e.target.value })} />
              <input className={inputCls} placeholder="Period" value={exp.period} onChange={(e) => update({ ...exp, period: e.target.value })} />
              <input className={inputCls} placeholder="Location" value={exp.location} onChange={(e) => update({ ...exp, location: e.target.value })} />
            </div>
            <textarea
              className={`${inputCls} min-h-[70px] mt-2`}
              placeholder="One bullet per line"
              value={(exp.bullets || []).join('\n')}
              onChange={(e) => update({ ...exp, bullets: e.target.value.split('\n').filter((b) => b.trim()) })}
            />
          </>
        )}
      />

      <ArraySection
        title="Projects"
        items={content.projects || []}
        onChange={(items) => set('projects', items)}
        empty={emptyProject}
        render={(proj, update) => (
          <>
            <input className={inputCls} placeholder="Project name" value={proj.name} onChange={(e) => update({ ...proj, name: e.target.value })} />
            <input
              className={`${inputCls} mt-2`}
              placeholder="Tech (comma-separated)"
              value={(proj.tech || []).join(', ')}
              onChange={(e) => update({ ...proj, tech: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
            <textarea
              className={`${inputCls} min-h-[70px] mt-2`}
              placeholder="One bullet per line"
              value={(proj.bullets || []).join('\n')}
              onChange={(e) => update({ ...proj, bullets: e.target.value.split('\n').filter((b) => b.trim()) })}
            />
          </>
        )}
      />

      <ArraySection
        title="Education"
        items={content.education || []}
        onChange={(items) => set('education', items)}
        empty={emptyEdu}
        render={(edu, update) => (
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="Degree" value={edu.degree} onChange={(e) => update({ ...edu, degree: e.target.value })} />
            <input className={inputCls} placeholder="Institution" value={edu.institution} onChange={(e) => update({ ...edu, institution: e.target.value })} />
            <input className={inputCls} placeholder="Period" value={edu.period} onChange={(e) => update({ ...edu, period: e.target.value })} />
            <input className={inputCls} placeholder="Location" value={edu.location} onChange={(e) => update({ ...edu, location: e.target.value })} />
          </div>
        )}
      />
    </div>
  );
}

const inputCls = 'w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2 text-xs focus:border-green-500/50 outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-[#555] uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}

function ArraySection<T>({
  title, items, onChange, empty, render,
}: {
  title: string;
  items: T[];
  onChange: (items: T[]) => void;
  empty: T;
  render: (item: T, update: (item: T) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-[#555] uppercase tracking-widest ml-1">{title}</label>
        <button
          type="button"
          onClick={() => onChange([...items, empty])}
          className="cursor-pointer text-green-500 hover:text-green-400"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 relative">
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="cursor-pointer absolute top-2 right-2 text-[#555] hover:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {render(item, (updated) => onChange(items.map((it, j) => (j === i ? updated : it))))}
        </div>
      ))}
    </div>
  );
}
