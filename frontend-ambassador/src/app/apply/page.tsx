'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, Loader2, UploadCloud, ArrowLeft } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kaamlee.in';
const MAX_FILE_MB = 5;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const CURRENT_YEAR = new Date().getFullYear();

const BrandMark = ({ size = 30 }: { size?: number }) => (
  <span
    className="grid flex-none place-items-center overflow-hidden rounded-[11px] border border-black/[0.08] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]"
    style={{ width: size, height: size }}
  >
    <Image src="/logo.png" alt="Kaamlee" width={size} height={size} className="h-full w-full object-cover" />
  </span>
);

const inputClass = 'w-full rounded-[14px] border border-black/[0.10] bg-white px-4 py-3.5 text-[14.5px] outline-none transition-all placeholder:text-black/35 focus:border-[#16a34a] focus:shadow-[0_0_0_4px_rgba(22,163,74,.12)]';
const labelClass = 'mb-2 block text-[13px] font-semibold text-black/55';

type FormState = {
  full_name: string;
  email: string;
  phone: string;
  college_name: string;
  college_city: string;
  college_state: string;
  course: string;
  degree_level: 'undergrad' | 'postgrad';
  graduation_year: string;
};

const INITIAL_FORM: FormState = {
  full_name: '',
  email: '',
  phone: '',
  college_name: '',
  college_city: '',
  college_state: '',
  course: '',
  degree_level: 'undergrad',
  graduation_year: '',
};

const STEPS = [
  { key: 'student', label: 'Student' },
  { key: 'college', label: 'College' },
  { key: 'course', label: 'Course' },
  { key: 'id', label: 'ID card' },
] as const;

function Field({
  id, label, required, error, children,
}: { id: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>{label}{required && <span className="text-[#16a34a]"> *</span>}</label>
      {children}
      {error && <p className="mt-1.5 text-[13px] text-red-600">{error}</p>}
    </div>
  );
}

