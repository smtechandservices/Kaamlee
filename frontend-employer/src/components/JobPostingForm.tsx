'use client';

import React, { useEffect, useState } from 'react';
import { Plus, X, Loader2, Save } from 'lucide-react';
import {
  EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, FIELD_TYPES,
  type FormField, type ScreeningQuestion, type JobPosting,
} from '@/lib/hiring-types';

export interface JobPostingFormValues {
  title: string;
  description: string;
  employment_type: JobPosting['employment_type'];
  experience_level: JobPosting['experience_level'];
  category: string;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  city: string;
  state: string;
  country: string;
  latitude: string;
  longitude: string;
  is_remote: boolean;
  screening_questions: ScreeningQuestion[];
  application_form_schema: FormField[];
}

export const EMPTY_JOB_FORM: JobPostingFormValues = {
  title: '',
  description: '',
  employment_type: 'full_time',
  experience_level: 'mid',
  category: 'Other',
  salary_min: '',
  salary_max: '',
  salary_currency: 'INR',
  city: '',
  state: '',
  country: '',
  latitude: '',
  longitude: '',
  is_remote: false,
  screening_questions: [],
  application_form_schema: [],
};

function slugify(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
}

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

export default function JobPostingForm({
  value, onChange, onSubmit, submitLabel, saving, error,
}: {
  value: JobPostingFormValues;
  onChange: (next: JobPostingFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  saving: boolean;
  error: string;
}) {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/categories/`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => Array.isArray(data) && setCategories(data))
      .catch(() => {});
  }, []);

  const set = <K extends keyof JobPostingFormValues>(key: K, val: JobPostingFormValues[K]) =>
    onChange({ ...value, [key]: val });

  const addQuestion = () =>
    set('screening_questions', [...value.screening_questions, { id: `q${value.screening_questions.length + 1}`, question: '' }]);

  const updateQuestion = (i: number, question: string) => {
    const next = [...value.screening_questions];
    next[i] = { ...next[i], question };
    set('screening_questions', next);
  };

  const removeQuestion = (i: number) =>
    set('screening_questions', value.screening_questions.filter((_, idx) => idx !== i));

  const addField = () =>
    set('application_form_schema', [...value.application_form_schema, { key: 'field', label: '', type: 'text', required: false }]);

  const updateField = (i: number, patch: Partial<FormField>) => {
    const next = [...value.application_form_schema];
    const merged = { ...next[i], ...patch };
    if (patch.label !== undefined) merged.key = slugify(patch.label);
    next[i] = merged;
    set('application_form_schema', next);
  };

  const removeField = (i: number) =>
    set('application_form_schema', value.application_form_schema.filter((_, idx) => idx !== i));

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
      )}

      <div className="bg-white border border-black/[0.08] rounded-3xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-4">Role details</h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Title</label>
            <input
              type="text" required value={value.title} onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Description</label>
            <textarea
              required rows={6} value={value.description} onChange={(e) => set('description', e.target.value)}
              placeholder="Responsibilities, requirements, benefits..."
              className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Employment type</label>
              <select value={value.employment_type} onChange={(e) => set('employment_type', e.target.value as JobPostingFormValues['employment_type'])}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all cursor-pointer">
                {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Experience level</label>
              <select value={value.experience_level} onChange={(e) => set('experience_level', e.target.value as JobPostingFormValues['experience_level'])}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all cursor-pointer">
                {EXPERIENCE_LEVELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Category</label>
              <select value={value.category} onChange={(e) => set('category', e.target.value)}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all cursor-pointer">
                {categories.length === 0 && <option value={value.category}>{value.category}</option>}
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Salary min</label>
              <input type="number" min={0} value={value.salary_min} onChange={(e) => set('salary_min', e.target.value)}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Salary max</label>
              <input type="number" min={0} value={value.salary_max} onChange={(e) => set('salary_max', e.target.value)}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Currency</label>
              <input type="text" value={value.salary_currency} onChange={(e) => set('salary_currency', e.target.value)}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">City</label>
              <input type="text" value={value.city} onChange={(e) => set('city', e.target.value)}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">State</label>
              <input type="text" value={value.state} onChange={(e) => set('state', e.target.value)}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Country</label>
              <input type="text" value={value.country} onChange={(e) => set('country', e.target.value)}
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Latitude</label>
              <input type="number" step="any" value={value.latitude} onChange={(e) => set('latitude', e.target.value)}
                placeholder="e.g. 12.9716"
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Longitude</label>
              <input type="number" step="any" value={value.longitude} onChange={(e) => set('longitude', e.target.value)}
                placeholder="e.g. 77.5946"
                className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all" />
            </div>
          </div>
          <p className="text-xs text-[#0b0b0c]/45 -mt-2">Coordinates place this posting on the candidate map — optional, but pins only show for postings that set them.</p>

          <label className="flex items-center gap-2.5 cursor-pointer w-fit">
            <input type="checkbox" checked={value.is_remote} onChange={(e) => set('is_remote', e.target.checked)}
              className="w-4 h-4 accent-purple-600 cursor-pointer" />
            <span className="text-sm text-[#0b0b0c]/70">Remote-friendly</span>
          </label>
        </div>
      </div>

      <div className="bg-white border border-black/[0.08] rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#0b0b0c]/60">Screening questions</h2>
          <button type="button" onClick={addQuestion}
            className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-500">
            <Plus size={14} /> Add question
          </button>
        </div>
        <p className="text-xs text-[#0b0b0c]/50 mb-4">Candidates answer these as text when they apply.</p>
        <div className="flex flex-col gap-2.5">
          {value.screening_questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text" required value={q.question} onChange={(e) => updateQuestion(i, e.target.value)}
                placeholder={`Question ${i + 1}`}
                className="flex-1 bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all"
              />
              <button type="button" onClick={() => removeQuestion(i)}
                className="cursor-pointer shrink-0 p-2.5 rounded-xl text-[#0b0b0c]/40 hover:text-red-500 hover:bg-red-500/5 transition-all">
                <X size={16} />
              </button>
            </div>
          ))}
          {value.screening_questions.length === 0 && (
            <p className="text-xs text-[#0b0b0c]/40">No screening questions yet.</p>
          )}
        </div>
      </div>

      <div className="bg-white border border-black/[0.08] rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#0b0b0c]/60">Application form fields</h2>
          <button type="button" onClick={addField}
            className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-500">
            <Plus size={14} /> Add field
          </button>
        </div>
        <p className="text-xs text-[#0b0b0c]/50 mb-4">Extra fields shown on the application form, beyond CV and screening questions.</p>
        <div className="flex flex-col gap-2.5">
          {value.application_form_schema.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text" required value={f.label} onChange={(e) => updateField(i, { label: e.target.value })}
                placeholder="Field label, e.g. Portfolio link"
                className="flex-1 bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all"
              />
              <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as FormField['type'] })}
                className="bg-black/[0.03] border border-black/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-600 transition-all cursor-pointer">
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <label className="flex items-center gap-1.5 shrink-0 text-xs text-[#0b0b0c]/60 cursor-pointer">
                <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })}
                  className="w-3.5 h-3.5 accent-purple-600 cursor-pointer" />
                Required
              </label>
              <button type="button" onClick={() => removeField(i)}
                className="cursor-pointer shrink-0 p-2.5 rounded-xl text-[#0b0b0c]/40 hover:text-red-500 hover:bg-red-500/5 transition-all">
                <X size={16} />
              </button>
            </div>
          ))}
          {value.application_form_schema.length === 0 && (
            <p className="text-xs text-[#0b0b0c]/40">No extra fields — candidates will just answer screening questions and attach a CV.</p>
          )}
        </div>
      </div>

      <button type="submit" disabled={saving}
        className="cursor-pointer inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {submitLabel}
      </button>
    </form>
  );
}
