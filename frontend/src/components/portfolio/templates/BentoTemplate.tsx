'use client';

import { motion } from 'framer-motion';
import { Mail, Phone, Globe, ExternalLink, ArrowUpRight } from 'lucide-react';
import { GithubIcon, LinkedinIcon } from '../icons';
import type { ResumeParsed } from '../types';
import type { TemplateProps } from './ClassicTemplate';

// ─── Themes ──────────────────────────────────────────────────────────────────────
interface BentoTheme {
  dark: boolean;
  bg: string; card: string; border: string; borderHover: string;
  text: string; muted: string; faint: string;
  accent: string; accentSoft: string; accentBorder: string; accentText: string;
  grad: string; gradText: string; navBg: string;
  dot: string; bloom: string; noise: number; cardShadow: string; footerFaint: string;
}

// Structural tone (light/dark) is independent of accent hue (violet/blue) — cross them to build variants.
const TONES = {
  noir: {
    dark: true,
    bg: '#07070c',
    card: 'rgba(255,255,255,0.035)',
    border: 'rgba(255,255,255,0.08)',
    borderHover: 'rgba(255,255,255,0.14)',
    text: '#f1f1f3',
    muted: '#6b6b78',
    faint: 'rgba(255,255,255,0.05)',
    navBg: 'rgba(7,7,12,0.85)',
    dot: 'rgba(255,255,255,0.04)',
    noise: 0.025,
    cardShadow: 'none',
    footerFaint: 'rgba(255,255,255,0.1)',
  },
  minimal: {
    dark: false,
    bg: '#f7f7fb',
    card: '#ffffff',
    border: 'rgba(15,15,20,0.08)',
    borderHover: 'rgba(15,15,20,0.18)',
    text: '#0f0f14',
    muted: '#6b6b78',
    faint: 'rgba(15,15,20,0.04)',
    navBg: 'rgba(247,247,251,0.85)',
    dot: 'rgba(15,15,20,0.035)',
    noise: 0.012,
    cardShadow: '0 2px 20px rgba(15,15,20,0.05)',
    footerFaint: 'rgba(15,15,20,0.15)',
  },
} satisfies Record<string, Omit<BentoTheme, 'accent' | 'accentSoft' | 'accentBorder' | 'accentText' | 'grad' | 'gradText' | 'bloom'>>;

const ACCENTS = {
  violet: {
    grad: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 60%, #a855f7 100%)',
    noir: {
      accent: '#7c3aed', accentSoft: 'rgba(124,58,237,0.12)', accentBorder: 'rgba(124,58,237,0.3)',
      accentText: '#a78bfa', gradText: 'linear-gradient(135deg, #a78bfa, #e879f9)', bloom: 'rgba(124,58,237,0.1)',
    },
    minimal: {
      accent: '#7c3aed', accentSoft: 'rgba(124,58,237,0.08)', accentBorder: 'rgba(124,58,237,0.22)',
      accentText: '#7c3aed', gradText: 'linear-gradient(135deg, #7c3aed, #c026d3)', bloom: 'rgba(124,58,237,0.06)',
    },
  },
  blue: {
    grad: 'linear-gradient(135deg, #38bdf8 0%, #3b82f6 60%, #6366f1 100%)',
    noir: {
      accent: '#3b82f6', accentSoft: 'rgba(59,130,246,0.12)', accentBorder: 'rgba(59,130,246,0.3)',
      accentText: '#93c5fd', gradText: 'linear-gradient(135deg, #93c5fd, #67e8f9)', bloom: 'rgba(59,130,246,0.1)',
    },
    minimal: {
      accent: '#2563eb', accentSoft: 'rgba(37,99,235,0.08)', accentBorder: 'rgba(37,99,235,0.22)',
      accentText: '#2563eb', gradText: 'linear-gradient(135deg, #2563eb, #0891b2)', bloom: 'rgba(37,99,235,0.06)',
    },
  },
} satisfies Record<string, { grad: string; noir: Record<string, string>; minimal: Record<string, string> }>;

function buildTheme(tone: 'noir' | 'minimal', hue: 'violet' | 'blue'): BentoTheme {
  return { ...TONES[tone], grad: ACCENTS[hue].grad, ...ACCENTS[hue][tone] };
}