export default function ApplyPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => { const { [key]: _omit, ...rest } = e; return rest; });
  }

  function validateStep(i: number): boolean {
    const next: Record<string, string> = {};
    if (i === 0) {
      if (!form.full_name.trim()) next.full_name = 'Enter your full name.';
      if (!form.email.trim()) next.email = 'Enter your email.';
      if (!form.phone.trim()) next.phone = 'Enter your phone number.';
    } else if (i === 1) {
      if (!form.college_name.trim()) next.college_name = 'Enter your college or university.';
    } else if (i === 2) {
      if (!form.course.trim()) next.course = 'Enter your course.';
      const year = Number(form.graduation_year);
      if (!form.graduation_year) next.graduation_year = 'Enter your graduation year.';
      else if (!Number.isInteger(year) || year < CURRENT_YEAR || year > CURRENT_YEAR + 8) {
        next.graduation_year = `Enter a year between ${CURRENT_YEAR} and ${CURRENT_YEAR + 8}.`;
      }
    } else if (i === 3) {
      if (!file) next.id_card_image = 'Upload a photo of your student ID card.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    if (f && f.size > MAX_FILE_BYTES) {
      setErrors((prev) => ({ ...prev, id_card_image: `Image is too large — max ${MAX_FILE_MB} MB.` }));
      setFile(null);
      e.target.value = '';
      return;
    }
    setErrors((prev) => { const { id_card_image: _omit, ...rest } = prev; return rest; });
    setFile(f);
  }

  function goNext() {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    if (!validateStep(3)) return;
    setStatus('submitting');

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => formData.append(key, value));
    if (file) formData.append('id_card_image', file);

    try {
      const res = await fetch(`${API_URL}/ambassador/applications/`, { method: 'POST', body: formData });

      if (res.ok) {
        setStatus('success');
        return;
      }

      const data = await res.json().catch(() => ({}));
      const fieldErrors: Record<string, string> = {};
      let backToStep = 3;
      Object.entries(data).forEach(([key, val]) => {
        fieldErrors[key] = Array.isArray(val) ? String(val[0]) : String(val);
        if (['full_name', 'email', 'phone'].includes(key)) backToStep = Math.min(backToStep, 0);
        else if (key === 'college_name') backToStep = Math.min(backToStep, 1);
        else if (['course', 'graduation_year'].includes(key)) backToStep = Math.min(backToStep, 2);
      });
      setErrors(fieldErrors);
      setStep(backToStep);
      setStatus('error');
    } catch {
      setErrors({ detail: 'Could not reach the server. Check your connection and try again.' });
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[#f2f3f5] px-5 text-[#0b0b0c]"
        style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
      >
        <div className="w-full max-w-[480px] rounded-[28px] border border-black/[0.08] bg-white p-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#eafaf0] text-[#16a34a]">
            <CheckCircle2 size={28} />
          </span>
          <h1 className="mt-6 text-[26px] font-semibold tracking-[-0.03em]" style={{ fontFamily: 'var(--font-outfit)' }}>Application received</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-black/55">We&apos;ll review it within a few days. If approved, you&apos;ll get an email with your login details, plus a call on the number you applied with.</p>
          <Link href="/" className="mt-8 inline-flex items-center justify-center rounded-full bg-[#0b0b0c] px-7 py-[13px] text-[14.5px] font-bold text-white" style={{ fontFamily: 'var(--font-outfit)' }}>
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#f2f3f5] px-5 py-14 text-[#0b0b0c] sm:py-20"
      style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
    >
      <div className="mx-auto w-full max-w-5xl">
        <Link href="/" className="flex items-center gap-2.5 text-[16px] font-semibold tracking-[-0.03em]" style={{ fontFamily: 'var(--font-outfit)' }}>
          <BrandMark />
          <span className="uppercase tracking-[0.14em]">Kaamlee</span>
        </Link>

        <Link href="/" className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-semibold text-black/50 transition-colors hover:text-black/80" style={{ fontFamily: 'var(--font-outfit)' }}>
          <ArrowLeft size={15} /> Back to Campus Ambassador
        </Link>

        <h1 className="mt-6 text-[36px] font-medium leading-[1.05] tracking-[-0.035em] sm:text-[44px]" style={{ fontFamily: 'var(--font-outfit)' }}>
          Apply as a Campus Ambassador
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-black/55">
          Four short steps, no resume needed. We&apos;ll verify your college with the ID card photo.
        </p>

        {/* ============ STEP PROGRESS ============ */}
        <div className="mt-9 flex items-center">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`grid h-8 w-8 flex-none place-items-center rounded-full text-[13px] font-bold transition-colors duration-300 ${
                    i < step ? 'bg-[#16a34a] text-white' : i === step ? 'bg-[#0b0b0c] text-white' : 'bg-white text-black/35 border border-black/[0.12]'
                  }`}
                  style={{ fontFamily: 'var(--font-outfit)' }}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`whitespace-nowrap text-[12px] font-medium ${i === step ? 'text-black/70' : 'text-black/35'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 mb-5 h-[2px] flex-1 rounded-full transition-colors duration-300 ${i < step ? 'bg-[#16a34a]' : 'bg-black/[0.10]'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="mt-6 rounded-[28px] border border-black/[0.08] bg-white p-6 sm:p-8">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <Field id="full_name" label="Full name" required error={errors.full_name}>
                <input id="full_name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className={inputClass} placeholder="Aditi Kumar" />
              </Field>
              <Field id="email" label="Email" required error={errors.email}>
                <input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputClass} placeholder="you@college.edu" />
              </Field>
              <Field id="phone" label="Phone" required error={errors.phone}>
                <input id="phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputClass} placeholder="98765 43210" />
                <p className="mt-1.5 text-[12.5px] text-black/40">We&apos;ll use this number to contact you, including a call if your application is approved.</p>
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-5">
              <Field id="college_name" label="College / university" required error={errors.college_name}>
                <input id="college_name" value={form.college_name} onChange={(e) => set('college_name', e.target.value)} className={inputClass} placeholder="VIT Vellore" />
              </Field>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field id="college_city" label="City">
                  <input id="college_city" value={form.college_city} onChange={(e) => set('college_city', e.target.value)} className={inputClass} placeholder="Vellore" />
                </Field>
                <Field id="college_state" label="State">
                  <input id="college_state" value={form.college_state} onChange={(e) => set('college_state', e.target.value)} className={inputClass} placeholder="Tamil Nadu" />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <Field id="course" label="Course" required error={errors.course}>
                <input id="course" value={form.course} onChange={(e) => set('course', e.target.value)} className={inputClass} placeholder="B.Tech Computer Science" />
              </Field>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field id="degree_level" label="Degree level">
                  <select id="degree_level" value={form.degree_level} onChange={(e) => set('degree_level', e.target.value as FormState['degree_level'])} className={inputClass}>
                    <option value="undergrad">Undergraduate</option>
                    <option value="postgrad">Postgraduate</option>
                  </select>
                </Field>
                <Field id="graduation_year" label="Graduation year (batch)" required error={errors.graduation_year}>
                  <input
                    id="graduation_year"
                    type="number"
                    value={form.graduation_year}
                    onChange={(e) => set('graduation_year', e.target.value)}
                    min={CURRENT_YEAR}
                    max={CURRENT_YEAR + 8}
                    className={inputClass}
                    placeholder={String(CURRENT_YEAR + 1)}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-5">
              <Field id="id_card_image" label="Student ID card photo" required error={errors.id_card_image}>
                <label
                  htmlFor="id_card_image"
                  className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-dashed border-black/[0.16] bg-[#fafafa] px-4 py-4 text-[14px] text-black/55 transition-colors hover:border-[#16a34a]/50"
                >
                  <UploadCloud size={18} className="flex-none text-black/35" />
                  <span className="truncate">{file ? `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)` : 'Upload a clear photo of your college ID card'}</span>
                </label>
                <input id="id_card_image" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <p className="mt-1.5 text-[12.5px] text-black/40">JPG or PNG, up to {MAX_FILE_MB} MB.</p>
              </Field>
            </div>
          )}

          {errors.detail && (
            <p className="mt-5 rounded-[12px] bg-red-50 px-4 py-3 text-[13.5px] text-red-700">{errors.detail}</p>
          )}

          <div className="mt-8 flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.10] px-6 py-[13px] text-[14.5px] font-semibold text-black/60 transition-colors hover:border-black/25 hover:text-black"
                style={{ fontFamily: 'var(--font-outfit)' }}
              >
                <ArrowLeft size={15} /> Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="ml-auto flex-1 rounded-full bg-[#0b0b0c] py-[15px] text-[15px] font-bold text-white transition-transform duration-300 hover:-translate-y-0.5"
                style={{ fontFamily: 'var(--font-outfit)' }}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={status === 'submitting'}
                className="ml-auto flex flex-1 items-center justify-center gap-2 rounded-full bg-[#4ADE80] py-[15px] text-[15px] font-bold text-black transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
                style={{ fontFamily: 'var(--font-outfit)' }}
              >
                {status === 'submitting' ? (<><Loader2 size={17} className="animate-spin" /> Submitting…</>) : 'Submit application'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
