'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, X, Plus, Trash2, Save, Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import type { PortfolioData, ResumeParsed } from './types';
import ClassicTemplate from './templates/ClassicTemplate';
import BentoTemplate from './templates/BentoTemplate';
import type { TemplateProps } from './templates/ClassicTemplate';

// ─── Template registry ────────────────────────────────────────────────────────────
// To add a new template: create templates/YourTemplate.tsx and add one line here.
const REGISTRY: Record<string, React.ComponentType<TemplateProps>> = {
  classic: ClassicTemplate,
  bento:   BentoTemplate,
};

// ─── Edit panel ───────────────────────────────────────────────────────────────────
const inputCls = "w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#444] transition-colors resize-none";

function TagInput({ value, onChange, placeholder }: {
  value: string[]; onChange: (items: string[]) => void; placeholder?: string;
}) {
  const [raw, setRaw] = useState(() => value.join(', '));
  const joined = value.join(',');
  useEffect(() => { setRaw(value.join(', ')); }, [joined]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input className={inputCls} placeholder={placeholder} value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={() => onChange(raw.split(',').map(x => x.trim()).filter(Boolean))} />
  );
}

function EditPanel({ draft, setDraft, onSave, onClose, saving, saved, saveError }: {
  draft: ResumeParsed; setDraft: (r: ResumeParsed) => void;
  onSave: () => void; onClose: () => void; saving: boolean; saved: boolean; saveError: string | null;
}) {
  const set = (field: keyof ResumeParsed, value: unknown) => setDraft({ ...draft, [field]: value });
  const [open, setOpen] = useState('basics');
  const toggle = (s: string) => setOpen(v => v === s ? '' : s);

  const AH = ({ id, label }: { id: string; label: string }) => (
    <button onClick={() => toggle(id)}
      className="w-full flex items-center justify-between py-3 px-4 rounded-xl text-sm font-bold text-white hover:bg-white/5 transition-colors">
      {label}
      {open === id ? <ChevronUp className="w-4 h-4 text-[#555]" /> : <ChevronDown className="w-4 h-4 text-[#555]" />}
    </button>
  );

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      className="fixed top-0 right-0 h-full w-full md:w-[480px] z-[100] flex flex-col"
      style={{ background: '#0a0a0a', borderLeft: '1px solid #1f1f1f' }}>

      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1f1f] shrink-0">
        <p className="text-sm font-black uppercase tracking-widest text-white">Edit Portfolio</p>
        <div className="flex items-center gap-2">
          {saveError && <span className="text-xs text-red-500 font-medium">{saveError}</span>}
          {saved && <span className="flex items-center gap-1.5 text-xs text-green-500 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Saved</span>}
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-[#ededed] disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
          </button>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
            <X className="w-4 h-4 text-[#555]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1">

        <AH id="basics" label="Basics" />
        {open === 'basics' && (
          <div className="px-4 pb-4 space-y-3">
            {(['name', 'role'] as const).map(f => (
              <div key={f}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#555] mb-1">{f === 'name' ? 'Full Name' : 'Role / Title'}</p>
                <input className={inputCls} value={(draft[f] as string) || ''} onChange={e => set(f, e.target.value)} />
              </div>
            ))}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#555] mb-1">Summary</p>
              <textarea rows={4} className={inputCls} value={draft.summary || ''} onChange={e => set('summary', e.target.value)} />
            </div>
          </div>
        )}

        <AH id="skills" label="Skills" />
        {open === 'skills' && (
          <div className="px-4 pb-4 space-y-4">
            {draft.skills?.map((g, i) => (
              <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <div className="flex items-center gap-2">
                  <input className={inputCls} placeholder="Category (e.g. Languages)" value={g.category}
                    onChange={e => { const s = [...draft.skills]; s[i] = { ...s[i], category: e.target.value }; set('skills', s); }} />
                  <button onClick={() => set('skills', draft.skills.filter((_, j) => j !== i))}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-red-500/10 text-[#444] hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <TagInput value={g.items} placeholder="Python, JavaScript, Go (comma-separated)"
                  onChange={items => { const s = [...draft.skills]; s[i] = { ...s[i], items }; set('skills', s); }} />
              </div>
            ))}
            <button onClick={() => set('skills', [...(draft.skills || []), { category: '', items: [] }])}
              className="flex items-center gap-2 text-xs text-[#555] hover:text-white transition-colors py-1">
              <Plus className="w-3.5 h-3.5" /> Add skill group
            </button>
          </div>
        )}

        <AH id="experience" label="Experience" />
        {open === 'experience' && (
          <div className="px-4 pb-4 space-y-4">
            {draft.experience?.map((e, i) => (
              <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-[#555] flex-1 truncate">{e.company || `Entry ${i + 1}`}</p>
                  <button onClick={() => set('experience', draft.experience.filter((_, j) => j !== i))}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-red-500/10 text-[#444] hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {(['company', 'location', 'period', 'role'] as const).map(field => (
                  <input key={field} className={inputCls} placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                    value={e[field]} onChange={ev => { const s = [...draft.experience]; s[i] = { ...s[i], [field]: ev.target.value }; set('experience', s); }} />
                ))}
                <textarea rows={3} className={inputCls} placeholder="Bullet points (one per line)" value={e.bullets?.join('\n')}
                  onChange={ev => { const s = [...draft.experience]; s[i] = { ...s[i], bullets: ev.target.value.split('\n').filter(Boolean) }; set('experience', s); }} />
              </div>
            ))}
            <button onClick={() => set('experience', [...(draft.experience || []), { company: '', location: '', period: '', role: '', bullets: [] }])}
              className="flex items-center gap-2 text-xs text-[#555] hover:text-white transition-colors py-1">
              <Plus className="w-3.5 h-3.5" /> Add entry
            </button>
          </div>
        )}

        <AH id="projects" label="Projects" />
        {open === 'projects' && (
          <div className="px-4 pb-4 space-y-4">
            {draft.projects?.map((p, i) => (
              <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-[#555] flex-1 truncate">{p.name || `Project ${i + 1}`}</p>
                  <button onClick={() => set('projects', draft.projects.filter((_, j) => j !== i))}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-red-500/10 text-[#444] hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input className={inputCls} placeholder="Project name" value={p.name}
                  onChange={ev => { const s = [...draft.projects]; s[i] = { ...s[i], name: ev.target.value }; set('projects', s); }} />
                <textarea rows={2} className={inputCls} placeholder="Description" value={p.description}
                  onChange={ev => { const s = [...draft.projects]; s[i] = { ...s[i], description: ev.target.value }; set('projects', s); }} />
                <TagInput value={p.tech ?? []} placeholder="React, Node.js, PostgreSQL (comma-separated)"
                  onChange={tech => { const s = [...draft.projects]; s[i] = { ...s[i], tech }; set('projects', s); }} />
                <textarea rows={2} className={inputCls} placeholder="Bullet points (one per line)" value={p.bullets?.join('\n')}
                  onChange={ev => { const s = [...draft.projects]; s[i] = { ...s[i], bullets: ev.target.value.split('\n').filter(Boolean) }; set('projects', s); }} />
                <input className={inputCls} placeholder="URL (optional)" value={p.url}
                  onChange={ev => { const s = [...draft.projects]; s[i] = { ...s[i], url: ev.target.value }; set('projects', s); }} />
              </div>
            ))}
            <button onClick={() => set('projects', [...(draft.projects || []), { name: '', description: '', tech: [], bullets: [], url: '' }])}
              className="flex items-center gap-2 text-xs text-[#555] hover:text-white transition-colors py-1">
              <Plus className="w-3.5 h-3.5" /> Add project
            </button>
          </div>
        )}

        <AH id="education" label="Education" />
        {open === 'education' && (
          <div className="px-4 pb-4 space-y-4">
            {draft.education?.map((e, i) => (
              <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-[#555] flex-1 truncate">{e.institution || `Entry ${i + 1}`}</p>
                  <button onClick={() => set('education', draft.education.filter((_, j) => j !== i))}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-red-500/10 text-[#444] hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {(['institution', 'degree', 'period', 'location'] as const).map(field => (
                  <input key={field} className={inputCls} placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                    value={e[field]} onChange={ev => { const s = [...draft.education]; s[i] = { ...s[i], [field]: ev.target.value }; set('education', s); }} />
                ))}
              </div>
            ))}
            <button onClick={() => set('education', [...(draft.education || []), { institution: '', degree: '', period: '', location: '' }])}
              className="flex items-center gap-2 text-xs text-[#555] hover:text-white transition-colors py-1">
              <Plus className="w-3.5 h-3.5" /> Add entry
            </button>
          </div>
        )}

        <AH id="certs" label="Certifications & Achievements" />
        {open === 'certs' && (
          <div className="px-4 pb-4 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#555]">Certifications</p>
            {draft.certifications?.map((c, i) => (
              <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <div className="flex items-center gap-2">
                  <input className={inputCls} placeholder="Certification name" value={c.name}
                    onChange={ev => { const s = [...draft.certifications]; s[i] = { ...s[i], name: ev.target.value }; set('certifications', s); }} />
                  <button onClick={() => set('certifications', draft.certifications.filter((_, j) => j !== i))}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-red-500/10 text-[#444] hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input className={inputCls} placeholder="Issuer" value={c.issuer}
                  onChange={ev => { const s = [...draft.certifications]; s[i] = { ...s[i], issuer: ev.target.value }; set('certifications', s); }} />
                <input className={inputCls} placeholder="Date" value={c.date}
                  onChange={ev => { const s = [...draft.certifications]; s[i] = { ...s[i], date: ev.target.value }; set('certifications', s); }} />
              </div>
            ))}
            <button onClick={() => set('certifications', [...(draft.certifications || []), { name: '', issuer: '', date: '' }])}
              className="flex items-center gap-2 text-xs text-[#555] hover:text-white transition-colors py-1">
              <Plus className="w-3.5 h-3.5" /> Add certification
            </button>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#555] mt-4">Achievements</p>
            {draft.achievements?.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <input className={inputCls} value={a}
                  onChange={ev => { const s = [...draft.achievements]; s[i] = ev.target.value; set('achievements', s); }} />
                <button onClick={() => set('achievements', draft.achievements.filter((_, j) => j !== i))}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-red-500/10 text-[#444] hover:text-red-500 transition-colors mt-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button onClick={() => set('achievements', [...(draft.achievements || []), ''])}
              className="flex items-center gap-2 text-xs text-[#555] hover:text-white transition-colors py-1">
              <Plus className="w-3.5 h-3.5" /> Add achievement
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Switcher (main export) ───────────────────────────────────────────────────────
export default function PortfolioTemplate({ data, forceOwner }: { data: PortfolioData; forceOwner?: boolean }) {
  const router = useRouter();
  const [r, setR] = useState<ResumeParsed>(data.resume_parsed ?? ({} as ResumeParsed));
  // forceOwner: set by OwnerPreviewGate once it has already proven — via an
  // authenticated re-fetch — that the viewer owns this portfolio, so the
  // edit affordances show up without needing the ?edit=1 preview link.
  const [isOwner, setIsOwner] = useState(!!forceOwner);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<ResumeParsed>(r);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') !== '1') return;

    const stripEditParam = () => router.replace(window.location.pathname, { scroll: false });

    const token = localStorage.getItem('kaamlee_edit_token') || sessionStorage.getItem('kaamlee_token');
    localStorage.removeItem('kaamlee_edit_token');
    if (!token) { stripEditParam(); return; }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${apiUrl}/api/user/`, { headers: { Authorization: `Token ${token}` } })
      .then(res => res.ok ? res.json() : null)
      .then(u => {
        if (u?.username === data.username) { setIsOwner(true); setAuthToken(token); setEditOpen(true); }
        else { stripEditParam(); }
      }).catch(() => stripEditParam());
  }, [data.username, router]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const token = authToken || sessionStorage.getItem('kaamlee_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/portfolio/content/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
        body: JSON.stringify({ resume_parsed: draft }),
      });
      if (res.ok) {
        setR(draft); setSaved(true); setTimeout(() => setSaved(false), 3000);
      } else {
        setSaveError('Failed to save. Please try again.');
      }
    } catch {
      setSaveError('Failed to save. Check your connection and try again.');
    } finally { setSaving(false); }
  }, [draft, authToken]);

  const Template = REGISTRY[data.template] ?? REGISTRY.classic;

  return (
    <>
      <Template r={r} username={data.username} theme={data.theme} />

      {/* Edit FAB — only on preview, only for owner */}
      {isOwner && !editOpen && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
          onClick={() => { setDraft(r); setEditOpen(true); }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all"
          style={{ background: '#ffffff', color: '#000000' }}>
          <Pencil className="w-4 h-4" /> Edit Portfolio
        </motion.button>
      )}

      <AnimatePresence>
        {editOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm"
              onClick={() => setEditOpen(false)} />
            <EditPanel draft={draft} setDraft={setDraft}
              onSave={handleSave} onClose={() => setEditOpen(false)}
              saving={saving} saved={saved} saveError={saveError} />
          </>
        )}
      </AnimatePresence>
    </>
  );
}