const THEMES: Record<string, BentoTheme> = {
  'noir-violet': buildTheme('noir', 'violet'),
  'minimal-violet': buildTheme('minimal', 'violet'),
  'noir-blue': buildTheme('noir', 'blue'),
  'minimal-blue': buildTheme('minimal', 'blue'),
  // legacy aliases for portfolios saved before hue variants existed
  noir: buildTheme('noir', 'violet'),
  minimal: buildTheme('minimal', 'violet'),
};

// ─── Animation ───────────────────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
});

// ─── Base glass card ──────────────────────────────────────────────────────────────
function GCard({
  children, id, className = '', style = {}, t,
}: {
  children: React.ReactNode; id?: string; className?: string; style?: React.CSSProperties; t: BentoTheme;
}) {
  return (
    <motion.div id={id} {...fadeUp()}
      className={`rounded-[16px] sm:rounded-[20px] p-4 sm:p-6 ${className}`}
      style={{
        background: t.card,
        border: `1px solid ${t.border}`,
        backdropFilter: 'blur(12px)',
        boxShadow: t.cardShadow,
        ...style,
      }}>
      {children}
    </motion.div>
  );
}

function Tag({ label, t }: { label: string; t: BentoTheme }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium"
      style={{ background: t.accentSoft, color: t.accentText, border: `1px solid ${t.accentBorder}` }}>
      {label}
    </span>
  );
}

function SLabel({ label, t }: { label: string; t: BentoTheme }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-5"
      style={{ color: t.muted }}>{label}</p>
  );
}

// ─── Individual bento cards ───────────────────────────────────────────────────────
function HeroCard({ r, username, t }: { r: ResumeParsed; username: string; t: BentoTheme }) {
  const initials = (r.name || username).split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <GCard t={t} className="col-span-1 md:col-span-2 flex flex-col gap-4 sm:gap-5"
      style={{ background: t.card, boxShadow: `${t.cardShadow === 'none' ? '' : `${t.cardShadow}, `}inset 0 0 60px rgba(124,58,237,0.06)` }}>
      {/* Avatar */}
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-lg sm:text-xl font-black text-white select-none shrink-0"
        style={{ background: t.grad }}>
        {initials}
      </div>
      {/* Name + role */}
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight mb-1" style={{ color: t.text }}>
          {r.name || username}
        </h1>
        {r.role && (
          <p className="text-base font-medium" style={{
            background: t.gradText,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>{r.role}</p>
        )}
      </div>
      {/* Summary */}
      {r.summary && (
        <p className="text-sm leading-relaxed line-clamp-3" style={{ color: t.muted }}>{r.summary}</p>
      )}
      {/* Quick skill pills */}
      {r.skills?.[0]?.items?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {r.skills.flatMap(g => g.items).slice(0, 6).map((skill, i) => (
            <Tag key={i} label={skill} t={t} />
          ))}
        </div>
      )}
    </GCard>
  );
}

