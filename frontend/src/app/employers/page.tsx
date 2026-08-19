'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, CheckCircle2, ShieldCheck, Users, Mail, LayoutDashboard } from 'lucide-react';
import {
  Reveal,
  Spotlight,
  ArrowChevron,
  BrandMark,
  TAG_CLS,
} from '@/components/ui/landing-kit';

const INDIGO = '#4f46e5';

const B2B_FEATURES = [
  { icon: Building2, n: '01', t: 'Direct job posting', d: 'Post roles and manage the whole pipeline from one dashboard no third-party listing needed.' },
  { icon: CheckCircle2, n: '02', t: 'First-round screening interview', d: 'Every applicant clears a screening interview before you see them, filtering for genuine intent.' },
  { icon: ShieldCheck, n: '03', t: 'Proctored assessments', d: 'Skill checks run under proctoring, so a test score reflects the candidate, not a search engine.' },
  { icon: Users, n: '04', t: 'Direct candidate pool', d: 'Recruit from active, job-seeking candidates already building profiles on Kaamlee.' },
  { icon: LayoutDashboard, n: '05', t: 'Company admin portal', d: 'A dedicated portal for company admins to manage job posts, screening pipelines, assessments and your hiring team, all in one place.' },
];

export default function EmployersComingSoonPage() {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const subject = encodeURIComponent(`Employer early access - ${companyName || 'Kaamlee for Business'}`);
    const body = encodeURIComponent(
      `Company: ${companyName || ' '}\nWork email: ${email}\n\nPlease notify us when Kaamlee for Business launches.`
    );
    window.location.href = `mailto:kaamlee2026@gmail.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <div
      className="min-h-screen overflow-x-clip bg-[#f2f3f5] text-[16px] leading-[1.55] tracking-[-0.01em] text-[#0b0b0c] antialiased selection:bg-[#4f46e5] selection:text-white"
      style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
    >
      <header className="mx-auto flex w-[min(1400px,calc(100%-40px))] items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={34} />
          <span className="text-[16px] font-medium tracking-[-0.02em]">Kaamlee</span>
        </Link>
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-full border border-black/[0.10] bg-white px-4 py-2 text-[13.5px] font-medium text-[#3d3d3d] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] transition-all hover:-translate-y-0.5 hover:text-[#0b0b0c]"
        >
          <ArrowLeft size={14} className="transition-transform duration-300 group-hover:-translate-x-1" />
          Back to home
        </Link>
      </header>

      <main className="pb-20">
        {/* ============ HERO ============ */}
        <section className="pt-6 pb-16">
          <div className="mx-auto w-[min(1400px,calc(100%-40px))] overflow-hidden rounded-[34px] border border-black/[0.08] bg-white px-6 py-12 sm:px-10 sm:py-16">
            <div className="flex flex-wrap items-end justify-between gap-8">
              <div className="max-w-[640px]">
                <Reveal>
                  <span
                    className="inline-flex items-center gap-2.5 rounded-full border border-dashed border-[#4f46e5]/35 bg-[#4f46e5]/5 py-2 pl-3 pr-4 text-[13.5px] font-medium"
                    style={{ color: INDIGO }}
                  >
                    <i className="h-[7px] w-[7px] rounded-full bg-[#4f46e5] animate-pulse" />
                    Coming soon for employers
                  </span>
                </Reveal>
                <Reveal delay={80}>
                  <h1 className="mt-5 text-[34px] tracking-[-0.035em] sm:text-[42px]">
                    Hire from the pool your candidates are already in
                  </h1>
                </Reveal>
                <Reveal delay={160}>
                  <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-[rgba(61,61,61,0.72)]">
                    Employers post roles directly into Kaamlee and recruit from the same candidate base that&apos;s already searching, matching, and tracking applications on the platform no separate job board required.
                  </p>
                </Reveal>
              </div>
              <Reveal type="right" delay={160}>
                <div className="rounded-[18px] border border-black/[0.08] bg-white px-6 py-4 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
                  <div className="text-[26px] font-medium tracking-[-0.02em]">2</div>
                  <div className="mt-0.5 max-w-[22ch] text-[12.5px] text-[rgba(61,61,61,0.72)]">screening steps before a candidate reaches your desk</div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ============ UPCOMING FEATURES ============ */}
        <section className="pb-16">
          <div className="mx-auto w-[min(1400px,calc(100%-40px))]">
            <div className="mx-auto flex flex-col items-center gap-4.5 text-center">
              <Reveal><span className={TAG_CLS}><i className="h-[7px] w-[7px] rounded-full bg-[#16a34a] animate-pulse" />What&apos;s coming</span></Reveal>
              <Reveal delay={80}><h2 className="text-[30px] tracking-[-0.035em]">Built for teams hiring early-career and campus talent</h2></Reveal>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
              {B2B_FEATURES.map((s, n) => (
                <Reveal key={s.t} delay={(n % 4) * 90}>
                  <Spotlight className="h-full overflow-hidden rounded-[26px] border border-black/[0.08] bg-white p-6 transition-all duration-450 hover:-translate-y-1.5 hover:border-[#4f46e5]/25 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]">
                    <span className="relative text-[13px] font-medium tracking-[0.06em]" style={{ color: INDIGO }}>{s.n}</span>
                    <span className="relative mt-4 grid h-11 w-11 place-items-center rounded-[13px] border border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]" style={{ color: INDIGO }}>
                      <s.icon size={19} strokeWidth={1.7} />
                    </span>
                    <h3 className="relative mt-4 text-[16.5px] tracking-[-0.02em]">{s.t}</h3>
                    <p className="relative mt-2 text-[13.5px] text-[rgba(61,61,61,0.72)]">{s.d}</p>
                  </Spotlight>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============ SIGNUP ============ */}
        <section className="pb-4">
          <div className="mx-auto w-[min(1400px,calc(100%-40px))]">
            <Reveal type="scale">
              <div
                className="overflow-hidden rounded-[34px] px-6 py-12 text-center sm:px-10 sm:py-16"
                style={{ background: 'linear-gradient(180deg,#4338ca,#3730a3 55%,#312e81)' }}
              >
                <h2 className="mx-auto max-w-[26ch] text-[28px] tracking-[-0.035em] text-white sm:text-[32px]">
                  Be first in line when Kaamlee for Business launches
                </h2>
                <p className="mx-auto mt-3 max-w-[52ch] text-[15px] leading-relaxed text-white/70">
                  Leave your work email and we&apos;ll reach out the moment employer accounts open up.
                </p>

                {submitted ? (
                  <div className="mx-auto mt-8 flex max-w-[440px] items-center justify-center gap-2.5 rounded-full border border-white/15 bg-white/10 px-6 py-3.5 text-[14.5px] font-medium text-white">
                    <CheckCircle2 size={17} />
                    Thanks, opening your email client to confirm.
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mx-auto mt-8 flex max-w-[560px] flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Company name"
                      className="w-full flex-1 rounded-full border border-white/15 bg-white/10 px-5 py-3.5 text-[14.5px] text-white placeholder:text-white/45 outline-none transition-colors focus:border-white/35 focus:bg-white/[0.14]"
                    />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Work email"
                      className="w-full flex-1 rounded-full border border-white/15 bg-white/10 px-5 py-3.5 text-[14.5px] text-white placeholder:text-white/45 outline-none transition-colors focus:border-white/35 focus:bg-white/[0.14]"
                    />
                    <button
                      type="submit"
                      className="group inline-flex flex-none items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3.5 text-[14.5px] font-medium text-[#3730a3] transition-transform duration-300 hover:-translate-y-0.5"
                    >
                      <Mail size={15} />
                      Notify me
                      <ArrowChevron className="text-[#3730a3]" />
                    </button>
                  </form>
                )}
              </div>
            </Reveal>
          </div>
        </section>
      </main>
    </div>
  );
}
