'use client';

import { Caveat } from 'next/font/google';
import Image from "next/image";
import Link from 'next/link';
import { motion, useInView, type Variants } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

const caveat = Caveat({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-caveat' });

const MAIN_SITE_URL = process.env.NEXT_PUBLIC_KAAMLEE_URL || 'https://kaamlee.in';

const NAV_LINKS = [
  { href: '#community', label: 'Community' },
  { href: '#get', label: 'What you get' },
  { href: '#do', label: 'What you do' },
  { href: '#who', label: 'Who can apply' },
  { href: '#stories', label: 'Stories' },
];

const COLLEGES = [
  'VIT VELLORE',
  'NIT SURATHKAL',
  'SRM CHENNAI',
  'BITS PILANI',
  'DTU DELHI',
  'MANIPAL',
  'CHRIST BENGALURU',
  'SYMBIOSIS PUNE',
];

const STATS = [
  { value: 180, label: 'campuses live', color: '#16A34A', image: '/ambassador_images/image6.jpg' },
  { value: 2400, label: 'ambassadors so far', color: '#D97706', image: '/ambassador_images/image7.webp' },
  { value: 64, label: 'hired as interns', color: '#FF4D2E', image: '/ambassador_images/image5.jpg' },
];

const PERKS = [
  { icon: '\u{1F4B0}', bg: '#34D399', fg: '#04231A', rotate: '-rotate-2', title: 'Referral Bonus', body: "Refer friends and earn rewards!" },
  { icon: '\u{1F4DC}', bg: '#FBCFE8', fg: '#3B0A28', rotate: 'rotate-3', title: 'Certificate and a signed LOR', body: 'Verifiable for everyone who finishes; LOR for the top 100.' },
  { icon: '✨', bg: '#FF2D62', fg: '#ffffff', rotate: '-rotate-3', title: 'Kaamlee Pro, free for certain time', body: 'Resume match, portfolio and alerts — for you and five friends.' },
  { icon: '⚡', bg: '#FDE68A', fg: '#3B2A03', rotate: 'rotate-2', title: 'Internship fast-track', body: 'Tier 3 skips the resume screen here and gets referred to partners.' },
  { icon: '⏱️', bg: '#FF4D2E', fg: '#ffffff', rotate: '-rotate-4', title: 'Mentor hours, every month', body: 'With recruiters and founders from the hiring side of the platform.' },
  { icon: '\u{1F39F}️', bg: '#4F46E5', fg: '#ffffff', rotate: 'rotate-4', title: '₹2,500+ event budget', body: 'Reimbursed per event, on top of the goodies. Deck and speaker included.' },
];

const TASKS = [
  { pre: 'Share openings in your class groups', em: 'the day they post.' },
  { pre: 'Put the drive poster up where', em: 'your batch actually looks.' },
  { pre: 'Host one event a semester — a resume clinic, an alumni AMA or a', em: 'mock interview night.' },
  { pre: 'Send one short note a month on', em: 'what your campus needs.' },
];

const REQUIREMENTS = [
  { text: 'Enrolled full-time at a college in India', bg: '#34D399', fg: '#04231A', rotate: '-rotate-3' },
  { text: 'Comfortable talking to your batch, in any language', bg: '#FBCFE8', fg: '#3B0A28', rotate: 'rotate-2' },
  { text: 'Graduating 2027 or later, undergrad or postgrad', bg: '#4F46E5', fg: '#ffffff', rotate: '-rotate-2' },
  { text: 'Active in at least one campus group or society', bg: '#FDE68A', fg: '#3B2A03', rotate: 'rotate-3' },
];

const STEPS = [
  { n: 1, when: '15–30 SEP', title: 'Apply', body: 'Five-minute form. No resume, no cover letter.' },
  { n: 2, when: '2–6 OCT', title: 'Short call', body: '15 minutes on video with the campus team.' },
  { n: 3, when: '10 OCT', title: 'Onboard', body: 'Dashboard, asset kit and referral link go live.' },
  { n: 4, when: 'OCT–MAR', title: 'Run the term', body: 'Refer friends and earn rewards!' },
];

const TESTIMONIALS = [
  { quote: 'I joined for the certificate and left with a PPO. Running the resume clinic taught me more about hiring than any course I took.', initials: 'AK', avatarBg: '#16A34A', avatarFg: '#fff', name: 'Aditi K.', meta: 'VIT Vellore · now Product intern at Kaamlee' },
  { quote: '400 people from my college signed up. The placement cell now asks me which drives to push.', initials: 'DP', avatarBg: '#FBBF24', avatarFg: '#000', name: 'Dev P.', meta: 'NIT Surathkal · Batch 3' },
  { quote: 'Six hours a month, honestly. The asset kit does most of the work for you.', initials: 'NB', avatarBg: '#FF4D2E', avatarFg: '#fff', name: 'Nikhil B.', meta: 'SRM Chennai · Batch 3' },
];

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 0.85, 0.26, 1] } },
};

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={revealVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15, margin: '0px 0px -6% 0px' }}
    >
      {children}
    </motion.div>
  );
}