function ContactCard({ r, t }: { r: ResumeParsed; t: BentoTheme }) {
  const hoverBg = t.dark ? 'group-hover:bg-white/10' : 'group-hover:bg-black/5';
  const hoverText = t.dark ? 'group-hover:text-white' : 'group-hover:text-black';
  return (
    <GCard t={t} className="col-span-1 flex flex-col gap-3 sm:gap-4">
      <SLabel label="Connect" t={t} />
      <div className="space-y-3">
        {r.contacts?.map((c, i) => (
          <a key={i} href={c.type === 'email' ? `mailto:${c.value}` : `tel:${c.value.replace(/\s/g,'')}`}
            className="flex items-center gap-3 text-sm group"
            style={{ color: t.muted }}>
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${hoverBg}`}
              style={{ background: t.faint }}>
              {c.type === 'email' ? <Mail className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
            </span>
            <span className={`truncate transition-colors ${hoverText}`}>{c.value}</span>
          </a>
        ))}
        {r.links?.map((l, i) => (
          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 text-sm group"
            style={{ color: t.muted }}>
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${hoverBg}`}
              style={{ background: t.faint }}>
              {l.type === 'github' && <GithubIcon className="w-3.5 h-3.5" />}
              {l.type === 'linkedin' && <LinkedinIcon className="w-3.5 h-3.5" />}
              {l.type === 'web' && <Globe className="w-3.5 h-3.5" />}
            </span>
            <span className={`transition-colors ${hoverText}`}>{l.label}</span>
            <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>
    </GCard>
  );
}

function SkillsCard({ r, t }: { r: ResumeParsed; t: BentoTheme }) {
  if (!r.skills?.length) return null;
  return (
    <GCard t={t} className="col-span-1 flex flex-col gap-4 sm:gap-5" id="skills">
      <SLabel label="Skills" t={t} />
      <div className="space-y-5">
        {r.skills.map((g, i) => (
          <div key={i}>
            {g.category && (
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: t.muted }}>{g.category}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((item, ii) => (
                <span key={ii} className="px-2.5 py-1 rounded-lg text-[12px] font-medium"
                  style={{ background: t.faint, color: t.muted, border: `1px solid ${t.border}` }}>{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </GCard>
  );
}

function ExperienceCard({ r, t }: { r: ResumeParsed; t: BentoTheme }) {
  if (!r.experience?.length) return null;
  return (
    <GCard t={t} className="col-span-1 md:col-span-2 flex flex-col gap-5 sm:gap-6" id="experience">
      <SLabel label="Experience" t={t} />
      <div className="space-y-6 sm:space-y-7">
        {r.experience.map((e, i) => (
          <motion.div key={i} {...fadeUp(i * 0.06)} className="flex flex-col sm:grid sm:grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            <div>
              <h3 className="text-sm font-bold mb-0.5" style={{ color: t.text }}>{e.company}</h3>
              {e.location && <p className="text-xs mb-1" style={{ color: t.muted }}>{e.location}</p>}
              {e.role && (
                <p className="text-xs font-semibold mb-2" style={{
                  background: t.gradText, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>{e.role}</p>
              )}
              {e.bullets?.length > 0 && (
                <ul className="space-y-1">
                  {e.bullets.slice(0, 3).map((b, bi) => (
                    <li key={bi} className="flex gap-2 items-start text-xs leading-relaxed" style={{ color: t.muted }}>
                      <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full" style={{ background: t.accentBorder }} />{b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <span className="text-[11px] font-mono shrink-0 mt-0.5 sm:text-right" style={{ color: t.muted }}>{e.period}</span>
            {i < r.experience.length - 1 && (
              <div className="sm:col-span-2 mt-5 sm:mt-6" style={{ borderTop: `1px solid ${t.border}` }} />
            )}
          </motion.div>
        ))}
      </div>
    </GCard>
  );
}

function ProjectsRow({ r, t }: { r: ResumeParsed; t: BentoTheme }) {
  if (!r.projects?.length) return null;
  return (
    <div className="col-span-1 md:col-span-3" id="projects">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 px-1" style={{ color: t.muted }}>Projects</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {r.projects.map((p, i) => (
          <motion.div key={i} {...fadeUp(i * 0.06)}
            className="rounded-[20px] p-5 flex flex-col gap-3 group cursor-default transition-all duration-300"
            style={{ background: t.card, border: `1px solid ${t.border}`, boxShadow: t.cardShadow }}
            whileHover={{ borderColor: t.borderHover, y: -2 }}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold" style={{ color: t.text }}>{p.name}</h3>
              {p.url && (
                <a href={p.url} target="_blank" rel="noopener noreferrer"
                  className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${t.dark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
                  style={{ color: t.muted }}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            {p.description && <p className="text-xs leading-relaxed line-clamp-2" style={{ color: t.muted }}>{p.description}</p>}
            {p.bullets?.slice(0, 2).map((b, bi) => (
              <p key={bi} className="text-xs leading-relaxed" style={{ color: t.muted }}>· {b}</p>
            ))}
            {p.tech?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                {p.tech.map((tech, ti) => (
                  <span key={ti} className="px-2 py-0.5 rounded-md text-[11px]"
                    style={{ background: t.accentSoft, color: t.accentText, border: `1px solid ${t.accentBorder}` }}>{tech}</span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function EducationCard({ r, t }: { r: ResumeParsed; t: BentoTheme }) {
  if (!r.education?.length) return null;
  return (
    <GCard t={t} className="col-span-1 md:col-span-3 flex flex-col gap-4 sm:gap-5" id="education">
      <SLabel label="Education" t={t} />
      <div className="space-y-4 sm:space-y-5">
        {r.education.map((e, i) => (
          <motion.div key={i} {...fadeUp(i * 0.05)}
            className="flex flex-col sm:flex-row sm:justify-between gap-1 pb-4 sm:pb-5"
            style={{ borderBottom: i < r.education.length - 1 ? `1px solid ${t.border}` : 'none' }}>
            <div>
              <h3 className="text-sm font-bold mb-0.5" style={{ color: t.text }}>{e.institution}</h3>
              {e.degree && <p className="text-xs" style={{ color: t.muted }}>{e.degree}</p>}
              {e.location && <p className="text-xs" style={{ color: t.muted }}>{e.location}</p>}
            </div>
            {e.period && <p className="text-xs font-mono shrink-0" style={{ color: t.muted }}>{e.period}</p>}
          </motion.div>
        ))}
      </div>
    </GCard>
  );
}

function CertsCard({ r, t }: { r: ResumeParsed; t: BentoTheme }) {
  if (!r.certifications?.length && !r.achievements?.length) return null;
  return (
    <GCard t={t} className="col-span-1 flex flex-col gap-4 sm:gap-5" id="certifications">
      {r.certifications?.length > 0 && (
        <>
          <SLabel label="Certifications" t={t} />
          <div className="space-y-3">
            {r.certifications.map((c, i) => (
              <div key={i}>
                <p className="text-xs font-semibold" style={{ color: t.text }}>{c.name}</p>
                {c.issuer && <p className="text-[11px]" style={{ color: t.muted }}>{c.issuer} {c.date && `· ${c.date}`}</p>}
              </div>
            ))}
          </div>
        </>
      )}
      {r.achievements?.length > 0 && (
        <>
          <SLabel label="Achievements" t={t} />
          <ul className="space-y-2">
            {r.achievements.map((a, i) => (
              <li key={i} className="flex gap-2 items-start text-xs leading-relaxed" style={{ color: t.muted }}>
                <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full" style={{ background: t.accentBorder }} />{a}
              </li>
            ))}
          </ul>
        </>
      )}
    </GCard>
  );
}

// ─── Main Bento Template ──────────────────────────────────────────────────────────
export default function BentoTemplate({ r, username, theme }: TemplateProps) {
  const t: BentoTheme = THEMES[theme] ?? THEMES['noir-violet'];
  const initials = (r.name || username).split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const hasRight = r.certifications?.length > 0 || r.achievements?.length > 0;
  const navHoverCls = t.dark ? 'hover:bg-white/5' : 'hover:bg-black/5';

  return (
    <div style={{
      background: t.bg, color: t.text,
      fontFamily: 'Inter, system-ui, sans-serif', minHeight: '100vh',
      // Subtle dot grid background
      backgroundImage: `radial-gradient(circle, ${t.dot} 1px, transparent 1px)`,
      backgroundSize: '28px 28px',
    }}>
      {/* Noise overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{
        opacity: t.noise,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat', backgroundSize: '128px 128px',
      }} />

      {/* Top gradient bloom */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse, ${t.bloom} 0%, transparent 70%)`, filter: 'blur(40px)' }} />

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: t.navBg, borderColor: t.border, backdropFilter: 'blur(16px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black"
              style={{ background: t.grad }}>{initials}</div>
            <span className="text-sm font-semibold" style={{ color: t.text }}>{r.name || username}</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {['skills', 'experience', 'projects', 'education'].map(a => (
              <a key={a} href={`#${a}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${navHoverCls}`}
                style={{ color: t.muted }}>{a}</a>
            ))}
          </div>
        </div>
      </nav>

      {/* Bento grid */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 auto-rows-auto">

          {/* Row 1: Hero (2/3) + Contact (1/3) */}
          <HeroCard r={r} username={username} t={t} />
          <ContactCard r={r} t={t} />

          {/* Row 2: Skills (1/3) + Experience (2/3) */}
          <SkillsCard r={r} t={t} />
          <ExperienceCard r={r} t={t} />

          {/* Row 3: Projects full width */}
          <ProjectsRow r={r} t={t} />

          {/* Row 4: Education + Certs (if any) */}
          <EducationCard r={r} t={t} />
          {hasRight && <CertsCard r={r} t={t} />}

        </div>

        {/* Footer */}
        <div className="mt-10 flex items-center justify-between pb-6">
          <a href="https://kaamlee.in" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs hover:opacity-60 transition-opacity" style={{ color: t.muted }}>
            <ExternalLink className="w-3 h-3" /> Powered by Kaamlee
          </a>
          <p className="text-xs" style={{ color: t.footerFaint }}>{r.name || username}</p>
        </div>
      </div>
    </div>
  );
}
