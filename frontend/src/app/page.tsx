'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Map, Sparkles, Layers, Rocket, FileCheck2,
  ShieldCheck, Bell, Kanban, LogOut, Plus,
  Star, Menu as MenuIcon, X as XIcon, Clock, Search, CheckCircle2,
  Building2, Users, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import PricingModal from '@/components/PricingModal';
import { Map as MapView, MapMarker, MarkerContent, MapArc } from '@/components/ui/map';

const CACHE_TTL = 2 * 60 * 1000;
const _cache: Record<string, { data: any; ts: number }> = {};
function getCached(key: string) {
  const e = _cache[key];
  if (e && Date.now() - e.ts < CACHE_TTL) return e.data;
  return null;
}
function setCache(key: string, data: any) {
  _cache[key] = { data, ts: Date.now() };
}

const EASE_OUT = 'cubic-bezier(0.16,1,0.3,1)';

/* ============ REVEAL ON SCROLL ============ */
function Reveal({
  children,
  className = '',
  delay = 0,
  type = 'up',
  as: Tag = 'div',
  style: extraStyle,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  type?: 'up' | 'left' | 'right' | 'scale';
  as?: any;
  style?: React.CSSProperties;
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
    type === 'scale' ? 'translateY(30px) scale(0.965)' :
    'translateY(28px)';

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...extraStyle,
        opacity: inView ? 1 : 0,
        transform: inView ? (extraStyle?.transform ?? 'none') : hiddenTransform,
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
function Counter({ target, suffix = '', className = '' }: { target: number; suffix?: string; className?: string }) {
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
          const dur = 1500;
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
  return (
    <span ref={ref} className={className}>
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ============ FILL BAR (progress / step line) ============ */
function FillBar({ target, className = '', barClassName = '', delay = 0 }: { target: number; className?: string; barClassName?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { setFilled(true); io.unobserve(e.target); }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      <div
        className={barClassName}
        style={{
          width: filled ? `${target}%` : '0%',
          transition: `width 2200ms ${EASE_OUT}`,
          transitionDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}

/* ============ SPOTLIGHT CARD WRAPPER ============ */
function Spotlight({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(ev) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${((ev.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty('--my', `${((ev.clientY - r.top) / r.height) * 100}%`);
      }}
      className={`group relative ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'radial-gradient(420px 200px at var(--mx,50%) var(--my,0%), rgba(22,163,74,0.10), transparent 70%)' }}
      />
      {children}
    </div>
  );
}


/* ============ WORLD MAP MOCKUP DATA ============ */
const MAP_MARKERS: { name: string; coords: [number, number] }[] = [
  // North America
  { name: 'San Francisco', coords: [-122.4194, 37.7749] },
  { name: 'Los Angeles', coords: [-118.2437, 34.0522] },
  { name: 'Seattle', coords: [-122.3321, 47.6062] },
  { name: 'Chicago', coords: [-87.6298, 41.8781] },
  { name: 'New York', coords: [-74.0060, 40.7128] },
  { name: 'Toronto', coords: [-79.3832, 43.6532] },
  { name: 'Austin', coords: [-97.7431, 30.2672] },
  { name: 'Mexico City', coords: [-99.1332, 19.4326] },
  { name: 'Vancouver', coords: [-123.1207, 49.2827] },
  // South America
  { name: 'São Paulo', coords: [-46.6333, -23.5505] },
  { name: 'Buenos Aires', coords: [-58.3816, -34.6037] },
  { name: 'Santiago', coords: [-70.6693, -33.4489] },
  { name: 'Bogotá', coords: [-74.0721, 4.7110] },
  { name: 'Lima', coords: [-77.0428, -12.0464] },
  // Europe
  { name: 'London', coords: [-0.1276, 51.5074] },
  { name: 'Paris', coords: [2.3522, 48.8566] },
  { name: 'Berlin', coords: [13.4050, 52.5200] },
  { name: 'Madrid', coords: [-3.7038, 40.4168] },
  { name: 'Amsterdam', coords: [4.9041, 52.3676] },
  { name: 'Dublin', coords: [-6.2603, 53.3498] },
  { name: 'Stockholm', coords: [18.0686, 59.3293] },
  { name: 'Warsaw', coords: [21.0122, 52.2297] },
  { name: 'Rome', coords: [12.4964, 41.9028] },
  { name: 'Lisbon', coords: [-9.1393, 38.7223] },
  { name: 'Zurich', coords: [8.5417, 47.3769] },
  // Africa
  { name: 'Lagos', coords: [3.3792, 6.5244] },
  { name: 'Nairobi', coords: [36.8219, -1.2921] },
  { name: 'Cairo', coords: [31.2357, 30.0444] },
  { name: 'Johannesburg', coords: [28.0473, -26.2041] },
  { name: 'Accra', coords: [-0.1870, 5.6037] },
  { name: 'Casablanca', coords: [-7.5898, 33.5731] },
  // Middle East
  { name: 'Dubai', coords: [55.2708, 25.2048] },
  { name: 'Riyadh', coords: [46.6753, 24.7136] },
  { name: 'Tel Aviv', coords: [34.7818, 32.0853] },
  { name: 'Istanbul', coords: [28.9784, 41.0082] },
  // South & East Asia
  { name: 'Mumbai', coords: [72.8777, 19.0760] },
  { name: 'Delhi', coords: [77.2090, 28.6139] },
  { name: 'Bengaluru', coords: [77.5946, 12.9716] },
  { name: 'Hyderabad', coords: [78.4867, 17.3850] },
  { name: 'Pune', coords: [73.8567, 18.5204] },
  { name: 'Chennai', coords: [80.2707, 13.0827] },
  { name: 'Kolkata', coords: [88.3639, 22.5726] },
  { name: 'Singapore', coords: [103.8198, 1.3521] },
  { name: 'Tokyo', coords: [139.6503, 35.6762] },
  { name: 'Seoul', coords: [126.9780, 37.5665] },
  { name: 'Shanghai', coords: [121.4737, 31.2304] },
  { name: 'Hong Kong', coords: [114.1694, 22.3193] },
  { name: 'Jakarta', coords: [106.8456, -6.2088] },
  { name: 'Manila', coords: [120.9842, 14.5995] },
  { name: 'Bangkok', coords: [100.5018, 13.7563] },
  { name: 'Ho Chi Minh City', coords: [106.6297, 10.8231] },
  // Oceania
  { name: 'Sydney', coords: [151.2093, -33.8688] },
  { name: 'Melbourne', coords: [144.9631, -37.8136] },
  { name: 'Auckland', coords: [174.7633, -36.8485] },
];

const JOB_CARD_TINTS = [
  { bg: '#ecfdf5', text: '#16a34a' },
  { bg: '#f3eeff', text: '#7c4dff' },
  { bg: '#fff7e0', text: '#c08a12' },
  { bg: '#eafaf0', text: '#16a34a' },
];

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[1][0];
}

function hashSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function pseudoScore(seed: string) {
  return 68 + (hashSeed(seed) % 30);
}

function cityStats(name: string) {
  const h = hashSeed(name);
  return {
    openRoles: 800 + (h % 12000),
    postedToday: 20 + ((h >> 3) % 380),
  };
}

/** Point at parameter t along the same quadratic bezier MapArc draws between
 * `from` and `to` (lng/lat space), so a partial arc can be grown over time. */
function arcPointAt(from: [number, number], to: [number, number], curvature: number, t: number): [number, number] {
  const [x0, y0] = from;
  const [x2, y2] = to;
  const dx = x2 - x0;
  const dy = y2 - y0;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || curvature === 0) {
    return [x0 + dx * t, y0 + dy * t];
  }
  const mx = (x0 + x2) / 2;
  const my = (y0 + y2) / 2;
  const nx = -dy / distance;
  const ny = dx / distance;
  const offset = distance * curvature;
  const cx = mx + nx * offset;
  const cy = my + ny * offset;
  const inv = 1 - t;
  return [inv * inv * x0 + 2 * inv * t * cx + t * t * x2, inv * inv * y0 + 2 * inv * t * cy + t * t * y2];
}

/* ============ ICON HELPERS ============ */
const Tick = ({ dark = false }: { dark?: boolean }) => (
  <span className={`grid h-5 w-5 flex-none place-items-center rounded-full mt-[1px] ${dark ? 'bg-white/10 text-white' : 'bg-[#ecfdf5] text-[#16a34a]'}`}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m20 6-11 11-5-5" /></svg>
  </span>
);

const Cross = ({ dark = false }: { dark?: boolean }) => (
  <span className={`grid h-5 w-5 flex-none place-items-center rounded-full mt-[1px] ${dark ? 'bg-white/5 text-white/30' : 'bg-black/[0.04] text-black/25'}`}>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12" /></svg>
  </span>
);

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
const SOLUTIONS = [
  { icon: Map, t: 'Unified job map', d: 'Every open role from twelve boards, plotted on one map. No tab-hopping between sites.' },
  { icon: Rocket, t: 'Instant portfolio', d: 'Turn your resume into a public site with a real, shareable link.' },
  { icon: Sparkles, t: 'AI resume matching', d: 'Upload once. We score every live listing against your experience, in real time.' },
  { icon: Layers, t: 'Application tracker', d: 'Move roles across Saved, Applied, Interviewing and Offered on one board.' },
  { icon: FileCheck2, t: 'Tailored CVs', d: 'Generate an ATS-scored CV for every role you target, in seconds.' },
  { icon: ShieldCheck, t: 'Zero-noise listings', d: 'No popups. No fake urgency. Just the job and the apply button.' },
];

const ABOUT_LINKS = [
  { href: '#solutions', icon: Sparkles, label: 'Solutions', desc: 'Every tool built to close the gap between search and offer.', subKey: 'solutions' as const },
  { href: '#features', icon: Layers, label: 'Features', desc: 'Portfolio builder, tailored CVs, application tracker and more.', subKey: 'features' as const },
  { href: '#sources', icon: Search, label: 'Sources', desc: 'Twelve job boards, crawled every fifteen minutes.', subKey: null },
];

const ABOUT_SUB_DETAILS: Record<'solutions' | 'features', { t: string; d: string }[]> = {
  solutions: SOLUTIONS.map(({ t, d }) => ({ t, d })),
  features: [
    { t: 'Portfolio, one click', d: 'Turn your resume into a public portfolio site — pick a layout and theme, publish a link.' },
    { t: 'Tailored CV generator', d: 'A fresh, ATS-scored resume for every role you target — no rewriting from scratch.' },
    { t: 'Smart job alerts', d: 'Pinged the moment a new listing matches your resume.' },
    { t: 'Match analytics', d: 'See exactly how your resume stacks up against every listing.' },
    { t: 'Application tracker', d: 'Every role you save lands on a drag-and-drop board automatically.' },
  ],
};

const NAV_LINKS: [string, string][] = [['#b2b', 'Employers'], ['#ambassadors', 'Ambassadors'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']];

const B2B_FEATURES = [
  { icon: Building2, t: 'Direct job posting', d: 'Post roles and manage the whole pipeline from one dashboard — no third-party listing needed.' },
  { icon: CheckCircle2, t: 'First-round screening', d: 'Every applicant clears a screening interview before you see them, filtering for genuine intent.' },
  { icon: ShieldCheck, t: 'Proctored assessments', d: 'Skill checks run under proctoring, so a test score reflects the candidate, not a search engine.' },
  { icon: Users, t: 'Direct candidate pool', d: 'Recruit from active, job-seeking candidates already building profiles on Kaamlee.' },
];

const AMBASSADOR_FEATURES = [
  { rotate: '-rotate-2', bg: '#34D399', fg: '#04231A', glyph: '◉', t: 'Host events on campus', d: 'Resume clinics, meetups, or a drive — whatever gets your batch in a room together.' },
  { rotate: 'rotate-2', bg: '#FBCFE8', fg: '#3B0A28', glyph: '✦', t: 'Market Kaamlee locally', d: 'Spread the word through your own channels — you know your batch better than a national campaign does.' },
  { rotate: '-rotate-1', bg: '#4F46E5', fg: '#FFFFFF', glyph: '◆', t: 'Per-registration rewards', d: 'Goodies and rewards that scale with how many students from your university you sign up.' },
  { rotate: 'rotate-1', bg: '#FDE68A', fg: '#3B2A03', glyph: '▲', t: 'Per-event rewards + certificate', d: 'Extra rewards for every event hosted, plus a certificate for the program.' },
];

const CAMPUS_NAMES = ['VIT Vellore', 'NIT Surathkal', 'SRM Chennai', 'BITS Pilani', 'DTU Delhi', 'Manipal', 'Christ Bengaluru', 'Symbiosis Pune'];

const WHO_CAN_APPLY = [
  { rotate: '-rotate-1', bg: '#34D399', fg: '#04231A', t: 'Full-time student in India' },
  { rotate: 'rotate-1', bg: '#FBCFE8', fg: '#3B0A28', t: 'Comfortable talking to your batch' },
  { rotate: '-rotate-2', bg: '#4F46E5', fg: '#FFFFFF', t: 'Any year, any course' },
  { rotate: 'rotate-2', bg: '#FDE68A', fg: '#3B2A03', t: 'Active in a campus group' },
];

const SOURCES = [
  { name: 'LinkedIn', color: '#0a66c2', letter: 'in', count: '184,392 live', d: 'The largest single source on the map refreshed every fifteen minutes.' },
  { name: 'Indeed', color: '#003a9b', letter: 'I', count: '92,118 live', d: 'Broad coverage across every level, from internships to leadership roles.' },
  { name: 'Google', color: '#4285f4', letter: 'G', count: '61,540 live', d: 'Aggregated listings pulled straight from Google for Jobs.' },
  { name: 'Wellfound', color: '#0a0a0a', letter: 'W', count: '21,008 live', d: 'Startup and early-stage roles with equity and stage data attached.' },
  { name: 'Zip Recruiter', color: '#3fa129', letter: 'Z', count: '14,776 live', d: 'Fast-moving listings, often filled within days of posting.' },
  { name: 'YC', color: '#ff6600', letter: 'Y', count: '3,201 live', d: 'Every open role across the current Y Combinator company batch.' },
];

const TESTIMONIAL_TINTS = ['#16a34a', '#0f9d76', '#e0714a', '#7c4dff', '#0e7490', '#c026d3', '#d946a8', '#16a34a'];
const TESTIMONIALS: [string, string, string][] = [
  ['Ananya Reddy', 'Software Engineer, Bengaluru', 'I stopped refreshing five tabs a day. The map showed me every open role in one screen.'],
  ['Rohan Verma', 'Product Manager', 'The AI match score told me exactly which roles were worth my time. Interview in nine days.'],
  ['Fatima Al Suwaidi', 'Data Analyst, Dubai', 'Built my portfolio in twenty minutes and put the link straight on my resume header.'],
  ['Karan Mehta', 'Backend Engineer', 'Tailored CVs for each application my ATS score went from 61% to 94% on the same resume.'],
  ['Priya Nair', 'UX Designer', 'No fake urgency, no "12 people applied" banners. Just the job and the apply button.'],
  ['Omar Khan', 'DevOps Engineer, Abu Dhabi', 'The tracker is the only reason I actually know where I stand with each application.'],
  ['Ishaan Kapoor', 'Frontend Lead', 'Twelve boards, one map. I found a role that Indeed never even showed me.'],
  ['Sana Sheikh', 'Growth Marketer', 'The fifteen-minute refresh matters I applied to a listing that was six minutes old.'],
];

const FAQS: { q: string; a: string }[] = [
  { q: 'Where do these jobs actually come from?', a: "We crawl twelve major job boards (LinkedIn, Indeed, ZipRecruiter, etc.) and direct company career pages every fifteen minutes. If it's live on the internet, it's on the map." },
  { q: 'Will the price change later?', a: "Kaamlee is priced at ₹99/mo or ₹299 for 3 months. There are no hidden tiers or surprise upgrades the plan you pick unlocks everything, and you can cancel anytime." },
  { q: 'How does full access work right now?', a: "Every feature is unlocked for all users on either the ₹99/mo or ₹299/3mo plan. As we roll out premium features (AI matching, Auto-apply, Resume builder, and more), they'll be included at no extra cost." },
  { q: 'How does the AI resume matching work?', a: "Once you upload your resume in your profile, our AI engine parses your technical skills, experience, and career history. It then performs a real-time semantic comparison against every job listing to give you a personalized match percentage." },
  { q: 'How fresh is the data on the map?', a: "Our crawlers operate on a 15-minute refresh cycle. When a job is taken down or filled, it's purged from our system within the hour so you're never applying to ghost listings." },
  { q: 'Can I use Kaamlee on my phone?', a: 'Yes. The platform is fully responsive and optimized for mobile browsers. You can scout the map on the go, with everything synced to your desktop account.' },
];

const PLAN_FEATURES = [
  'Unlimited job listings',
  'Location & country filters',
  'Job role filters',
  'Map view',
  'Bookmark jobs',
  'Billing history',
  'Resume & CV builder',
  'Personalised portfolio builder',
];

const PLANS = [
  {
    name: 'Free',
    price: 0, durationLabel: '/ forever',
    sub: 'Browse the map, no card required.',
    features: [
      { label: 'Unlimited Jobs', included: false },
      { label: 'Most recent 200 listings', included: true },
      { label: 'Map view', included: true },
      { label: 'Bookmark jobs', included: true },
      { label: 'Location & country filters', included: false },
      { label: 'Job role filters', included: false },
      { label: 'Resume & CV builder', included: false },
      { label: 'Personalised portfolio builder', included: false },
    ],
    cta: 'Browse free', popular: false, dark: false, action: 'explore' as const,
  },
  {
    name: '1 Month',
    price: 99, durationLabel: '/ month',
    sub: 'Pay monthly, cancel anytime.',
    features: PLAN_FEATURES,
    cta: 'Get started', popular: true, dark: true, badge: 'Popular', action: 'pricing' as const,
  },
  {
    name: '3 Months',
    price: 299, durationLabel: '/ 3 months',
    sub: 'Pay once, skip the monthly renewal.',
    features: PLAN_FEATURES,
    cta: 'Get started', popular: false, dark: false, action: 'pricing' as const,
  },
];

function FAQItem({ faq, isOpen, onToggle }: { faq: { q: string; a: string }; isOpen: boolean; onToggle: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState('0px');
  useEffect(() => {
    if (isOpen && bodyRef.current) setMaxH(`${bodyRef.current.scrollHeight}px`);
    else setMaxH('0px');
  }, [isOpen]);
  return (
    <div
      className="overflow-hidden rounded-[20px] border bg-white transition-shadow duration-400"
      style={{
        borderColor: isOpen ? 'rgba(22,163,74,0.22)' : 'rgba(61,61,61,0.08)',
        boxShadow: isOpen ? '0 2px 4px rgba(16,18,26,.04), 0 18px 40px -18px rgba(16,18,26,.22)' : 'none',
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-4 px-6 py-[22px] text-left text-[16px] sm:text-[17px] font-medium tracking-[-0.02em] text-[#0b0b0c] cursor-pointer"
      >
        {faq.q}
        <span
          className="ml-auto grid h-[30px] w-[30px] flex-none place-items-center rounded-full border transition-all duration-450"
          style={{
            transform: isOpen ? 'rotate(135deg)' : 'none',
            background: isOpen ? '#16a34a' : 'transparent',
            color: isOpen ? '#fff' : '#0b0b0c',
            borderColor: isOpen ? '#16a34a' : 'rgba(61,61,61,0.12)',
          }}
        >
          <Plus size={14} strokeWidth={2.4} />
        </span>
      </button>
      <div ref={bodyRef} style={{ maxHeight: maxH, transition: `max-height 500ms ${EASE_OUT}`, overflow: 'hidden' }}>
        <p className="max-w-[66ch] px-6 pb-6 text-[15px] leading-relaxed text-[rgba(61,61,61,0.72)]">{faq.a}</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [navStuck, setNavStuck] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [activeAboutSub, setActiveAboutSub] = useState<'solutions' | 'features' | null>(null);
  const [mobileAboutOpen, setMobileAboutOpen] = useState(false);
  const aboutRef = useRef<HTMLDivElement>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [cityIndex, setCityIndex] = useState(0);
  const [prevCityIndex, setPrevCityIndex] = useState(0);
  const [cityCardVisible, setCityCardVisible] = useState(true);
  const [arcProgress, setArcProgress] = useState(1);
  const cityIndexRef = useRef(0);
  const dashRef = useRef<HTMLDivElement>(null);

  const handleExploreClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!user) router.push('/login');
    else router.push('/explore');
  };

  useEffect(() => {
    const cachedJobs = getCached('recent-jobs');
    if (cachedJobs) {
      setRecentJobs(cachedJobs);
    } else {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/recent-jobs/`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setCache('recent-jobs', data);
            setRecentJobs(data);
          } else {
            setRecentJobs([]);
          }
        })
        .catch(() => {});
    }

    const cachedStats = getCached('stats');
    if (cachedStats) {
      setStats(cachedStats);
    } else {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stats/`)
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error && !data.detail) {
            setCache('stats', data);
            setStats(data);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setNavStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!aboutOpen) {
      setActiveAboutSub(null);
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      if (aboutRef.current && !aboutRef.current.contains(e.target as Node)) setAboutOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setAboutOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [aboutOpen]);

  useEffect(() => {
    if (!dashRef.current || !window.matchMedia('(min-width:900px)').matches) return;
    let raf: number | null = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        if (!dashRef.current) return;
        const r = dashRef.current.getBoundingClientRect();
        const p = Math.min(Math.max((window.innerHeight - r.top) / window.innerHeight, 0), 1.6);
        const deg = Math.max(0, (1 - p) * 9);
        dashRef.current.style.transform = `rotateX(${deg.toFixed(2)}deg) translateZ(0)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    cityIndexRef.current = cityIndex;
  }, [cityIndex]);

  useEffect(() => {
    let raf: number | null = null;
    const timer = setInterval(() => {
      setCityCardVisible(false);
      setTimeout(() => {
        setPrevCityIndex(cityIndexRef.current);
        setCityIndex((i) => (i + 1) % MAP_MARKERS.length);
        setCityCardVisible(true);

        setArcProgress(0);
        const start = performance.now();
        const dur = 2200;
        const tick = (now: number) => {
          const p = Math.min((now - start) / dur, 1);
          setArcProgress(p);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, 900);
    }, 3200);
    return () => {
      clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const totalJobsLabel = stats?.total_jobs ? Number(stats.total_jobs) : 42800;
  const marqueeJobs = (Array.isArray(recentJobs) && recentJobs.length ? [...recentJobs, ...recentJobs] : []).slice(0, 24);
  const sidebarJobs = Array.isArray(recentJobs) ? recentJobs.slice(0, 10) : [];

  return (
    <main
      className="min-h-screen overflow-x-clip bg-[#f2f3f5] text-[16px] leading-[1.55] tracking-[-0.01em] text-[#0b0b0c] antialiased selection:bg-[#16a34a] selection:text-white"
      style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
    >
      {/* ============ NAV ============ */}
      <div className="fixed inset-x-0 top-[14px] z-[80] flex justify-center px-5">
        <nav
          className={`flex w-full items-center gap-4 rounded-[22px] py-[10px] pl-[14px] pr-[10px] backdrop-blur-2xl transition-[max-width,background,box-shadow] duration-500 ease-out ${navStuck ? 'max-w-[1400px]' : 'max-w-[920px]'}`}
          style={{
            background: navStuck ? 'rgba(252,252,253,.86)' : 'rgba(250,250,250,.72)',
            border: '1px solid rgba(61,61,61,.10)',
            boxShadow: navStuck
              ? '0 1px 0 rgba(255,255,255,.7) inset, 0 16px 40px -22px rgba(16,18,26,.5)'
              : '0 1px 0 rgba(255,255,255,.7) inset',
          }}
        >
          <Link href="#top" className="flex items-center gap-[10px] whitespace-nowrap text-[19px] font-semibold tracking-[-0.03em]">
            <BrandMark size={38} />
            <span className="uppercase tracking-[0.15em] text-[16px] sm:text-[18px]">Kaamlee</span>
          </Link>

          <div className="ml-[18px] hidden items-center gap-1 md:flex">
            <div className="relative" ref={aboutRef}>
              <button
                onClick={() => setAboutOpen((v) => !v)}
                aria-expanded={aboutOpen}
                className="group relative inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-[14px] py-[9px] text-[15px] text-[#3d3d3d] transition-colors duration-200 hover:bg-black/5 hover:text-[#0b0b0c]"
              >
                About
                <ChevronDown size={14} className={`transition-transform duration-300 ${aboutOpen ? 'rotate-180' : ''}`} />
              </button>
              <div
                className="absolute left-0 top-[calc(100%+11px)] w-[300px] rounded-[20px] border border-black/[0.08] bg-white p-2 shadow-[0_30px_80px_-30px_rgba(16,18,26,.35)] transition-all duration-250"
                style={{
                  opacity: aboutOpen ? 1 : 0,
                  transform: aboutOpen ? 'translateY(0)' : 'translateY(-8px)',
                  pointerEvents: aboutOpen ? 'auto' : 'none',
                }}
              >
                <span className="block px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-[0.1em] text-black/40">About Kaamlee</span>
                {ABOUT_LINKS.map((l) => (
                  <div
                    key={l.href}
                    className="relative"
                    onMouseEnter={() => l.subKey && setActiveAboutSub(l.subKey)}
                    onMouseLeave={() => l.subKey && setActiveAboutSub((k) => (k === l.subKey ? null : k))}
                  >
                    <a href={l.href} onClick={() => setAboutOpen(false)} className="flex items-center gap-2 rounded-[14px] p-3 text-left transition-colors hover:bg-[#fafafa]">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-medium text-[#0b0b0c]">{l.label}</span>
                        <span className="block text-[12.5px] text-[rgba(61,61,61,0.72)]">{l.desc}</span>
                      </span>
                      {l.subKey && <ChevronRight size={14} className="hidden flex-none text-black/25 lg:block" />}
                    </a>

                    {l.subKey && (
                      <div
                        className="absolute left-[calc(100%+10px)] top-0 hidden w-[320px] overflow-hidden rounded-[20px] border border-black/[0.08] bg-white p-2 shadow-[0_30px_80px_-30px_rgba(16,18,26,.35)] transition-all duration-200 lg:block"
                        style={{
                          opacity: activeAboutSub === l.subKey ? 1 : 0,
                          transform: activeAboutSub === l.subKey ? 'translateX(0)' : 'translateX(-8px)',
                          pointerEvents: activeAboutSub === l.subKey ? 'auto' : 'none',
                        }}
                        onMouseEnter={() => setActiveAboutSub(l.subKey)}
                        onMouseLeave={() => setActiveAboutSub(null)}
                      >
                        <span className="block px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-[0.1em] text-black/40">{l.label} in detail</span>
                        {ABOUT_SUB_DETAILS[l.subKey].map((item) => (
                          <a key={item.t} href={l.href} onClick={() => setAboutOpen(false)} className="block rounded-[14px] p-3 text-left transition-colors hover:bg-[#fafafa]">
                            <span className="block text-[13.5px] font-medium text-[#0b0b0c]">{item.t}</span>
                            <span className="block text-[12px] text-[rgba(61,61,61,0.72)]">{item.d}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} className="group relative whitespace-nowrap rounded-full px-[14px] py-[9px] text-[15px] text-[#3d3d3d] transition-colors duration-200 hover:bg-black/5 hover:text-[#0b0b0c]">
                {label}
                <span className="absolute bottom-[5px] left-[14px] right-[14px] h-[1.5px] origin-left scale-x-0 rounded bg-[#16a34a] transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {!user ? (
              <>
                <Link href="/login" className="hidden sm:inline-block whitespace-nowrap rounded-full px-4 py-[11px] text-[14px] font-medium text-[#3d3d3d] transition-colors hover:text-[#0b0b0c]">Log in</Link>
                <button onClick={handleExploreClick} className="cursor-pointer group relative hidden md:inline-flex items-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-[18px] py-[11px] text-[14px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_10px_24px_-10px_rgba(22,163,74,.85)] transition-transform duration-300 hover:-translate-y-0.5" style={{ background: 'linear-gradient(180deg,#4ade80,#16a34a 55%,#15803d)' }}>
                  Open the map <ArrowChevron />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/profile" className="flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-2 py-1.5 transition-all hover:border-black/20">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#4ade80] to-[#16a34a] text-[10px] font-bold text-white">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </span>
                  <span className="hidden sm:inline whitespace-nowrap text-xs font-medium text-[#3d3d3d]">{user?.first_name}</span>
                </Link>
                <button onClick={logout} className="text-[#3d3d3d] hover:text-[#0b0b0c] transition-colors" aria-label="Log out">
                  <LogOut size={17} />
                </button>
              </div>
            )}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
              className="grid h-[42px] w-[42px] flex-none place-items-center rounded-xl border border-black/[0.08] bg-white md:hidden"
            >
              {mobileOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
            </button>
          </div>
        </nav>
      </div>

      <div
        className="fixed inset-x-5 top-[78px] z-[79] overflow-hidden rounded-[24px] border border-black/[0.08] bg-white p-[14px] shadow-[0_30px_80px_-30px_rgba(16,18,26,.35)] transition-all duration-350 md:hidden"
        style={{
          opacity: mobileOpen ? 1 : 0,
          transform: mobileOpen ? 'none' : 'translateY(-12px) scale(0.98)',
          pointerEvents: mobileOpen ? 'auto' : 'none',
        }}
      >
        <button
          onClick={() => setMobileAboutOpen((v) => !v)}
          aria-expanded={mobileAboutOpen}
          className="flex w-full cursor-pointer items-center justify-between rounded-2xl px-3 py-[14px] text-[17px] text-[#3d3d3d] hover:bg-[#fafafa] hover:text-[#0b0b0c]"
        >
          About
          <ChevronDown size={16} className={`transition-transform duration-300 ${mobileAboutOpen ? 'rotate-180' : ''}`} />
        </button>
        <div style={{ maxHeight: mobileAboutOpen ? '400px' : '0px', overflow: 'hidden', transition: `max-height 400ms ${EASE_OUT}` }}>
          <div className="flex flex-col gap-1 py-1">
            <span className="block px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-[0.1em] text-black/40">About Kaamlee</span>
            {ABOUT_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => { setMobileOpen(false); setMobileAboutOpen(false); }} className="block rounded-2xl px-3 py-3 hover:bg-[#fafafa]">
                <span className="block text-[15px] font-medium text-[#0b0b0c]">{l.label}</span>
                <span className="block text-[12.5px] text-[rgba(61,61,61,0.72)]">{l.desc}</span>
              </a>
            ))}
          </div>
        </div>
        {NAV_LINKS.map(([href, label]) => (
          <a key={href} href={href} onClick={() => setMobileOpen(false)} className="block rounded-2xl px-3 py-[14px] text-[17px] text-[#3d3d3d] hover:bg-[#fafafa] hover:text-[#0b0b0c]">
            {label}
          </a>
        ))}
        {!user && (
          <button
            onClick={(e) => { setMobileOpen(false); handleExploreClick(e); }}
            className="cursor-pointer mt-2 flex w-full items-center justify-center gap-2 rounded-full py-[15px] text-[15.5px] font-medium text-white"
            style={{ background: 'linear-gradient(180deg,#4ade80,#16a34a 55%,#15803d)' }}
          >
            Open the map <ArrowChevron />
          </button>
        )}
      </div>

      {/* ============ HERO ============ */}
      <header id="top" className="relative overflow-clip pt-[126px] sm:pt-[140px]">
        <div className="pointer-events-none absolute left-1/2 top-[-120px] h-[420px] w-[620px] -translate-x-1/2 rounded-full opacity-55 blur-[90px]" style={{ background: 'radial-gradient(circle, rgba(22,163,74,.22), transparent 65%)' }} />
        <div className="sticky top-[140px] z-0 mx-auto flex w-[min(1400px,calc(100%-40px))] flex-col items-center gap-6 text-center sm:top-[112px]">
          <Reveal className="flex flex-col items-center gap-2.5 sm:hidden">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/75 px-[16px] py-[9px] text-[13.5px] text-[#3d3d3d] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] backdrop-blur-md">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#16a34a]/10 px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a] animate-pulse" />
              </span>
              <span className="whitespace-nowrap"><b className="font-medium text-[#0b0b0c]"><Counter target={totalJobsLabel} className="tabular-nums" /></b> jobs added this week</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/75 px-[16px] py-[9px] text-[13.5px] font-medium text-[#0b0b0c] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] backdrop-blur-md">
              <CheckCircle2 size={14} className="text-[#16a34a]" /> <span className="whitespace-nowrap">Live · refreshed every 15 min</span>
            </div>
          </Reveal>

          <Reveal className="hidden sm:block">
            <div className="inline-flex items-center gap-3 rounded-full border border-black/[0.08] bg-white/75 px-[18px] py-[9px] text-[14.5px] text-[#3d3d3d] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] backdrop-blur-md">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#16a34a]/10 px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a] animate-pulse" />
              </span>
              <span><b className="font-medium text-[#0b0b0c]"><Counter target={totalJobsLabel} className="tabular-nums" /></b> jobs added this week</span>
              <span className="h-[15px] w-px bg-black/10" />
              <span className="inline-flex items-center gap-1.5 font-medium text-[#0b0b0c]">
                <CheckCircle2 size={14} className="text-[#16a34a]" /> Live · refreshed every 15 min
              </span>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="max-w-[15ch] text-[38px] leading-[1.06] tracking-[-0.045em] sm:text-[52px] md:text-[64px] lg:text-[74px]">
              Job applying is <span className="italic font-normal">a job.</span>
            </h1>
          </Reveal>

          <Reveal delay={180}>
            <p className="max-w-[60ch] text-[16px] leading-relaxed text-[rgba(61,61,61,0.72)] sm:text-[18.5px]">
              We aggregates role from twelve job boards into one map, scores each one against your resume, and gives you a tracker, tailored CVs and a portfolio to show for it.
            </p>
          </Reveal>

          <Reveal delay={280} className="mt-1.5 flex flex-col items-center gap-3 sm:flex-row">
            <button onClick={handleExploreClick} className="group relative inline-flex items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-full px-[26px] py-[15px] text-[15.5px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_10px_24px_-10px_rgba(22,163,74,.85)] transition-transform duration-300 hover:-translate-y-0.5">
              <span className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(180deg,#4ade80,#16a34a 55%,#15803d)' }} />
              <span className="cursor-pointer pointer-events-none absolute inset-y-0 left-[-60%] w-[45%] -skew-x-[18deg] bg-gradient-to-r from-transparent via-white/45 to-transparent animate-[awlShine_3.6s_cubic-bezier(.22,.61,.36,1)_infinite]" />
              Open the map <ArrowChevron />
            </button>
            <button onClick={() => setIsPricingOpen(true)} className="inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border border-black/[0.10] bg-white px-[26px] py-[15px] text-[15.5px] font-medium shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]">
              From ₹99/month
            </button>
          </Reveal>

          <Reveal delay={340} className="mt-5 flex items-center gap-3">
            <span className="flex -space-x-2.5">
              {[['AR', '#dcfce7', '#16a34a'], ['KM', '#dbeafe', '#2563eb'], ['SD', '#fef3c7', '#c08a12']].map(([initials, bg, text]) => (
                <span key={initials} className="grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[11px] font-semibold" style={{ background: bg, color: text }}>{initials}</span>
              ))}
              <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#0b0b0c] text-[10px] font-semibold text-white">+9k</span>
            </span>
            <p className="text-[14px] text-[rgba(61,61,61,0.72)]">
              <b className="font-medium text-[#0b0b0c]"><Counter target={14000} className="tabular-nums" />+</b> offers landed
            </p>
          </Reveal>
        </div>

        {/* dashboard mockup scrolls up and over the sticky hero text above */}
        <Reveal type="scale" delay={380} className="relative z-10 mx-auto mt-12 w-[min(1400px,calc(100%-40px))] bg-[#f2f3f5] sm:mt-16" style={{ perspective: '1600px' }}>
          <div ref={dashRef} className="relative overflow-hidden rounded-t-[22px] border border-b-0 border-black/[0.08] bg-white shadow-[0_30px_80px_-30px_rgba(16,18,26,.35)]" style={{ transformStyle: 'preserve-3d' }}>
            {/* browser chrome */}
            <div className="relative flex items-center justify-center border-b border-black/[0.08] px-4 py-3.5">
              <span className="absolute left-4 flex items-center gap-1.5 sm:left-[18px]">
                <span className="h-2.5 w-2.5 rounded-full border border-black/[0.08]" />
                <span className="h-2.5 w-2.5 rounded-full border border-black/[0.08]" />
                <span className="h-2.5 w-2.5 rounded-full border border-black/[0.08]" />
              </span>
              <span className="rounded-full border border-black/[0.08] bg-[#fafafa] px-5 py-1.5 text-[13px] text-black/45">kaamlee.com/map</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
              {/* results sidebar */}
              <aside className="flex h-[420px] flex-col border-black/[0.08] sm:h-[520px] md:border-r">
                <div className="flex flex-none flex-col gap-3.5 p-4 pb-3.5 sm:p-[18px] sm:pb-3.5">
                  <span className="flex items-center gap-2.5 rounded-[11px] border border-black/[0.08] bg-[#fafafa] px-3.5 py-2.5 text-[13px] text-black/55">
                    <Search size={14} className="flex-none" /> Frontend engineer · worldwide
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-[12px] font-medium text-[#16a34a]">0–2 yrs</span>
                    <span className="rounded-full border border-black/[0.10] px-3 py-1 text-[12px] text-black/60">Remote ok</span>
                    <span className="rounded-full border border-black/[0.10] px-3 py-1 text-[12px] text-black/60">₹12L+</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-3.5 sm:px-[18px]">
                  <div className="flex flex-col gap-2.5">
                    {sidebarJobs.length === 0
                      ? Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2.5 rounded-[14px] border border-black/[0.08] bg-white p-2.5">
                          <span className="h-9 w-9 flex-none animate-pulse rounded-[10px] bg-black/5" />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="h-3 w-3/4 animate-pulse rounded bg-black/5" />
                            <div className="h-2.5 w-1/2 animate-pulse rounded bg-black/5" />
                          </div>
                        </div>
                      ))
                      : sidebarJobs.map((job, i) => {
                        const tint = JOB_CARD_TINTS[i % JOB_CARD_TINTS.length];
                        const city = job.location_name ? String(job.location_name).split(',')[0] : (job.is_remote ? 'Remote' : job.country);
                        const score = pseudoScore(String(job.id ?? job.title ?? i));
                        return (
                          <Link key={job.id ?? i} href="/explore" className="flex items-center gap-2.5 rounded-[14px] border border-black/[0.08] bg-white p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]">
                            <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] text-[12.5px] font-bold" style={{ background: tint.bg, color: tint.text }}>{initialsFrom(job.company || job.title || '??')}</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13.5px] font-medium">{job.title}</div>
                              <div className="truncate text-[12px] text-black/50">{job.company} · {city}</div>
                            </div>
                            <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium ${score >= 80 ? 'bg-[#eafaf0] text-[#16a34a]' : 'bg-[#fef3c7] text-[#c08a12]'}`}>{score}%</span>
                          </Link>
                        );
                      })}
                  </div>
                </div>
                <div className="flex-none border-t border-black/[0.08] px-4 py-2.5 text-[12px] text-black/40 sm:px-[18px]">Updated 2 minutes ago</div>
              </aside>

              {/* world map */}
              <div className="relative h-[420px] overflow-hidden sm:h-[520px]">
                <MapView
                  center={[30, 15]}
                  zoom={0.7}
                  theme="light"
                  className="h-full w-full"
                  interactive={false}
                  attributionControl={false}
                >
                  {prevCityIndex !== cityIndex && (() => {
                    const from = MAP_MARKERS[prevCityIndex].coords;
                    const to = MAP_MARKERS[cityIndex].coords;
                    const curvature = 0.3;
                    const head = arcPointAt(from, to, curvature, arcProgress);
                    return (
                      <>
                        <MapArc
                          data={[{ id: 'route', from, to: head }]}
                          curvature={curvature}
                          interactive={false}
                          paint={{ 'line-color': '#16a34a', 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [0.3, 1.6] }}
                        />
                        {arcProgress < 1 && (
                          <MapMarker longitude={head[0]} latitude={head[1]}>
                            <MarkerContent>
                              <span className="relative block h-2.5 w-2.5 rounded-full border-2 border-white bg-[#16a34a] shadow-[0_0_0_4px_rgba(22,163,74,0.18)]" />
                            </MarkerContent>
                          </MapMarker>
                        )}
                      </>
                    );
                  })()}
                  {MAP_MARKERS.map((m, i) => (
                    <MapMarker key={m.name} longitude={m.coords[0]} latitude={m.coords[1]}>
                      <MarkerContent>
                        <span className="relative block">
                          {i === cityIndex && <span className="absolute inset-0 -m-1.5 animate-ping rounded-full bg-[#16a34a]/50" />}
                          <span className="relative block rounded-full border-2 border-white bg-[#16a34a] shadow-sm transition-all duration-700" style={{ width: i === cityIndex ? 12 : 7, height: i === cityIndex ? 12 : 7 }} />
                        </span>
                      </MarkerContent>
                    </MapMarker>
                  ))}
                </MapView>
                <span className="pointer-events-none absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/85 px-3 py-1.5 text-[12px] font-medium text-black/70 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] backdrop-blur-md sm:right-[18px] sm:top-[18px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a] animate-pulse" /> hiring now
                </span>
                <div
                  className="pointer-events-none absolute bottom-3 left-3 hidden w-[210px] rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)] sm:left-[18px] sm:block"
                  style={{
                    opacity: cityCardVisible ? 1 : 0,
                    transform: cityCardVisible ? 'translateY(0)' : 'translateY(10px)',
                    transition: 'opacity 900ms ease, transform 900ms ease',
                  }}
                >
                  {(() => {
                    const city = MAP_MARKERS[cityIndex];
                    const stats = cityStats(city.name);
                    return (
                      <>
                        <b className="text-[14.5px] font-medium">{city.name}</b>
                        <div className="mt-0.5 text-[12px] text-black/50">{stats.openRoles.toLocaleString()} open roles · Software</div>
                        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-[#16a34a]"><span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" /> {stats.postedToday} posted today</div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </header>

      {/* ============ TRUSTED MARQUEE (live jobs) ============ */}
      <section className="mx-auto w-[min(1400px,calc(100%-40px))] py-14 text-center sm:py-16">
        <Reveal><p className="text-[17px] font-medium tracking-[-0.02em] sm:text-[19px]">Trusted by 10,000+ job seekers worldwide.</p></Reveal>
        <Reveal delay={120} className="relative mt-8 overflow-hidden" style={{ WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)', maskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)' }}>
          <div className="flex w-max animate-[awlMarquee_38s_linear_infinite] gap-10 will-change-transform hover:[animation-play-state:paused]">
            {(marqueeJobs.length ? [...marqueeJobs, ...marqueeJobs] : Array.from({ length: 12 })).map((job, i) => (
              <span key={i} className="flex items-center gap-2.5 whitespace-nowrap text-[16px] font-medium tracking-[-0.02em] text-[#9aa0aa] grayscale transition-colors duration-300 hover:text-[#0b0b0c] hover:grayscale-0 sm:text-[19px]">
                <Briefcase size={17} className="opacity-60" />
                {job?.title || 'Senior Software Engineer'}
                <span className="text-black/25">&nbsp; &nbsp;|</span>
                
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ============ SOLUTIONS ============ */}
      <section id="solutions" className="relative px-0 pb-16">
        <div className="mx-auto w-[min(1400px,calc(100%-40px))] rounded-[34px] border border-black/[0.08] bg-white px-6 py-12 sm:px-10 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="">
              <Reveal>
                <span className="inline-flex items-center gap-2.5 rounded-full border border-dashed border-[#16a34a]/35 bg-[#16a34a]/5 py-2 pl-3 pr-4 text-[13.5px] font-medium text-[#16a34a]">
                  <i className="h-[7px] w-[7px] rounded-full bg-[#16a34a] animate-pulse" />Solutions
                </span>
              </Reveal>
              <Reveal delay={80}><h2 className="mt-5 text-[30px] tracking-[-0.035em]">Everything the job hunt needed and never had</h2></Reveal>
            </div>
            <Reveal type="right" delay={160}><p className="max-w-[46ch] text-[17px] leading-relaxed text-[rgba(61,61,61,0.72)]">One map, one AI engine, and the tools to act on what it finds cutting the manual effort out of applying.</p></Reveal>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SOLUTIONS.map((s, n) => (
              <Reveal key={s.t} delay={(n % 3) * 100}>
                <Spotlight className="h-full overflow-hidden rounded-[26px] border border-black/[0.08] bg-white p-6 transition-all duration-450 hover:-translate-y-1.5 hover:border-[#16a34a]/25 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]">
                  <span className="relative grid h-[52px] w-[52px] place-items-center rounded-[15px] border border-black/[0.08] bg-white text-[#16a34a] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] transition-transform duration-500 group-hover:-translate-y-1 group-hover:-rotate-6 group-hover:scale-105">
                    <s.icon size={22} strokeWidth={1.7} />
                  </span>
                  <h3 className="relative mt-5 text-[21px] tracking-[-0.03em]">{s.t}</h3>
                  <p className="relative mt-2.5 text-[15px] text-[rgba(61,61,61,0.72)]">{s.d}</p>
                </Spotlight>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES (BENTO) ============ */}
      <section id="features" className="relative overflow-hidden pb-16">
        <div className="relative mx-auto w-[min(1400px,calc(100%-40px))]">
          <div className="mx-auto flex flex-col items-center gap-4.5 text-center">
            <Reveal><span className="inline-flex items-center gap-2.5 rounded-full border border-dashed border-[#16a34a]/35 bg-[#16a34a]/5 py-2 pl-3 pr-4 text-[13.5px] font-medium text-[#16a34a]"><i className="h-[7px] w-[7px] rounded-full bg-[#16a34a] animate-pulse" />Features</span></Reveal>
            <Reveal delay={80}><h2 className="text-[30px] tracking-[-0.035em] sm:text-[40px] lg:text-[46px]">Tools that get application in, <br className="hidden sm:block" /> not just the job in front of you</h2></Reveal>
            <Reveal delay={160}><p className="max-w-[60ch] text-[17px] leading-relaxed text-[rgba(61,61,61,0.72)]">Every listing gets scored and every application gets tracked.</p></Reveal>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4.5 lg:grid-cols-2">
            <Reveal type="scale">
              <div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-black/[0.08] bg-white transition-all duration-450 hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]">
                <div className="relative h-[230px] overflow-hidden border-b border-black/[0.08] sm:h-[250px]" style={{ background: 'linear-gradient(180deg,#fbfcfe,#f4f6fa)' }}>
                  <div className="absolute left-[6%] right-[6%] top-[10%] rounded-[14px] border border-black/[0.08] bg-white p-4 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#ff5f57]" /><span className="h-2 w-2 rounded-full bg-[#febc2e]" /><span className="h-2 w-2 rounded-full bg-[#28c840]" />
                      </span>
                      <span className="rounded-full bg-[#16a34a]/10 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-widest text-[#16a34a]">Live</span>
                    </div>
                    <div className="mt-3.5 flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#fafafa] px-3 py-1.5 text-[10px] text-black/45">kaamlee.com/p/your-name</div>
                    <div className="mt-3.5 grid grid-cols-3 grid-rows-2 gap-2">
                      <div className="col-span-2 row-span-2 flex flex-col justify-between rounded-lg border border-black/[0.06] bg-[#f4f6fa] p-3">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#4ade80] to-[#16a34a]" />
                        <div className="space-y-1.5"><div className="h-2 w-2/3 rounded bg-black/10" /><div className="h-1.5 w-1/2 rounded bg-black/5" /></div>
                      </div>
                      <div className="rounded-lg border border-black/[0.06] bg-[#f4f6fa]" />
                      <div className="rounded-lg border border-[#16a34a]/20 bg-[#16a34a]/10" />
                    </div>
                  </div>
                  <div className="absolute bottom-[10%] left-[6%] flex animate-[awlFloaty_5.4s_cubic-bezier(.22,.61,.36,1)_infinite] gap-2">
                    {['Noir', 'Minimal', 'Bento'].map((t, i) => (
                      <span key={t} className={`rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-widest ${i === 0 ? 'border-[#16a34a]/30 bg-[#16a34a]/10 text-[#16a34a]' : 'border-black/[0.08] bg-white text-black/45'}`}>{t}</span>
                    ))}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-[21px] tracking-[-0.03em]">Portfolio, one click</h3>
                  <p className="mt-2 text-[15px] text-[rgba(61,61,61,0.72)]">Your resume becomes a public site pick a layout, pick a theme, publish a real link.</p>
                </div>
              </div>
            </Reveal>

            <Reveal type="scale" delay={120}>
              <div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-black/[0.08] bg-white transition-all duration-450 hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]">
                <div className="relative h-[230px] overflow-hidden border-b border-black/[0.08] sm:h-[250px]" style={{ background: 'linear-gradient(180deg,#fbfcfe,#f4f6fa)' }}>
                  {[
                    { role: 'Senior Backend Engineer', tmpl: 'ATS Optimized', score: 92, color: 'text-[#16a34a] border-[#16a34a]/30 bg-[#16a34a]/10', top: '10%' },
                    { role: 'Product Manager, Growth', tmpl: 'Modern', score: 68, color: 'text-[#c08a12] border-[#e8c04a]/40 bg-[#fef3c7]', top: '40%' },
                    { role: 'Data Platform Lead', tmpl: 'Classic', score: 41, color: 'text-[#dc2626] border-[#dc2626]/25 bg-[#fee2e2]', top: '70%' },
                  ].map((cv) => (
                    <div key={cv.role} className="absolute left-[6%] right-[6%] flex items-center gap-3 rounded-[14px] border border-black/[0.08] bg-white p-3 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]" style={{ top: cv.top }}>
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-[#ecfdf5] text-[#16a34a]"><FileCheck2 size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-bold">{cv.role}</div>
                        <div className="text-[9.5px] uppercase tracking-widest text-black/45">{cv.tmpl}</div>
                      </div>
                      <div className={`whitespace-nowrap rounded border px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-widest ${cv.color}`}>{cv.score}% ATS</div>
                    </div>
                  ))}
                </div>
                <div className="p-6">
                  <h3 className="text-[21px] tracking-[-0.03em]">Tailored CV generator</h3>
                  <p className="mt-2 text-[15px] text-[rgba(61,61,61,0.72)]">A fresh, ATS-scored resume for every role you target no rewriting from scratch.</p>
                </div>
              </div>
            </Reveal>
          </div>

          <div className="mt-4.5 grid grid-cols-1 gap-4.5 sm:grid-cols-3">
            <Reveal delay={60}>
              <div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-black/[0.08] bg-white transition-all duration-450 hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]">
                <div className="relative h-[190px] overflow-hidden sm:h-[210px]" style={{ background: 'linear-gradient(180deg,#fbfcfe,#f4f6fa)' }}>
                  <div className="absolute left-[8%] right-[8%] top-[14%] flex items-center gap-2.5 rounded-[14px] border border-black/[0.08] bg-white p-3.5">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-[11px] border border-black/[0.08] bg-[#fafafa] text-[rgba(61,61,61,0.72)]"><Bell size={15} /></span>
                    <div className="flex-1"><div className="h-2 w-3/4 rounded bg-black/10" /><div className="mt-1.5 h-2 w-1/2 rounded bg-black/5" /></div>
                    <span className="text-[11.5px] text-[#16a34a]">New match</span>
                  </div>
                  <div className="absolute left-[8%] right-[8%] top-[54%] flex animate-[awlFloaty_5s_cubic-bezier(.22,.61,.36,1)_infinite] items-center gap-2.5 rounded-[14px] border border-black/[0.08] bg-white p-3.5">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-[11px] border border-black/[0.08] bg-[#fafafa] text-[rgba(61,61,61,0.72)]"><Clock size={15} /></span>
                    <div className="flex-1"><div className="h-2 w-2/3 rounded bg-black/10" /><div className="mt-1.5 h-2 w-1/2 rounded bg-black/5" /></div>
                    <span className="text-[11.5px] text-[#16a34a]">2 min</span>
                  </div>
                </div>
                <div className="p-6"><h3 className="text-[21px] tracking-[-0.03em]">Smart job alerts</h3><p className="mt-2 text-[15px] text-[rgba(61,61,61,0.72)]">Pinged the moment a new listing matches your resume.</p></div>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-black/[0.08] bg-white transition-all duration-450 hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]">
                <div className="relative h-[190px] overflow-hidden sm:h-[210px]" style={{ background: 'linear-gradient(180deg,#fbfcfe,#f4f6fa)' }}>
                  <div className="absolute inset-[14%] rounded-[14px] border border-black/[0.08] bg-white p-4">
                    <div className="text-[12.5px] text-black/55">Match Score</div>
                    <div className="mt-0.5 text-[28px] font-medium tracking-[-0.04em] sm:text-[30px]"><Counter target={94} suffix=".7%" /></div>
                    <svg viewBox="0 0 260 70" className="mt-2 h-[60px] w-full sm:h-[70px]">
                      <path d="M4 58 46 42 88 50 130 20 172 30 214 12 254 22" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="330" className="animate-[awlDraw2_2.6s_cubic-bezier(.22,.61,.36,1)_infinite]" />
                      <circle cx="130" cy="20" r="5" fill="#fff" stroke="#16a34a" strokeWidth="2.5" />
                    </svg>
                  </div>
                </div>
                <div className="p-6"><h3 className="text-[21px] tracking-[-0.03em]">Match analytics</h3><p className="mt-2 text-[15px] text-[rgba(61,61,61,0.72)]">See exactly how your resume stacks up against every listing.</p></div>
              </div>
            </Reveal>

            <Reveal delay={240}>
              <div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-black/[0.08] bg-white transition-all duration-450 hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]">
                <div className="relative h-[190px] overflow-hidden sm:h-[210px]" style={{ background: 'linear-gradient(180deg,#fbfcfe,#f4f6fa)' }}>
                  <div className="absolute inset-x-[8%] top-[15%] flex items-center gap-2.5 rounded-[14px] border border-black/[0.08] bg-white p-3.5">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-[11px] border border-black/[0.08] bg-[#fafafa] text-[rgba(61,61,61,0.72)]"><Kanban size={15} /></span>
                    <div className="flex-1"><div className="h-2 w-1/2 rounded bg-black/10" /><div className="mt-1.5 h-2 w-2/3 rounded bg-black/5" /></div>
                    <span className="text-[11.5px] text-[#16a34a]">Offered</span>
                  </div>
                  <div className="absolute inset-x-[8%] bottom-[12%] flex justify-center gap-2 rounded-[14px] border border-black/[0.08] bg-white p-2.5 text-[12px] text-black/55">
                    {['Saved', 'Applied', 'Interview', 'Offer'].map((s, i) => (
                      <span key={s} className={`rounded-lg px-2.5 py-1 ${i === 3 ? 'bg-[#fafafa] text-[#0b0b0c]' : ''}`}>{s}</span>
                    ))}
                  </div>
                </div>
                <div className="p-6"><h3 className="text-[21px] tracking-[-0.03em]">Application tracker</h3><p className="mt-2 text-[15px] text-[rgba(61,61,61,0.72)]">Every role you save lands on a drag-and-drop board automatically.</p></div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ AUTOMATION ROWS ============ */}
      <section className="pb-16">
        <div className="mx-auto w-[min(1400px,calc(100%-40px))]">
          <div className="mx-auto flex flex-col items-center gap-4.5 text-center">
            <Reveal><span className="inline-flex items-center gap-2.5 rounded-full border border-dashed border-[#16a34a]/35 bg-[#16a34a]/5 py-2 pl-3 pr-4 text-[13.5px] font-medium text-[#16a34a]"><i className="h-[7px] w-[7px] rounded-full bg-[#16a34a] animate-pulse" />AI Automation</span></Reveal>
            <Reveal delay={80}><h2 className="text-[30px] tracking-[-0.035em]">Built to remove the manual work of applying, permanently</h2></Reveal>
          </div>

          <div className="mt-11 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
            <Reveal type="left">
              <article className="relative h-full overflow-hidden rounded-[34px] border border-black/[0.08] p-7 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)] sm:p-9" style={{ background: 'linear-gradient(170deg,#f7f8fd,#fff)' }}>
                <h3 className="max-w-[19ch] text-[24px] tracking-[-0.03em] sm:text-[26px]">Faster from discovery to apply</h3>
                <p className="mt-3 max-w-[44ch] text-[15.5px] text-[rgba(61,61,61,0.72)]">Time Optimizer watches every match you get, flags where you&apos;re stalling and tells you exactly where to focus next.</p>
                <a href="#pricing" className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-black/[0.10] bg-white px-[18px] py-[11px] text-[14px] font-medium shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] transition-transform hover:-translate-y-0.5">View details <ArrowChevron /></a>
                <div className="mt-6 rounded-[20px] border border-black/[0.08] bg-white p-4.5 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] border border-black/[0.08] bg-[#fafafa] text-[rgba(61,61,61,0.72)]"><Clock size={17} /></span>
                    <div><b className="text-[15px] font-medium">Time Optimizer</b><div className="text-[13px] text-[rgba(61,61,61,0.72)]">AI-driven pipeline analysis</div></div>
                  </div>
                  <div className="mt-3.5 flex items-center gap-2.5 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3.5 py-3 text-[13.5px] text-[#8a6a12]">💡 Cut time-to-apply by 40% with instant match scoring</div>
                  <div className="mt-3.5 grid grid-cols-2 gap-3">
                    <div className="rounded-[14px] border border-black/[0.08] bg-[#fafafa] p-3.5">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#ecfdf5] text-[#16a34a]"><Search size={15} /></span>
                      <b className="mt-2.5 block text-[14px] font-medium">Job Discovery</b><small className="text-[12.5px] text-black/55">2.5 min average</small>
                    </div>
                    <div className="rounded-[14px] border border-black/[0.08] bg-[#fafafa] p-3.5">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#ecfdf5] text-[#16a34a]"><Sparkles size={15} /></span>
                      <b className="mt-2.5 block text-[14px] font-medium">AI Matching</b><small className="text-[12.5px] text-black/55">8.2 sec average</small>
                    </div>
                  </div>
                  <FillBar target={78} className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-[#eceff5]" barClassName="h-full rounded-full" />
                </div>
              </article>
            </Reveal>

            <Reveal type="right" delay={120}>
              <article className="relative h-full overflow-hidden rounded-[34px] border border-black/[0.08] p-7 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)] sm:p-9" style={{ background: 'linear-gradient(170deg,#fdfaf7,#fff)' }}>
                <h3 className="max-w-[19ch] text-[24px] tracking-[-0.03em] sm:text-[26px]">AI-tailored CVs, parsed in seconds</h3>
                <p className="mt-3 max-w-[44ch] text-[15.5px] text-[rgba(61,61,61,0.72)]">The CV agent reads the job description, reweights your resume around it, and scores the result against an ATS the moment you ask.</p>
                <a href="#pricing" className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-black/[0.10] bg-white px-[18px] py-[11px] text-[14px] font-medium shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] transition-transform hover:-translate-y-0.5">View details <ArrowChevron /></a>
                <div className="mt-6 rounded-[20px] border border-black/[0.08] bg-white p-4.5 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] border border-black/[0.08] bg-[#fafafa] text-[rgba(61,61,61,0.72)]"><FileCheck2 size={17} /></span>
                    <div className="flex-1"><b className="text-[15px] font-medium">Resume_Ananya_R.pdf</b><div className="text-[13px] text-[rgba(61,61,61,0.72)]">Parsed 18 fields · 0 errors</div></div>
                    <span className="text-[12px] text-[#16a34a]">Routed</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 border-t border-black/[0.08] pt-3">
                    <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] border border-black/[0.08] bg-[#fafafa] text-[rgba(61,61,61,0.72)]"><FileCheck2 size={17} /></span>
                    <div className="flex-1"><b className="text-[15px] font-medium">Senior_PM_Google.json</b><div className="text-[13px] text-[rgba(61,61,61,0.72)]">Tailored to JD · sent for review</div></div>
                    <span className="text-[12px] text-[#16a34a]">Parsing</span>
                  </div>
                  <FillBar target={62} className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-[#eceff5]" barClassName="h-full rounded-full" />
                  <div className="mt-3.5 grid grid-cols-2 gap-3">
                    <div className="rounded-[14px] border border-black/[0.08] bg-[#fafafa] p-3.5"><b className="text-[14px] font-medium">Accuracy</b><small className="block text-[12.5px] text-black/55">99.2% ATS match</small></div>
                    <div className="rounded-[14px] border border-black/[0.08] bg-[#fafafa] p-3.5"><b className="text-[14px] font-medium">Throughput</b><small className="block text-[12.5px] text-black/55">1.4k CVs / day</small></div>
                  </div>
                </div>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ SOURCES ============ */}
      <section id="sources" className="pb-16">
        <div className="mx-auto w-[min(1400px,calc(100%-40px))] rounded-[34px] border border-black/[0.08] bg-white px-6 py-12 sm:px-10 sm:py-16">
          <div className="mx-auto flex flex-col items-center gap-4.5 text-center">
            <Reveal><span className="inline-flex items-center gap-2.5 rounded-full border border-dashed border-[#16a34a]/35 bg-[#16a34a]/5 py-2 pl-3 pr-4 text-[13.5px] font-medium text-[#16a34a]"><i className="h-[7px] w-[7px] rounded-full bg-[#16a34a] animate-pulse" />Sources</span></Reveal>
            <Reveal delay={80}><h2 className="text-[30px] tracking-[-0.035em]">Twelve job boards. One map.</h2></Reveal>
            <Reveal delay={160}><p className="max-w-[52ch] leading-relaxed text-[rgba(61,61,61,0.72)]">These are the busiest of the twelve boards <br className="hidden sm:block" /> we crawl every fifteen minutes — no account needed to browse.</p></Reveal>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
            {SOURCES.map((o, n) => (
              <Reveal key={o.name} delay={(n % 3) * 100}>
                <div className="flex h-full flex-col gap-3.5 rounded-[26px] border border-black/[0.08] bg-white p-6 transition-all duration-450 hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]">
                  <div className="flex items-center gap-3.5">
                    <span className="grid h-[46px] w-[46px] flex-none place-items-center rounded-2xl text-[17px] font-semibold text-white transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105" style={{ background: o.color, color: o.color === '#ffe01b' ? '#111' : '#fff' }}>{o.letter}</span>
                    <div><h4 className="text-[18px] font-medium tracking-[-0.025em]">{o.name}</h4><span className="text-[13px] text-[rgba(61,61,61,0.72)]">{o.count}</span></div>
                  </div>
                  <p className="flex-1 text-[14.5px] text-[rgba(61,61,61,0.72)]">{o.d}</p>
                  <button onClick={handleExploreClick} className="cursor-pointer group inline-flex w-fit items-center gap-2 self-start rounded-full border border-black/[0.10] bg-white px-[18px] py-2.5 text-[14px] transition-all hover:border-[#0b0b0c] hover:bg-[#0b0b0c] hover:text-white">
                    View jobs <ArrowChevron />
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ STEPS ============ */}
      <section className="relative overflow-hidden pb-16">
        <div className="relative mx-auto w-[min(1400px,calc(100%-40px))]">
          <div className="mx-auto flex flex-col items-center gap-4.5 text-center">
            <Reveal><span className="inline-flex items-center gap-2.5 rounded-full border border-dashed border-[#16a34a]/35 bg-[#16a34a]/5 py-2 pl-3 pr-4 text-[13.5px] font-medium text-[#16a34a]"><i className="h-[7px] w-[7px] rounded-full bg-[#16a34a] animate-pulse" />How it works</span></Reveal>
            <Reveal delay={80}><h2 className="text-[30px] tracking-[-0.035em]">From twelve tabs to one, in about ninety seconds</h2></Reveal>
            <Reveal delay={160}><p className="leading-relaxed text-[rgba(61,61,61,0.72)]">No setup, no account required to look around connect a resume only when you&apos;re ready for match scores.</p></Reveal>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4.5 sm:grid-cols-3">
            {[
              { n: '01', t: 'We crawl, so you sleep', d: 'Twelve job boards, polled every fifteen minutes. Listings fingerprinted the moment they go live.', w: 100 },
              { n: '02', t: 'Open the map', d: 'No infinite scroll, no fifteen filters. Pan, zoom, see roles plotted where they actually live.', w: 66 },
              { n: '03', t: 'Apply before noon', d: "One click takes you to the source posting. We don't middleman it we just made the haystack smaller.", w: 34 },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 120}>
                <article className="relative overflow-hidden rounded-[26px] border border-black/[0.08] bg-white p-7 transition-all duration-450 hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]">
                  <span className="text-[13px] font-medium tracking-[0.06em] text-[#16a34a]">STEP {s.n}</span>
                  <h3 className="mt-4 text-[22px]">{s.t}</h3>
                  <p className="mt-2.5 text-[15px] text-[rgba(61,61,61,0.72)]">{s.d}</p>
                  <FillBar target={s.w} className="absolute inset-x-[26px] bottom-0 h-0.5 overflow-hidden bg-black/[0.08]" barClassName="h-full bg-[#16a34a]" delay={i * 150} />
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FOR EMPLOYERS (B2B) ============ */}
      <section id="b2b" className="pb-16">
        <div className="mx-auto w-[min(1400px,calc(100%-40px))] rounded-[34px] border border-black/[0.08] bg-white px-6 py-12 sm:px-10 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2.5 rounded-full border border-dashed border-[#4f46e5]/35 bg-[#4f46e5]/5 py-2 pl-3 pr-4 text-[13.5px] font-medium text-[#4f46e5]">
                  <i className="h-[7px] w-[7px] rounded-full bg-[#4f46e5] animate-pulse" />For employers
                </span>
              </Reveal>
              <Reveal delay={80}><h2 className="mt-5 max-w-[20ch] text-[30px] tracking-[-0.035em]">Hire from the pool your candidates are already in</h2></Reveal>
            </div>
            <Reveal type="right" delay={160}>
              <div className="rounded-[18px] border border-black/[0.08] bg-white px-6 py-4 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
                <div className="text-[26px] font-medium tracking-[-0.02em]">2</div>
                <div className="mt-0.5 max-w-[22ch] text-[12.5px] text-[rgba(61,61,61,0.72)]">screening steps before a candidate reaches your desk</div>
              </div>
            </Reveal>
          </div>
          <Reveal delay={120}><p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-[rgba(61,61,61,0.72)]">Post roles directly into Kaamlee and recruit from the same candidate base that&apos;s already searching, matching and tracking applications on the platform, no separate job board required.</p></Reveal>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {B2B_FEATURES.map((s, n) => (
              <Reveal key={s.t} delay={(n % 4) * 90}>
                <Spotlight className="h-full overflow-hidden rounded-[22px] border border-black/[0.08] bg-white p-5 transition-all duration-450 hover:-translate-y-1.5 hover:border-[#4f46e5]/25 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]">
                  <span className="relative grid h-11 w-11 place-items-center rounded-[13px] border border-black/[0.08] bg-white text-[#4f46e5] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
                    <s.icon size={19} strokeWidth={1.7} />
                  </span>
                  <h3 className="relative mt-4 text-[16.5px] tracking-[-0.02em]">{s.t}</h3>
                  <p className="relative mt-2 text-[13.5px] text-[rgba(61,61,61,0.72)]">{s.d}</p>
                </Spotlight>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200} className="mt-8 flex flex-wrap items-center gap-3.5">
            <a href="mailto:kaamlee2026@gmail.com?subject=Employer%20interest%20-%20hiring%20on%20Kaamlee" className="group inline-flex items-center gap-2.5 whitespace-nowrap rounded-full px-[22px] py-[13px] text-[14.5px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_10px_24px_-10px_rgba(79,70,229,.65)] transition-transform duration-300 hover:-translate-y-0.5" style={{ background: 'linear-gradient(180deg,#6366f1,#4f46e5 55%,#4338ca)' }}>
              Talk to us about hiring <ArrowChevron />
            </a>
            <span className="text-[13px] text-[rgba(61,61,61,0.72)]">Built for teams hiring early-career and campus talent</span>
          </Reveal>
        </div>
      </section>

      {/* ============ CAMPUS AMBASSADORS ============ */}
      <section id="ambassadors" className="pb-16">
        <div className="relative mx-auto w-[min(1400px,calc(100%-40px))] overflow-hidden rounded-[34px] border border-black/[0.08] bg-white px-6 py-12 sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute -right-2 -top-2 hidden h-16 w-16 opacity-90 lg:block" style={{ animation: 'awlSpin 46s linear infinite' }}>
            <div className="h-full w-full" style={{ background: '#4f46e5', clipPath: 'polygon(50% 0%,58% 32%,79% 8%,71% 38%,97% 27%,80% 50%,97% 73%,71% 62%,79% 92%,58% 68%,50% 100%,42% 68%,21% 92%,29% 62%,3% 73%,20% 50%,3% 27%,29% 38%,21% 8%,42% 32%)' }} />
          </div>

          <div className="relative flex flex-wrap items-start justify-between gap-10">
            <div className="max-w-[540px]">
              <Reveal>
                <span className="-rotate-2 inline-flex items-center gap-2 rounded-full bg-[#FDE68A] px-4 py-2 text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#7c4a03] shadow-[0_6px_16px_-8px_rgba(180,83,9,.35)]" style={{ fontFamily: 'var(--font-outfit)' }}>
                  <span className="text-[13px]">✦</span> Campus Ambassador Program
                </span>
              </Reveal>
              <Reveal delay={110}><h2 className="mt-4 text-[32px] font-semibold tracking-[-0.03em]" style={{ fontFamily: 'var(--font-outfit)' }}>Kaamlee&apos;s presence on campus, run by students</h2></Reveal>
              <Reveal delay={120}><p className="relative mt-4 max-w-[52ch] text-[16px] leading-relaxed text-[rgba(61,61,61,0.72)]">Ambassadors host events, spread the word on their campus, and drive registrations from their university. Rewards scale directly with what you bring, how many students sign up, and how many events you run.</p></Reveal>
              <Reveal delay={60}>
                <span className="-rotate-5 ml-2 mt-4 block text-[58px] leading-none text-[#d97706]" style={{ fontFamily: 'var(--font-caveat)' }}>join the crew</span>
              </Reveal>
            </div>

            <Reveal type="right" delay={140} className="relative hidden w-[360px] flex-none pt-12 xl:block">
              <svg viewBox="0 0 260 100" className="pointer-events-none absolute -top-9 left-2 h-[100px] w-[260px] overflow-visible">
                <path d="M6 50 C 46 -8 92 88 60 94 C 34 98 18 74 46 64 C 96 48 168 88 252 28" fill="none" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" />
              </svg>
              <div className="relative flex flex-col gap-2.5">
                {WHO_CAN_APPLY.map((w) => (
                  <span key={w.t} className={`rounded-full px-4 py-2.5 text-center text-[12.5px] font-semibold ${w.rotate}`} style={{ background: w.bg, color: w.fg, fontFamily: 'var(--font-outfit)' }}>{w.t}</span>
                ))}
              </div>
              <a href="mailto:kaamlee2026@gmail.com?subject=Campus%20Ambassador%20application" className="rotate-1 mt-12 inline-flex justify-center items-center gap-2 rounded-full bg-[#4ADE80] px-8 py-4 font-semibold tracking-[0.02em] text-black shadow-[0_10px_24px_-10px_rgba(74,222,128,.7)] transition-transform duration-300 hover:-translate-y-0.5" style={{ fontFamily: 'var(--font-outfit)', width: '100%'}}>
                APPLY as CAMPUS AMBASSADOR <ArrowChevron />
              </a>
            </Reveal>
          </div>

          <Reveal delay={180} className="relative mt-10 overflow-hidden rounded-full border border-black/[0.08] bg-[#fafafa] py-3" style={{ WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)', maskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)' }}>
            <div className="flex w-max animate-[awlMarquee_32s_linear_infinite] gap-8 whitespace-nowrap text-[13px] font-medium tracking-[0.02em] text-black/40">
              {[...CAMPUS_NAMES, ...CAMPUS_NAMES].map((c, i) => (
                <span key={i} className="flex items-center gap-8">{c}<span className="text-[#b45309]">✦</span></span>
              ))}
            </div>
          </Reveal>

          <div className="relative mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AMBASSADOR_FEATURES.map((s, n) => (
              <Reveal key={s.t} delay={(n % 4) * 90}>
                <div
                  className={`h-full overflow-hidden rounded-[20px] p-5 transition-all duration-400 hover:-translate-y-1.5 hover:rotate-0 hover:shadow-[0_18px_40px_-18px_rgba(16,18,26,.35)] ${s.rotate}`}
                  style={{ background: s.bg }}
                >
                  <span className="block text-[24px]" style={{ color: s.fg }}>{s.glyph}</span>
                  <h3 className="mt-4 text-[16.5px] font-semibold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-outfit)', color: s.fg }}>{s.t}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: s.fg, opacity: 0.78 }}>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section className="overflow-hidden pb-16">
        <div className="mx-auto flex w-[min(1400px,calc(100%-40px))] flex-col items-center gap-4.5 text-center">
          <Reveal><span className="inline-flex items-center gap-2.5 rounded-full border border-dashed border-[#16a34a]/35 bg-[#16a34a]/5 py-2 pl-3 pr-4 text-[13.5px] font-medium text-[#16a34a]"><i className="h-[7px] w-[7px] rounded-full bg-[#16a34a] animate-pulse" />Testimonials</span></Reveal>
          <Reveal delay={80}><h2 className="text-[30px] tracking-[-0.035em]">Trusted by job seekers who were done scrolling</h2></Reveal>
          <Reveal delay={160}><p className="leading-relaxed text-[rgba(61,61,61,0.72)]">People use Kaamlee to cut the noise out of the search and put real energy into the applications that count.</p></Reveal>
        </div>
        <Reveal delay={220} className="mt-11 flex flex-col gap-4.5" style={{ WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)', maskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)' }}>
          {[TESTIMONIALS.slice(0, 4), TESTIMONIALS.slice(4)].map((row, ri) => (
            <div key={ri} className="overflow-hidden">
              <div className={`flex w-max gap-4.5 will-change-transform hover:[animation-play-state:paused] ${ri === 0 ? 'animate-[awlMarquee_52s_linear_infinite]' : 'animate-[awlMarquee_64s_linear_infinite_reverse]'}`}>
                {[...row, ...row, ...row].map((q, i) => {
                  const initials = q[0].split(' ').map((w) => w[0]).join('');
                  const tint = TESTIMONIAL_TINTS[(ri * 4 + (i % row.length)) % TESTIMONIAL_TINTS.length];
                  return (
                    <article key={i} className="w-[300px] flex-none rounded-[22px] border border-black/[0.08] bg-white p-6 transition-all duration-400 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)] sm:w-[378px]">
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 flex-none place-items-center rounded-full text-[15px] font-semibold text-white" style={{ background: tint }}>{initials}</span>
                        <span><b className="block text-[15.5px] font-medium">{q[0]}</b><small className="text-[13px] text-black/55">{q[1]}</small></span>
                        <span className="ml-auto flex items-center gap-1.5 text-[13px] text-[rgba(61,61,61,0.72)]"><Star size={14} className="fill-[#f5b800] text-[#f5b800]" />5.0</span>
                      </div>
                      <q className="mt-4 block text-[15.5px] leading-relaxed text-[#3d3d3d]">{q[2]}</q>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="pb-16">
        <div className="mx-auto w-[min(1400px,calc(100%-40px))] rounded-[34px] border border-black/[0.08] bg-white px-6 py-12 sm:px-10 sm:py-16">
          <div className="mx-auto flex flex-col items-center gap-4.5 text-center">
            <Reveal><span className="inline-flex items-center gap-2.5 rounded-full border border-dashed border-[#16a34a]/35 bg-[#16a34a]/5 py-2 pl-3 pr-4 text-[13.5px] font-medium text-[#16a34a]"><i className="h-[7px] w-[7px] rounded-full bg-[#16a34a] animate-pulse" />Pricing</span></Reveal>
            <Reveal delay={80}><h2 className="text-[30px] tracking-[-0.035em]">Start free, upgrade when you&apos;re ready</h2></Reveal>
            <Reveal delay={160}><p className="leading-relaxed text-[rgba(61,61,61,0.72)]">Browse for free. When you want the full map and tools, pay monthly or save by paying for 3 months at once.</p></Reveal>
          </div>

          <div className="mx-auto mt-11 grid grid-cols-1 items-start gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} type={i === 0 ? 'left' : i === PLANS.length - 1 ? 'right' : 'scale'} delay={i * 110}>
                <article
                  className="relative overflow-hidden rounded-[34px] border p-7 transition-all duration-450 hover:-translate-y-1.5 sm:p-[30px]"
                  style={p.dark
                    ? { background: 'linear-gradient(180deg,#101216,#0b0b0c)', color: '#fff', borderColor: '#20232b', boxShadow: '0 30px 80px -30px rgba(16,18,26,.35)' }
                    : { borderColor: 'rgba(61,61,61,0.08)', background: '#fff' }}
                >
                  {p.badge && <span className="absolute right-[22px] top-[22px] rounded-full bg-[#16a34a]/16 px-3 py-1.5 text-[12px] text-[#9fbaff]">{p.badge}</span>}
                  <span className="inline-flex items-center gap-2.5 text-[17px] font-medium"><Tick dark={p.dark} />{p.name}</span>
                  <div className="mt-4 flex items-end gap-1.5">
                    <b className="text-[42px] font-medium tracking-[-0.045em] sm:text-[46px]">₹{p.price}</b>
                    <small className={`pb-1.5 text-[14px] ${p.dark ? 'text-white/55' : 'text-black/55'}`}>{p.durationLabel}</small>
                  </div>
                  <p className={`mt-2 text-[14.5px] ${p.dark ? 'text-white/68' : 'text-[rgba(61,61,61,0.72)]'}`}>{p.sub}</p>
                  <hr className="my-5.5" style={{ borderColor: p.dark ? 'rgba(255,255,255,0.12)' : 'rgba(61,61,61,0.08)' }} />
                  <ul className={`flex flex-col gap-3.5 text-[14.8px] ${p.dark ? 'text-white/68' : 'text-[rgba(61,61,61,0.72)]'}`}>
                    {p.features.map((f) => {
                      const label = typeof f === 'string' ? f : f.label;
                      const included = typeof f === 'string' ? true : f.included;
                      return (
                        <li key={label} className={`flex items-start gap-2.5 ${!included ? (p.dark ? 'text-white/35' : 'text-black/35') : ''}`}>
                          {included ? <Tick dark={p.dark} /> : <Cross dark={p.dark} />}
                          {label}
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    onClick={(e) => (p.action === 'explore' ? handleExploreClick(e) : setIsPricingOpen(true))}
                    className={`mt-6.5 w-full cursor-pointer rounded-full py-4 text-center text-[15.5px] font-medium transition-all ${
                      p.dark ? 'text-white shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_10px_24px_-10px_rgba(22,163,74,.85)] hover:-translate-y-0.5' : 'border border-black/[0.10] bg-white hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]'
                    }`}
                    style={p.dark ? { background: 'linear-gradient(180deg,#4ade80,#16a34a 55%,#15803d)' } : undefined}
                  >
                    {p.cta}
                  </button>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="pb-16">
        <div className="mx-auto flex w-[min(1400px,calc(100%-40px))] flex-col items-center gap-4.5 text-center">
          <Reveal><span className="inline-flex items-center gap-2.5 rounded-full border border-dashed border-[#16a34a]/35 bg-[#16a34a]/5 py-2 pl-3 pr-4 text-[13.5px] font-medium text-[#16a34a]"><i className="h-[7px] w-[7px] rounded-full bg-[#16a34a] animate-pulse" />Help &amp; support</span></Reveal>
          <Reveal delay={80}><h2 className="text-[30px] tracking-[-0.035em]">Frequently asked questions</h2></Reveal>
          <Reveal delay={160}><p className="leading-relaxed text-[rgba(61,61,61,0.72)]">How Kaamlee handles data freshness, pricing and AI matching.</p></Reveal>
        </div>
        <div className="mx-auto mt-11 flex w-[min(1400px,calc(100%-40px))] flex-col gap-3">
          {FAQS.map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <FAQItem faq={f} isOpen={openFaqIndex === i} onToggle={() => setOpenFaqIndex(openFaqIndex === i ? null : i)} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="pb-16">
        <div className="mx-auto w-[min(1400px,calc(100%-40px))]">
          <Reveal type="scale">
            <div className="relative overflow-hidden rounded-[34px] px-6 py-16 text-center text-white sm:px-8 sm:py-[84px]" style={{ background: 'linear-gradient(165deg,#141821,#0a0b0e 60%)' }}>
              <div className="pointer-events-none absolute left-1/2 top-[-60px] h-[380px] w-[640px] -translate-x-1/2 rounded-full opacity-50 blur-[90px]" style={{ background: 'radial-gradient(circle, rgba(22,163,74,.55), transparent 62%)' }} />
              <div className="pointer-events-none absolute inset-0 opacity-35">
                {[0, 2, 4].map((d) => (
                  <i key={d} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.14] animate-[awlRipple_6s_cubic-bezier(.22,.61,.36,1)_infinite]" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
              <h2 className="relative mx-auto text-[30px] tracking-[-0.03em]">Stop scrolling ten tabs. Start applying from one map.</h2>
              <p className="relative mx-auto mt-4.5 max-w-3xl text-white/68 sm:text-[16.5px]">From live listings to AI-matched roles, tailored CVs and a portfolio that gets you noticed — <br className="hidden sm:block" /> Kaamlee handles the busywork so you can focus on landing the role.</p>
              <button onClick={() => setIsPricingOpen(true)} className="cursor-pointer group relative mt-8 inline-flex items-center gap-2.5 overflow-hidden rounded-full px-[26px] py-[15px] text-[15.5px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_10px_24px_-10px_rgba(22,163,74,.85)] transition-transform duration-300 hover:-translate-y-0.5" style={{ background: 'linear-gradient(180deg,#4ade80,#16a34a 55%,#15803d)' }}>
                Get started <ArrowChevron />
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      <hr />

      {/* ============ FOOTER ============ */}
      <footer className="py-14 sm:py-[78px]">
        <div className="mx-auto w-[min(1400px,calc(100%-40px))]">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.6fr]">
            <Reveal>
              <Link href="#top" className="flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.03em]">
                <BrandMark size={38} /> <span className="uppercase tracking-[0.15em]">Kaamlee</span>
              </Link>
              <p className="mt-4 max-w-[32ch] text-[15px] text-[rgba(61,61,61,0.72)]">Kaamlee aggregates every job board into one map, matches it to your resume, and gives you a portfolio to show for it.</p>
            </Reveal>
            <Reveal delay={80}>
              <h5 className="mb-4 text-[13px] font-medium uppercase tracking-[0.1em] text-black/45">Company</h5>
              {[['#top', 'Home'], ['/explore', 'Explore'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']].map(([href, label]) => (
                <a key={label} href={href} className="block py-1.5 text-[15px] text-[rgba(61,61,61,0.72)] transition-all hover:translate-x-1 hover:text-[#0b0b0c]">{label}</a>
              ))}
            </Reveal>
            <Reveal delay={160}>
              <h5 className="mb-4 text-[13px] font-medium uppercase tracking-[0.1em] text-black/45">Product</h5>
              {[['/portfolio', 'Portfolio'], ['/custom-cv', 'Custom CV'], ['/applications', 'Applications'], ['/privacy', 'Privacy']].map(([href, label]) => (
                <Link key={label} href={href} className="block py-1.5 text-[15px] text-[rgba(61,61,61,0.72)] transition-all hover:translate-x-1 hover:text-[#0b0b0c]">{label}</Link>
              ))}
            </Reveal>
            <Reveal delay={240}>
              <h5 className="mb-4 text-[13px] font-medium uppercase tracking-[0.1em] text-black/45">Newsletter</h5>
              <p className="text-[15px] text-[rgba(61,61,61,0.72)]">New sources, AI features and product updates, roughly once a month.</p>
              <form
                onSubmit={(e) => { e.preventDefault(); setSubscribed(true); (e.target as HTMLFormElement).reset(); }}
                className="mt-4 flex gap-2"
              >
                <input type="email" required placeholder="Enter your email" aria-label="Email" className="min-w-0 flex-1 rounded-full border border-black/[0.10] bg-white px-4 py-3.5 text-[14.5px] outline-none transition-all focus:border-[#16a34a] focus:shadow-[0_0_0_4px_rgba(22,163,74,.12)]" />
                <button type="submit" className="whitespace-nowrap rounded-full bg-[#0b0b0c] px-[18px] py-3.5 text-[14px] font-medium text-white">Subscribe</button>
              </form>
              <small className="mt-2.5 block text-[#16a34a] transition-opacity duration-400" style={{ opacity: subscribed ? 1 : 0 }}>Thanks, you&apos;re on the list.</small>
            </Reveal>
          </div>
          <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-black/[0.08] pt-6 text-[14px] text-black/55">
            <span>© 2026 Kaamlee. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link href="/terms" className="hover:text-[#0b0b0c]">Terms</Link>
              <span className="text-black/30">·</span>
              <Link href="/privacy" className="hover:text-[#0b0b0c]">Privacy</Link>
              <span className="text-black/30">·</span>
              <a href="https://commhawk.in/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-[#0b0b0c]">with love <span className="text-[#0b0b0c] underline underline-offset-4">commhawk</span></a>
            </div>
          </div>
        </div>
      </footer>

      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
    </main>
  );
}

function Briefcase({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