function Counter({ target }: { target: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const duration = 1400;
    let frame: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target]);

  return (
    <div ref={ref}>
      {value.toLocaleString('en-IN')}
    </div>
  );
}

function ImageSlot({
  label,
  shape = 'rounded',
  gradient,
  image,
}: {
  label: string;
  shape?: 'rounded' | 'circle';
  gradient: string;
  image?: string;
}) {
  return (
    <div
      className={`relative w-full h-full ${
        shape === 'circle' ? 'rounded-full' : 'rounded-2xl'
      } border border-black/5 overflow-hidden`}
      style={{ background: gradient }}
    >
      {image && (
        <Image
          src={image}
          alt={label}
          fill
          sizes="(min-width: 640px) 33vw, 100vw"
          className="object-cover"
        />
      )}
    </div>
  );
}
export default function AmbassadorPage() {
  return (
    <div className={`${caveat.variable} bg-[#FAF9F6] text-[#0A0A0A] min-w-[320px] overflow-x-clip`} style={{ fontFamily: 'var(--font-jakarta), ui-sans-serif, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FAF9F6]/80 backdrop-blur-md border-b border-[#E7E5E0]">
        <div className="mx-auto px-6 md:px-12 h-16 flex items-center gap-4 md:gap-7">
          <a
            href={MAIN_SITE_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#57534E] hover:text-[#0A0A0A] transition-colors border border-black/10 rounded-full px-3 py-1.5 shrink-0"
          >
            <ChevronLeft size={12} />RETURN
          </a>
          <a href="#top" className="flex items-center gap-2.5 text-[#0A0A0A] shrink-0">
            <span className="w-7 h-7 rounded-lg overflow-hidden shrink-0 border border-black/10">
              <Image src="/logo.png" alt="Kaamlee" width={28} height={28} className="w-full h-full object-cover" />
            </span>
            <span className="uppercase tracking-[0.15em] text-[16px] sm:text-[18px] font-semibold" style={{ fontFamily: 'var(--font-jakarta), ui-sans-serif, system-ui, sans-serif' }}>
              Kaamlee
            </span>
          </a>
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#6B7280] whitespace-nowrap">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-[#57534E] hover:text-[#0A0A0A] transition-colors">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 whitespace-nowrap">
            <span className="hidden md:inline text-xs font-semibold text-[#6B7280] font-mono">CLOSES 30 SEP</span>
            <Link
              href="/apply"
              className="text-sm font-bold text-white bg-[#16A34A] hover:bg-[#0A0A0A] transition-colors px-5 py-2.5 rounded-full font-[var(--font-outfit)]"
            >
              APPLY NOW
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative px-6 md:px-18 pt-16 pb-20 overflow-hidden">
        <div className="pointer-events-none absolute top-28 right-8 w-32 h-32 md:w-48 md:h-48 opacity-90 animate-[spin_44s_linear_infinite]">
          <div
            className="w-full h-full bg-[#4F46E5]"
            style={{ clipPath: 'polygon(50% 0%,58% 32%,79% 8%,71% 38%,97% 27%,80% 50%,97% 73%,71% 62%,79% 92%,58% 68%,50% 100%,42% 68%,21% 92%,29% 62%,3% 73%,20% 50%,3% 27%,29% 38%,21% 8%,42% 32%)' }}
          />
        </div>
        <div className="pointer-events-none absolute bottom-16 left-4 w-16 h-16 md:w-24 md:h-24 animate-bounce [animation-duration:3.4s]">
          <div
            className="w-full h-full bg-[#FF4D2E]"
            style={{ clipPath: 'polygon(50% 0%,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0% 50%,40% 40%)' }}
          />
        </div>

        <div className="mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_560px] gap-10 items-start relative z-10">
          <Reveal className="min-w-0 pt-4">
            <p className="font-[var(--font-outfit)] text-2xl md:text-[28px] leading-tight font-semibold tracking-tight text-[#6B7280] max-w-[320px]">
              Want your campus
              <br />to hear it first?
            </p>
            <div className="mt-4 text-2xl text-[#16A34A] leading-none">{'↓'}</div>
            <Link
              href="/apply"
              className="inline-block mt-4 font-[var(--font-outfit)] text-sm md:text-base font-extrabold tracking-wide text-white bg-[#16A34A] hover:bg-[#0A0A0A] hover:-translate-y-0.5 transition-all px-6 py-3.5 rounded-full"
            >
              APPLY NOW
            </Link>

            <h1 className="mt-16 md:mt-24 font-[var(--font-outfit)] tracking-tighter">
              <span className="block text-2xl md:text-3xl font-semibold tracking-tight text-[#6B7280] leading-none">KAAMLEE</span>
              <span className="block mt-0.5 text-5xl md:text-7xl font-bold leading-[0.92]">CAMPUS</span>
              <span className="relative block text-5xl md:text-7xl font-bold leading-[0.92]">
                AMBASSADOR
                <span
                  className={`${caveat.className} absolute left-4 top-9 md:left-8 md:top-11 text-3xl md:text-5xl font-bold text-[#16A34A] -rotate-6`}
                >
                  program
                </span>
              </span>
            </h1>
          </Reveal>

          <Reveal>
            <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_56px] grid-rows-[150px_190px_150px] gap-2.5">
              <div className="row-span-1">
                <ImageSlot
                  label="Poster on notice board"
                  gradient="linear-gradient(135deg,#4F46E5,#FBBF24)"
                  image="/ambassador_images/image2.jpg"
                />
              </div>
              <div className="row-span-2">
                <ImageSlot
                  label="Poster on notice board"
                  gradient="linear-gradient(135deg,#4F46E5,#FBBF24)"
                  image="/ambassador_images/image3.jpg"
                />
              </div>
              <div className="row-span-3 border border-[#E7E5E0] rounded-2xl flex items-center justify-center py-3">
                <span className="[writing-mode:vertical-rl] font-[var(--font-outfit)] text-[11px] font-semibold tracking-[0.28em] text-[#6B7280]">
                  KAAMLEE CAMPUS AMBASSADOR
                </span>
              </div>
              <div className="row-span-2">
                <ImageSlot
                  label="Poster on notice board"
                  gradient="linear-gradient(135deg,#4F46E5,#FBBF24)"
                  image="/ambassador_images/image4.png"
                />
              </div>
              <div className="row-span-1">
                <ImageSlot
                  label="Poster on notice board"
                  gradient="linear-gradient(135deg,#4F46E5,#FBBF24)"
                  image="/ambassador_images/image1.jpg"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-3 font-[var(--font-outfit)] text-sm font-semibold text-[#374151]">
              <span>Share</span><span className="text-[#4ADE80]">{'•'}</span>
              <span>Host</span><span className="text-[#4ADE80]">{'•'}</span>
              <span>Get hired</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Marquee */}
      <section className="border-y border-[#E7E5E0] py-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent)]">
        <div className="flex w-max gap-10 whitespace-nowrap animate-[marquee_32s_linear_infinite]">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex gap-10 pr-10">
              {COLLEGES.map((c) => (
                <span key={c} className="font-[var(--font-outfit)] text-base md:text-[17px] font-semibold text-[#A8A29E] flex items-center gap-10">
                  {c}
                  <span className="text-[#16A34A]">{'•'}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Community */}
      <section id="community" className="relative px-6 md:px-18 py-24 md:py-28 overflow-hidden">
        <div className="mx-auto">
          <Reveal className="text-center">
            <span className={`${caveat.className} block text-4xl md:text-5xl font-bold text-[#D97706] -rotate-3`}>at kaamlee</span>
            <h2 className="-mt-1 font-[var(--font-outfit)] text-5xl md:text-7xl lg:text-[82px] leading-[0.95] font-medium tracking-tighter">
              a Unique
              <br />Community
            </h2>
            <p className="mt-6 mx-auto text-base md:text-lg leading-relaxed text-[#6B7280] max-w-xl">
              Two thousand four hundred students who stopped waiting for the placement cell. They run the drives, they know who&apos;s hiring, and their batch asks them first.
            </p>
          </Reveal>

          <Reveal className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 items-start">
            {STATS.map((s, i) => (
              <div key={s.label} className={i === 1 ? 'sm:mt-14' : ''}>
                <div className="relative w-full aspect-square rounded-full overflow-hidden">
                  <ImageSlot
                    label={s.label}
                    shape="circle"
                    gradient={`radial-gradient(circle at 30% 30%, ${s.color}, #0A0A0A)`}
                    image={s.image}
                  />
                </div>
                <div className="mt-5 text-center">
                  <div className="font-[var(--font-outfit)] text-4xl md:text-[44px] font-bold tracking-tighter" style={{ color: s.color }}>
                    <Counter target={s.value} />
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-[#6B7280]">{s.label}</div>
                </div>
              </div>
            ))}
          </Reveal>
        </div>

        <div className="hidden md:block pointer-events-none absolute right-12 top-20 w-36 h-36 animate-[spin_30s_linear_infinite]">
          <div
            className="w-full h-full bg-[#34D399] grid place-items-center"
            style={{ clipPath: 'polygon(50% 0%,56% 12%,66% 4%,68% 17%,80% 12%,78% 25%,91% 25%,84% 36%,97% 41%,86% 50%,97% 59%,84% 64%,91% 75%,78% 75%,80% 88%,68% 83%,66% 96%,56% 88%,50% 100%,44% 88%,34% 96%,32% 83%,20% 88%,22% 75%,9% 75%,16% 64%,3% 59%,14% 50%,3% 41%,16% 36%,9% 25%,22% 25%,20% 12%,32% 17%,34% 4%,44% 12%)' }}
          >
            <span className={`${caveat.className} text-2xl font-bold text-[#052E16] -rotate-[14deg]`}>kaamlee</span>
          </div>
        </div>
      </section>

      {/* What Do You Get */}
      <section id="get" className="px-6 md:px-18 py-24 md:py-28">
        <div className="mx-auto">
          <Reveal className="relative">
            <h2 className="font-[var(--font-outfit)] text-5xl md:text-7xl lg:text-[80px] leading-[0.92] font-medium tracking-tighter">
              What Do
              <br />
              <span className="md:ml-36 inline-block">You Get?</span>
            </h2>
          </Reveal>

          <Reveal className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PERKS.map((p) => (
              <div
                key={p.title}
                className={`rounded-[20px] p-7 transition-transform duration-300 hover:-translate-y-2 ${p.rotate}`}
                style={{ background: p.bg, color: p.fg }}
              >
                <div className="text-2xl">{p.icon}</div>
                <h3 className="mt-4 font-[var(--font-outfit)] text-2xl leading-tight font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed font-medium opacity-80">{p.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* What Will You Do */}
      <section id="do" className="bg-[#0A0A0A] px-6 md:px-18 pt-24 pb-24 md:pt-28 md:pb-28">
        <div className="mx-auto">
          <Reveal className="relative">
            <div className="hidden md:block absolute -left-8 -top-42 w-36 h-36 bg-[#4F46E5] animate-[spin_50s_linear_infinite]" style={{ clipPath: 'polygon(50% 0%,58% 32%,79% 8%,71% 38%,97% 27%,80% 50%,97% 73%,71% 62%,79% 92%,58% 68%,50% 100%,42% 68%,21% 92%,29% 62%,3% 73%,20% 50%,3% 27%,29% 38%,21% 8%,42% 32%)' }} />
            <h2 className="relative font-[var(--font-outfit)] text-5xl md:text-7xl lg:text-[80px] leading-[0.92] font-medium tracking-tighter text-white">
              What Will
              <br />
              <span className="md:ml-32 inline-block">You Do?</span>
            </h2>
            <p className="mt-6 md:ml-32 font-[var(--font-outfit)] text-xl md:text-2xl leading-snug text-[#9CA3AF] max-w-md">
              Six to eight hours a month. That&apos;s the whole ask.
            </p>
          </Reveal>

          <Reveal className="mt-14 max-w-7xl mx-auto flex flex-col">
            {TASKS.map((t, i) => (
              <div
                key={t.em}
                className={`relative text-white px-8 sm:px-14 py-8 sm:py-14 border border-white/10 ${i > 0 ? '-mt-4' : ''}`}
                style={{
                  background: 'linear-gradient(#2A2A2A, #050505)',
                  clipPath: 'polygon(2% 0, 98% 0, 100% 100%, 0 100%)',
                }}
              >
                <span className="absolute left-6 sm:left-9 top-4 text-sm font-bold text-[#9CA3AF]">{'→'}</span>
                <p className="text-center text-lg sm:text-xl leading-relaxed font-semibold font-[var(--font-outfit)]">
                  {t.pre} <em className="italic font-medium">{t.em}</em>
                </p>
              </div>
            ))}
          </Reveal>

          <Reveal className="mt-10 flex items-center justify-center gap-3 text-sm text-[#9CA3AF] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
            Posters, story packs, captions, QR code and speaker, all sent to you.
          </Reveal>
        </div>
      </section>

      {/* Who Can Apply */}
      <section id="who" className="px-6 md:px-18 py-4 pb-28 md:pb-32">
        <div className="mx-auto">
          <Reveal className="text-center mt-24">
            <span className="inline-block font-[var(--font-outfit)] text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tight bg-[#FBBF24] text-black rounded-full px-6 md:px-8 py-1 -rotate-1">
              Who Can
            </span>
            <h2 className="-mt-2 font-[var(--font-outfit)] text-5xl md:text-7xl lg:text-[80px] leading-none font-medium tracking-tighter">
              Apply?
            </h2>
            <p className="mt-5 mx-auto font-[var(--font-outfit)] text-xl md:text-2xl leading-snug text-[#374151] max-w-sm">
              Any student, any year, any course.
            </p>
          </Reveal>

          <Reveal className="mt-16 relative flex flex-col items-center gap-6">
            {REQUIREMENTS.map((r) => (
              <div
                key={r.text}
                className={`font-[var(--font-outfit)] text-lg sm:text-2xl font-semibold tracking-tight px-6 sm:px-11 py-4 sm:py-5 rounded-full text-center ${r.rotate}`}
                style={{ background: r.bg, color: r.fg }}
              >
                {r.text}
              </div>
            ))}
            <div className="hidden md:grid absolute right-[6%] top-10 w-20 h-20 rounded-full bg-[#FF4D2E] place-items-center text-2xl animate-bounce [animation-duration:4s]">{'\u{1F389}'}</div>
            <div className="hidden md:block absolute left-[8%] bottom-5 w-16 h-16 rounded-full bg-[#FDE68A]" />
          </Reveal>

          <Reveal className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="border border-[#E7E5E0] rounded-2xl p-6">
                <div className="flex items-center gap-2.5">
                  <span className="w-[26px] h-[26px] rounded-full bg-[#16A34A] text-white grid place-items-center text-xs font-extrabold font-[var(--font-outfit)]">{s.n}</span>
                  <span className="font-[var(--font-outfit)] text-xs font-semibold tracking-[0.14em] text-[#6B7280]">{s.when}</span>
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{s.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Stories */}
      <section id="stories" className="px-6 md:px-18 pb-24 md:pb-28">
        <div className="mx-auto">
          <Reveal className="flex flex-col md:flex-row items-end justify-between gap-8">
            <h2 className="font-[var(--font-outfit)] text-4xl md:text-6xl lg:text-7xl leading-[0.98] font-medium tracking-tighter max-w-xl">
              Where the last
              <br />batch ended up.
            </h2>
            <span className={`${caveat.className} shrink-0 text-3xl md:text-4xl font-bold text-[#16A34A] -rotate-3`}>64 got hired</span>
          </Reveal>

          <Reveal className="mt-10 grid grid-cols-1 lg:grid-cols-[1.25fr_1fr_1fr] gap-4">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className={`bg-white border border-[#E7E5E0] rounded-[22px] flex flex-col gap-5 p-7`}
              >
                <p className={'text-lg leading-relaxed text-[#374151]'}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-auto flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-full grid place-items-center font-extrabold font-[var(--font-outfit)] text-sm"
                    style={{ background: t.avatarBg, color: t.avatarFg }}
                  >
                    {t.initials}
                  </span>
                  <div>
                    <div className="text-sm font-bold">{t.name}</div>
                    <div className="text-sm text-[#6B7280]">{t.meta}</div>
                  </div>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section id="apply" className="px-6 md:px-18 pb-24 md:pb-28">
        <Reveal className="mx-auto relative overflow-hidden bg-[#4ADE80] text-[#04231A] rounded-[30px] px-8 md:px-12 py-20 md:py-24 text-center">
          <div className="hidden md:block pointer-events-none absolute -left-10 -bottom-12 w-48 h-48 rounded-full bg-[#FF4D2E] opacity-85" />
          <div
            className="hidden md:block pointer-events-none absolute -right-8 -top-10 w-40 h-40 bg-[#4F46E5] animate-[spin_36s_linear_infinite]"
            style={{ clipPath: 'polygon(50% 0%,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0% 50%,40% 40%)' }}
          />
          <div className="relative">
            <span className={`${caveat.className} text-3xl md:text-[44px] font-bold`}>last date 30 september</span>
            <h2 className="mt-1 font-[var(--font-outfit)] text-5xl md:text-7xl lg:text-[88px] leading-[0.94] font-semibold tracking-tighter">
              Put your campus
              <br />on the map.
            </h2>
            <p className="mt-5 mx-auto text-base md:text-lg leading-relaxed font-medium opacity-75">
              Batch 4 opens 180 seats. Five minutes to apply, and no resume needed.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/apply"
                className="font-[var(--font-outfit)] text-base font-extrabold text-[#4ADE80] bg-[#0A0A0A] hover:bg-black hover:text-[#86EFAC] hover:-translate-y-0.5 transition-all px-8 py-4 rounded-full"
              >
                APPLY NOW
              </Link>
              <a
                href="#stories"
                className="font-[var(--font-outfit)] text-base font-bold text-[#04231A] border-2 border-[#04231A]/35 hover:border-[#04231A] transition-colors px-8 py-4 rounded-full"
              >
                Talk to an ambassador
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E7E5E0]">
        <div className="mx-auto px-6 md:px-18 pt-12 pb-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#16A34A] grid place-items-center text-white font-extrabold text-sm font-[var(--font-outfit)]">K</span>
              <span className="text-lg font-bold tracking-tight font-[var(--font-outfit)]">kaamlee</span>
            </div>
            <p className="mt-4 text-sm text-[#6B7280] max-w-xs leading-relaxed">
              The campus program behind the job platform. 180 colleges, 2,400 ambassadors, one map of who&apos;s hiring.
            </p>
            <div className="mt-5 flex gap-2.5">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="px-3.5 py-2 border border-[#E7E5E0] rounded-full text-sm font-semibold text-[#374151] hover:border-[#0A0A0A] transition-colors">Instagram</a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="px-3.5 py-2 border border-[#E7E5E0] rounded-full text-sm font-semibold text-[#374151] hover:border-[#0A0A0A] transition-colors">LinkedIn</a>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-[var(--font-outfit)] text-xs font-semibold tracking-[0.14em] text-[#78716C]">PROGRAM</span>
            <a href="#get" className="text-sm text-[#374151] font-medium hover:text-[#0A0A0A]">What you get</a>
            <a href="#do" className="text-sm text-[#374151] font-medium hover:text-[#0A0A0A]">What you do</a>
            <a href="#who" className="text-sm text-[#374151] font-medium hover:text-[#0A0A0A]">Who can apply</a>
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-[var(--font-outfit)] text-xs font-semibold tracking-[0.14em] text-[#78716C]">RESOURCES</span>
            <a href="#stories" className="text-sm text-[#374151] font-medium hover:text-[#0A0A0A]">Leaderboard</a>
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-[var(--font-outfit)] text-xs font-semibold tracking-[0.14em] text-[#78716C]">KAAMLEE</span>
            <a href={MAIN_SITE_URL} className="text-sm text-[#374151] font-medium hover:text-[#0A0A0A]">For candidates</a>
            <a href={`${MAIN_SITE_URL}/pricing`} className="text-sm text-[#374151] font-medium hover:text-[#0A0A0A]">For employers</a>
            <a href={`${MAIN_SITE_URL}/privacy`} className="text-sm text-[#374151] font-medium hover:text-[#0A0A0A]">Privacy</a>
          </div>
        </div>
        <div className="mx-auto px-6 md:px-18 py-5 border-t border-[#E7E5E0] flex flex-col sm:flex-row justify-between gap-2 text-sm text-[#78716C]">
          <span>© 2026 Kaamlee</span>
          <span>Made in India</span>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
