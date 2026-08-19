'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Megaphone, Users2, FileCheck2, ImageIcon, Menu as MenuIcon, X as XIcon } from 'lucide-react';

const EASE_OUT = 'cubic-bezier(0.16,1,0.3,1)';
const APPLY_HREF = '/apply';
const MAIN_SITE_URL = process.env.NEXT_PUBLIC_KAAMLEE_URL || 'https://kaamlee.in';

/* ============ REVEAL ON SCROLL ============ */
function Reveal({
  children,
  className = '',
  delay = 0,
  type = 'up',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  type?: 'up' | 'left' | 'right';
  as?: any;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hiddenTransform =
    type === 'left' ? 'translateX(-32px)' :
    type === 'right' ? 'translateX(32px)' :
    'translateY(28px)';

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : hiddenTransform,
        filter: inView ? 'blur(0)' : 'blur(9px)',
        transition: `opacity 900ms ${EASE_OUT}, transform 900ms ${EASE_OUT}, filter 900ms ${EASE_OUT}`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </Tag>
  );
}

/* ============ ANIMATED COUNTER ============ */
function Counter({ target, className = '' }: { target: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          const start = performance.now();
          const dur = 1400;
          const tick = (now: number) => {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  return <span ref={ref} className={className}>{val.toLocaleString('en-IN')}</span>;
}

const ArrowChevron = ({ className = '' }: { className?: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 group-hover:translate-x-1 ${className}`}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const BrandMark = ({ size = 38 }: { size?: number }) => (
  <span
    className="grid flex-none place-items-center overflow-hidden rounded-[11px] border border-black/[0.08] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]"
    style={{ width: size, height: size }}
  >
    <Image src="/logo.png" alt="Kaamlee" width={size} height={size} className="h-full w-full object-cover" />
  </span>
);

/* ============ DATA ============ */
const NAV_LINKS: [string, string][] = [['#community', 'Community'], ['#get', 'What you get'], ['#do', 'What you do'], ['#who', 'Who can apply'], ['#stories', 'Stories']];

const CAMPUS_NAMES = ['VIT Vellore', 'NIT Surathkal', 'SRM Chennai', 'BITS Pilani', 'DTU Delhi', 'Manipal', 'Christ Bengaluru', 'Symbiosis Pune'];

const PROGRAM_POINTS = [
  { n: '01', t: 'Host events on campus', d: 'Resume clinics, meetups, or a drive — whatever gets your batch in a room together.' },
  { n: '02', t: 'Market Kaamlee locally', d: 'Spread the word through your own channels — you know your batch better than a national campaign does.' },
  { n: '03', t: 'Per-registration rewards', d: 'Goodies and rewards that scale with how many students from your university you sign up.' },
  { n: '04', t: 'Per-event rewards + certificate', d: 'Extra rewards for every event hosted, plus a certificate for the program.' },
];

const DO_ITEMS = [
  'Share openings in your class groups the day they post.',
  'Put the drive poster up where your batch actually looks.',
  'Host one event a semester — a resume clinic, an alumni AMA or a mock interview night.',
  'Send one short note a month on what your campus needs.',
];

const WHO_CAN_APPLY = [
  { rotate: '-rotate-3', bg: '#34D399', fg: '#04231A', t: 'Enrolled full-time at a college in India' },
  { rotate: 'rotate-2', bg: '#FBCFE8', fg: '#3B0A28', t: 'Comfortable talking to your batch, in any language' },
  { rotate: '-rotate-2', bg: '#4F46E5', fg: '#FFFFFF', t: 'Graduating 2027 or later, undergrad or postgrad' },
  { rotate: 'rotate-3', bg: '#FDE68A', fg: '#3B2A03', t: 'Active in at least one campus group or society' },
];

const TIMELINE = [
  { n: '1', when: '15–30 SEP', t: 'Apply', d: 'Five-minute form. No resume, no cover letter.' },
  { n: '2', when: '2–6 OCT', t: 'Short call', d: '15 minutes on video with the campus team.' },
  { n: '3', when: '10 OCT', t: 'Onboard', d: 'Dashboard, asset kit and referral link go live.' },
  { n: '4', when: 'OCT–MAR', t: 'Run the term', d: 'Six months, stipend monthly, certificate at the end.' },
];

const STORIES = [
  { big: true, q: '"I joined for the stipend and left with a PPO. Running the resume clinic taught me more about hiring than any course I took."', initials: 'AK', bg: '#4ADE80', fg: '#000', name: 'Aditi K.', role: 'VIT Vellore · now Product intern at Kaamlee' },
  { big: false, q: '"400 people from my college signed up. The placement cell now asks me which drives to push."', initials: 'DP', bg: '#FBBF24', fg: '#000', name: 'Dev P.', role: 'NIT Surathkal · Batch 3' },
  { big: false, q: '"Six hours a month, honestly. The asset kit does most of the work for you."', initials: 'NB', bg: '#FF4D2E', fg: '#fff', name: 'Nikhil B.', role: 'SRM Chennai · Batch 3' },
];

const HERO_PANELS = [
  { icon: Users2, label: 'Campus meetups', bg: '#eafaf0', fg: '#16a34a' },
  { icon: Megaphone, label: 'Drive announcements', bg: '#f3eeff', fg: '#7c4dff' },
  { icon: FileCheck2, label: 'Resume clinics', bg: '#fff7e0', fg: '#c08a12' },
  { icon: ImageIcon, label: 'Poster on notice board', bg: '#eef2ff', fg: '#4f46e5' },
];

export default function AmbassadorPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <main
      className="min-h-screen overflow-x-clip bg-[#f2f3f5] text-[16px] leading-[1.55] tracking-[-0.01em] text-[#0b0b0c] antialiased selection:bg-[#16a34a] selection:text-white"
      style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
    >
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-[80] border-b border-black/[0.08] bg-[rgba(242,243,245,.82)] backdrop-blur-2xl">
        <div className="mx-auto flex h-[68px] w-[min(1400px,calc(100%-40px))] items-center gap-7">
          <a href={MAIN_SITE_URL} className="flex items-center gap-2.5 whitespace-nowrap text-[17px] font-semibold tracking-[-0.03em]" style={{ fontFamily: 'var(--font-outfit)' }}>
            <BrandMark size={30} />
            <span className="hidden sm:inline uppercase tracking-[0.14em] text-[15px]">Kaamlee</span>
          </a>

          <nav className="hidden items-center gap-6 whitespace-nowrap text-[14px] font-medium text-black/55 md:flex" style={{ fontFamily: 'var(--font-outfit)' }}>
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} className="transition-colors hover:text-[#0b0b0c]">{label}</a>
            ))}
          </nav>

          <div className="ml-auto flex flex-none items-center gap-4">
            <span className="hidden font-mono text-[12.5px] font-semibold text-black/40 sm:inline">CLOSES 30 SEP</span>
            <Link href={APPLY_HREF} className="whitespace-nowrap rounded-full bg-[#4ADE80] px-5 py-[9px] text-[13.5px] font-bold text-black transition-transform duration-300 hover:-translate-y-0.5" style={{ fontFamily: 'var(--font-outfit)' }}>
              Apply now
            </Link>
            <button onClick={() => setMobileOpen((v) => !v)} className="grid h-9 w-9 flex-none place-items-center rounded-full border border-black/[0.08] text-black/60 md:hidden" aria-label="Toggle menu">
              {mobileOpen ? <XIcon size={17} /> : <MenuIcon size={17} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="border-t border-black/[0.08] bg-[#f2f3f5] px-5 py-3 md:hidden">
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMobileOpen(false)} className="block rounded-xl px-2 py-2.5 text-[15px] text-[#3d3d3d]">{label}</a>
            ))}
          </div>
        )}
      </header>

      {/* ============ HERO ============ */}
      <section id="top" className="relative overflow-hidden px-5 pb-20 pt-14 sm:pt-20">
        <div className="pointer-events-none absolute -right-6 top-24 hidden h-[150px] w-[150px] opacity-90 lg:block animate-[awlSpin_46s_linear_infinite]">
          <div className="h-full w-full" style={{ background: '#4f46e5', clipPath: 'polygon(50% 0%,58% 32%,79% 8%,71% 38%,97% 27%,80% 50%,97% 73%,71% 62%,79% 92%,58% 68%,50% 100%,42% 68%,21% 92%,29% 62%,3% 73%,20% 50%,3% 27%,29% 38%,21% 8%,42% 32%)' }} />
        </div>
        <div className="pointer-events-none absolute bottom-10 left-4 hidden h-16 w-16 sm:block animate-[awlFloaty_9s_ease-in-out_infinite]">
          <div className="h-full w-full" style={{ background: '#ff5f57', clipPath: 'polygon(50% 0%,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0% 50%,40% 40%)' }} />
        </div>

        <div className="relative mx-auto grid w-[min(1400px,calc(100%-0px))] max-w-[1280px] grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_560px]">
          <div className="min-w-0">
            <Reveal>
              <span className="rounded-full bg-white px-4 py-2 text-[12.5px] font-bold uppercase tracking-[0.06em] text-black/45 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]" style={{ fontFamily: 'var(--font-outfit)' }}>
                Kaamlee Campus Ambassador
              </span>
            </Reveal>
            <Reveal delay={90}>
              <p className="mt-6 max-w-[320px] text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] text-black/50" style={{ fontFamily: 'var(--font-outfit)' }}>Want your campus to hear it first?</p>
            </Reveal>
            <Reveal delay={140}>
              <div className="mt-4 text-[28px] leading-none text-[#16a34a]">↓</div>
            </Reveal>
            <Reveal delay={180}>
              <Link href={APPLY_HREF} className="group mt-4 inline-flex items-center gap-2 rounded-full bg-[#0b0b0c] px-7 py-[14px] text-[15px] font-bold tracking-[0.01em] text-white transition-transform duration-300 hover:-translate-y-0.5" style={{ fontFamily: 'var(--font-outfit)' }}>
                Apply now <ArrowChevron />
              </Link>
            </Reveal>

            <Reveal delay={220}>
              <h1 className="mt-16 sm:mt-20" style={{ fontFamily: 'var(--font-outfit)', letterSpacing: '-0.045em' }}>
                <span className="block text-[26px] font-semibold leading-none tracking-[-0.03em] text-black/40 sm:text-[32px]">KAAMLEE</span>
                <span className="mt-1 block text-[52px] font-bold leading-[0.94] sm:text-[68px]">CAMPUS</span>
                <span className="relative block text-[52px] font-bold leading-[0.94] sm:text-[68px]">
                  AMBASSADOR
                  <span className="absolute left-4 top-[38px] text-[38px] font-bold text-[#16a34a] sm:top-[46px] sm:text-[46px]" style={{ fontFamily: 'var(--font-caveat)', transform: 'rotate(-6deg)' }}>program</span>
                </span>
              </h1>
            </Reveal>
          </div>

          <Reveal type="right" delay={140} className="relative">
            <div className="relative grid grid-cols-[minmax(0,1fr)_44px] grid-rows-[160px_150px] gap-3 sm:grid-cols-[1fr_1fr_44px] sm:grid-rows-[170px_170px]">
              {HERO_PANELS.slice(0, 3).map((p) => (
                <div key={p.label} className="relative flex flex-col items-start justify-between overflow-hidden rounded-[18px] border border-black/[0.08] bg-white p-4 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] first:col-span-2 sm:first:col-span-1">
                  <span className="grid h-10 w-10 place-items-center rounded-[12px]" style={{ background: p.bg, color: p.fg }}>
                    <p.icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className="text-[13.5px] font-medium text-black/55">{p.label}</span>
                </div>
              ))}
              <div className="row-span-2 hidden items-center justify-center rounded-[18px] border border-black/[0.08] bg-white py-3 sm:flex">
                <span className="text-[11.5px] font-semibold tracking-[0.28em] text-black/35" style={{ writingMode: 'vertical-rl', fontFamily: 'var(--font-outfit)' }}>KAAMLEE CAMPUS AMBASSADOR</span>
              </div>
              <div className="relative col-span-2 flex flex-col items-start justify-between overflow-hidden rounded-[18px] border border-black/[0.08] bg-white p-4 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] sm:col-span-1">
                <span className="grid h-10 w-10 place-items-center rounded-[12px]" style={{ background: HERO_PANELS[3].bg, color: HERO_PANELS[3].fg }}>
                  <ImageIcon size={18} strokeWidth={1.8} />
                </span>
                <span className="text-[13.5px] font-medium text-black/55">{HERO_PANELS[3].label}</span>
              </div>

              <div className="absolute -top-4 left-1/3 flex items-center gap-2.5 whitespace-nowrap rounded-full bg-[#f2f3f5] px-3 text-[13px] font-semibold text-black/55" style={{ fontFamily: 'var(--font-outfit)' }}>
                <span>Share</span><span className="text-[#16a34a]">•</span><span>Host</span><span className="text-[#16a34a]">•</span><span>Get hired</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ MARQUEE ============ */}
      <section className="overflow-hidden border-y border-black/[0.08] bg-[#fafafa] py-3.5" style={{ WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)', maskImage: 'linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)' }}>
        <div className="flex w-max animate-[awlMarquee_38s_linear_infinite] gap-11 whitespace-nowrap text-[15px] font-semibold text-black/35" style={{ fontFamily: 'var(--font-outfit)' }}>
          {[...CAMPUS_NAMES, ...CAMPUS_NAMES].map((c, i) => (
            <span key={i} className="flex items-center gap-11">{c}<span className="text-[#16a34a]">✦</span></span>
          ))}
        </div>
      </section>

      {/* ============ COMMUNITY ============ */}
      <section id="community" className="relative overflow-hidden px-5 py-24 sm:py-28">
        <div className="pointer-events-none absolute right-8 top-14 hidden h-[110px] w-[110px] opacity-90 lg:block animate-[awlSpin_30s_linear_infinite]">
          <div className="grid h-full w-full place-items-center" style={{ background: '#34D399', clipPath: 'polygon(50% 0%,56% 12%,66% 4%,68% 17%,80% 12%,78% 25%,91% 25%,84% 36%,97% 41%,86% 50%,97% 59%,84% 64%,91% 75%,78% 75%,80% 88%,68% 83%,66% 96%,56% 88%,50% 100%,44% 88%,34% 96%,32% 83%,20% 88%,22% 75%,9% 75%,16% 64%,3% 59%,14% 50%,3% 41%,16% 36%,9% 25%,22% 25%,20% 12%,32% 17%,34% 4%,44% 12%)' }}>
            <span className="text-[17px] font-bold text-[#04231A]" style={{ fontFamily: 'var(--font-caveat)', transform: 'rotate(-14deg)' }}>kaamlee</span>
          </div>
        </div>

        <div className="mx-auto max-w-[1280px]">
          <Reveal className="relative text-center">
            <span className="block text-[38px] font-bold text-[#c08a12] sm:text-[48px]" style={{ fontFamily: 'var(--font-caveat)', transform: 'rotate(-3deg)' }}>at kaamlee</span>
            <h2 className="-mt-1 text-[42px] font-medium leading-[.95] tracking-[-0.04em] sm:text-[64px]" style={{ fontFamily: 'var(--font-outfit)' }}>a Unique<br />Community</h2>
            <p className="mx-auto mt-6 max-w-[560px] text-[17px] leading-relaxed text-[rgba(61,61,61,0.72)]">Two thousand four hundred students who stopped waiting for the placement cell. They run the drives, they know who&apos;s hiring, and their batch asks them first.</p>
          </Reveal>

          <Reveal delay={100} className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-3">
            {[
              { count: 180, label: 'campuses live', color: '#16a34a', bg: '#eafaf0' },
              { count: 2400, label: 'ambassadors so far', color: '#c08a12', bg: '#fff7e0' },
              { count: 64, label: 'hired as interns', color: '#dc2626', bg: '#fee2e2' },
            ].map((c, i) => (
              <div key={c.label} className={`text-center ${i === 1 ? 'sm:mt-8' : ''}`}>
                <div className="mx-auto grid aspect-square w-full max-w-[220px] place-items-center rounded-full border border-black/[0.08] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]" style={{ background: c.bg }}>
                  <Counter target={c.count} className="text-[40px] font-bold tracking-[-0.03em]" />
                </div>
                <div className="mt-4 text-[15px] font-medium text-black/55">{c.label}</div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============ PROGRAM ============ */}
      <section id="get" className="px-5 pb-24">
        <div className="mx-auto w-[min(1400px,calc(100%-0px))] max-w-[1280px] overflow-hidden rounded-[34px] border border-black/[0.08] bg-white px-6 py-14 sm:px-10 sm:py-16">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <Reveal className="max-w-[540px]">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#eafaf0] px-4 py-1.5 text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#16a34a]" style={{ fontFamily: 'var(--font-outfit)' }}>Campus Ambassador Program</span>
              <h2 className="mt-5 text-[32px] font-medium leading-[1.08] tracking-[-0.035em] sm:text-[42px]" style={{ fontFamily: 'var(--font-outfit)' }}>Kaamlee&apos;s presence on campus, run by students.</h2>
              <p className="mt-5 text-[17px] leading-relaxed text-black/55">Ambassadors host events, spread the word on their campus, and drive registrations from their university. In return, rewards scale directly with what they bring: how many students sign up, and how many events they run.</p>
            </Reveal>
            <Reveal delay={100} className="flex-none">
              <div className="rounded-[22px] border border-black/[0.08] bg-[#fafafa] px-8 py-6 text-center">
                <div className="text-[56px] font-bold leading-none tracking-[-0.03em]" style={{ fontFamily: 'var(--font-outfit)' }}>2</div>
                <div className="mt-2 max-w-[160px] text-[13.5px] font-medium leading-snug text-black/50">reward tracks — per registration, per event hosted</div>
              </div>
            </Reveal>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-10 border-t border-black/[0.08] pt-10 sm:grid-cols-2">
            {PROGRAM_POINTS.map((p, n) => (
              <Reveal key={p.n} delay={(n % 2) * 90}>
                <span className="font-mono text-[13px] font-semibold text-black/30">{p.n}</span>
                <h3 className="mt-3 text-[21px] font-semibold tracking-[-0.02em]">{p.t}</h3>
                <p className="mt-2.5 max-w-[42ch] text-[15px] leading-relaxed text-black/55">{p.d}</p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={180} className="mt-14 flex flex-wrap items-center gap-4 border-t border-black/[0.08] pt-10">
            <Link href={APPLY_HREF} className="group inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[#0b0b0c] px-7 py-[14px] text-[15px] font-bold tracking-[0.01em] text-white transition-transform duration-300 hover:-translate-y-0.5" style={{ fontFamily: 'var(--font-outfit)' }}>
              Apply to be an ambassador <ArrowChevron />
            </Link>
            <span className="text-[14.5px] text-black/45">Open to any student, any year, any university.</span>
          </Reveal>
        </div>
      </section>

      {/* ============ WHAT YOU DO ============ */}
      <section id="do" className="px-5 pb-24">
        <div className="mx-auto max-w-[1280px]">
          <Reveal>
            <h2 className="text-[38px] font-medium leading-[.95] tracking-[-0.04em] sm:text-[56px]" style={{ fontFamily: 'var(--font-outfit)' }}>What Will<br />You Do?</h2>
            <p className="mt-5 max-w-[440px] text-[19px] leading-relaxed text-black/55" style={{ fontFamily: 'var(--font-outfit)' }}>Six to eight hours a month. That&apos;s the whole ask.</p>
          </Reveal>

          <Reveal delay={100} className="mx-auto mt-14 flex max-w-[760px] flex-col">
            {DO_ITEMS.map((d, i) => (
              <div
                key={d}
                className="relative border border-black/[0.08] bg-white px-8 py-7 text-center sm:px-14"
                style={{
                  clipPath: 'polygon(2% 0, 98% 0, 100% 100%, 0 100%)',
                  marginTop: i === 0 ? 0 : -8,
                }}
              >
                <span className="absolute left-5 top-4 text-[12px] font-bold text-black/30">✕</span>
                <p className="text-[17px] font-semibold leading-relaxed sm:text-[19px]" style={{ fontFamily: 'var(--font-outfit)' }}>{d}</p>
              </div>
            ))}
          </Reveal>

          <div className="mt-9 flex items-center justify-center gap-3 text-center text-[14px] font-semibold text-black/45">
            <span className="h-[7px] w-[7px] flex-none rounded-full bg-[#16a34a] animate-pulse" />
            Posters, story packs, captions, QR code and speaker — all sent to you.
          </div>
        </div>
      </section>

      {/* ============ WHO CAN APPLY ============ */}
      <section id="who" className="relative overflow-hidden px-5 pb-28">
        <div className="mx-auto max-w-[1280px]">
          <Reveal className="relative text-center">
            <span className="inline-block rounded-full bg-[#FBBF24] px-6 py-1.5 text-[36px] font-medium tracking-[-0.03em] text-black sm:text-[52px]" style={{ fontFamily: 'var(--font-outfit)', transform: 'rotate(-1deg)' }}>Who Can</span>
            <h2 className="-mt-2 text-[42px] font-medium leading-[1] tracking-[-0.04em] sm:text-[64px]" style={{ fontFamily: 'var(--font-outfit)' }}>Apply?</h2>
            <p className="mx-auto mt-5 max-w-[420px] text-[19px] leading-relaxed text-black/55" style={{ fontFamily: 'var(--font-outfit)' }}>Any student, any year, any course.</p>
          </Reveal>

          <Reveal delay={100} className="relative mt-14 flex flex-col items-center gap-4">
            {WHO_CAN_APPLY.map((w) => (
              <span key={w.t} className={`rounded-full px-7 py-4 text-center text-[16px] font-semibold sm:text-[19px] ${w.rotate}`} style={{ background: w.bg, color: w.fg, fontFamily: 'var(--font-outfit)' }}>{w.t}</span>
            ))}
          </Reveal>

          <Reveal delay={180} className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIMELINE.map((s) => (
              <div key={s.n} className="rounded-[18px] border border-black/[0.08] bg-white p-6 transition-all duration-400 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(16,18,26,.22)]">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#4ADE80] text-[12px] font-black text-black" style={{ fontFamily: 'var(--font-outfit)' }}>{s.n}</span>
                  <span className="font-mono text-[12px] font-semibold tracking-[0.12em] text-black/40">{s.when}</span>
                </div>
                <h3 className="mt-4 text-[21px] font-semibold tracking-[-0.03em]">{s.t}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-black/50">{s.d}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============ STORIES ============ */}
      <section id="stories" className="px-5 pb-24">
        <div className="mx-auto max-w-[1280px]">
          <Reveal className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-[620px] text-[34px] font-medium leading-[.98] tracking-[-0.04em] sm:text-[48px]" style={{ fontFamily: 'var(--font-outfit)' }}>Where the last<br />batch ended up.</h2>
            <span className="flex-none text-[26px] font-bold text-[#16a34a]" style={{ fontFamily: 'var(--font-caveat)', transform: 'rotate(-4deg)' }}>64 got hired</span>
          </Reveal>

          <Reveal delay={100} className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_1fr_1fr]">
            {STORIES.map((s) => (
              <div key={s.name} className="flex flex-col gap-5 rounded-[22px] border border-black/[0.08] bg-white p-7">
                <p className={`m-0 leading-relaxed ${s.big ? 'text-[21px] font-medium tracking-[-0.02em]' : 'text-[16px] text-[rgba(61,61,61,0.8)]'}`} style={s.big ? { fontFamily: 'var(--font-outfit)' } : undefined}>{s.q}</p>
                <div className="mt-auto flex items-center gap-3">
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-full font-bold" style={{ background: s.bg, color: s.fg, fontFamily: 'var(--font-outfit)' }}>{s.initials}</span>
                  <div>
                    <div className="text-[15px] font-bold">{s.name}</div>
                    <div className="text-[13.5px] text-black/45">{s.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section id="apply" className="px-5 pb-24">
        <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[30px] bg-[#4ADE80] px-6 py-20 text-center text-[#04231A] sm:px-12 sm:py-24">
          <div className="pointer-events-none absolute -left-10 -bottom-12 h-[200px] w-[200px] rounded-full bg-[#ff5f57] opacity-85" />
          <div className="pointer-events-none absolute -right-8 -top-10 h-[170px] w-[170px] animate-[awlSpin_36s_linear_infinite]" style={{ background: '#4F46E5', clipPath: 'polygon(50% 0%,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0% 50%,40% 40%)' }} />

          <Reveal className="relative">
            <span className="text-[30px] font-bold sm:text-[38px]" style={{ fontFamily: 'var(--font-caveat)' }}>last date 30 september</span>
            <h2 className="mt-2 text-[46px] font-semibold leading-[.94] tracking-[-0.04em] sm:text-[70px]" style={{ fontFamily: 'var(--font-outfit)' }}>Put your campus<br />on the map.</h2>
            <p className="mx-auto mt-5 max-w-[520px] text-[17px] font-medium leading-relaxed opacity-75">Batch 4 opens 180 seats. Five minutes to apply, and no resume needed.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={APPLY_HREF} className="rounded-full bg-black px-8 py-[16px] text-[16px] font-bold text-[#4ADE80] transition-transform duration-300 hover:-translate-y-0.5" style={{ fontFamily: 'var(--font-outfit)' }}>APPLY NOW</Link>
              <a href="#stories" className="rounded-full border-2 border-[#04231A]/35 px-8 py-[14px] text-[16px] font-semibold text-[#04231A] transition-colors hover:border-[#04231A]" style={{ fontFamily: 'var(--font-outfit)' }}>Talk to an ambassador</a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-black/[0.08] px-5 py-14">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr]">
          <div>
            <a href={MAIN_SITE_URL} className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.03em]" style={{ fontFamily: 'var(--font-outfit)' }}>
              <BrandMark size={30} /> <span className="uppercase tracking-[0.14em]">Kaamlee</span>
            </a>
            <p className="mt-4 max-w-[300px] text-[14.5px] leading-relaxed text-black/50">The campus program behind the job platform. 180 colleges, 2,400 ambassadors, one map of who&apos;s hiring.</p>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-black/35" style={{ fontFamily: 'var(--font-outfit)' }}>Program</span>
            {NAV_LINKS.slice(1).map(([href, label]) => (
              <a key={href} href={href} className="text-[14.5px] font-medium text-black/55 transition-all hover:translate-x-1 hover:text-[#0b0b0c]">{label}</a>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-black/35" style={{ fontFamily: 'var(--font-outfit)' }}>Kaamlee</span>
            <a href={MAIN_SITE_URL} className="text-[14.5px] font-medium text-black/55 transition-all hover:translate-x-1 hover:text-[#0b0b0c]">For candidates</a>
            <a href={`${MAIN_SITE_URL}#b2b`} className="text-[14.5px] font-medium text-black/55 transition-all hover:translate-x-1 hover:text-[#0b0b0c]">For employers</a>
            <a href="mailto:kaamlee2026@gmail.com" className="text-[14.5px] font-medium text-black/55 transition-all hover:translate-x-1 hover:text-[#0b0b0c]">kaamlee2026@gmail.com</a>
          </div>
        </div>
        <div className="mx-auto mt-12 flex max-w-[1280px] flex-wrap items-center justify-between gap-4 border-t border-black/[0.08] pt-6 text-[14px] text-black/45">
          <span>© 2026 Kaamlee</span>
          <span>Made in India</span>
        </div>
      </footer>
    </main>
  );
}
