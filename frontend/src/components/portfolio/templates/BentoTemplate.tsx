'use client';

import { motion } from 'framer-motion';
import { Mail, Phone, Globe, ExternalLink, ArrowUpRight } from 'lucide-react';
import { GithubIcon, LinkedinIcon } from '../icons';
import type { ResumeParsed } from '../types';
import type { TemplateProps } from './ClassicTemplate';

// ─── Design constants ────────────────────────────────────────────────────────────
const C = {
  bg: '#07070c',
  card: 'rgba(255,255,255,0.035)',
  border: 'rgba(255,255,255,0.08)',
  borderHover: 'rgba(255,255,255,0.14)',
  text: '#f1f1f3',
  muted: '#6b6b78',
  faint: 'rgba(255,255,255,0.05)',
  accent: '#7c3aed',
  accentSoft: 'rgba(124,58,237,0.12)',
  accentBorder: 'rgba(124,58,237,0.3)',
  grad: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 60%, #a855f7 100%)',
  gradText: 'linear-gradient(135deg, #a78bfa, #e879f9)',
  navBg: 'rgba(7,7,12,0.85)',
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
  children, id, className = '', style = {},
}: {
  children: React.ReactNode; id?: string; className?: string; style?: React.CSSProperties;
}) {
  return (
    <motion.div id={id} {...fadeUp()}
      className={`rounded-[16px] sm:rounded-[20px] p-4 sm:p-6 ${className}`}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        backdropFilter: 'blur(12px)',
        ...style,
      }}>
      {children}
    </motion.div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium"
      style={{ background: C.accentSoft, color: '#a78bfa', border: `1px solid ${C.accentBorder}` }}>
      {label}
    </span>
  );
}

function SLabel({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-5"
      style={{ color: C.muted }}>{label}</p>
  );
}

// ─── Individual bento cards ───────────────────────────────────────────────────────
function HeroCard({ r, username }: { r: ResumeParsed; username: string }) {
  const initials = (r.name || username).split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <GCard className="col-span-1 md:col-span-2 flex flex-col gap-4 sm:gap-5"
      style={{ background: C.card, boxShadow: `inset 0 0 60px rgba(124,58,237,0.06)` }}>
      {/* Avatar */}
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-lg sm:text-xl font-black text-white select-none shrink-0"
        style={{ background: C.grad }}>
        {initials}
      </div>
      {/* Name + role */}
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight mb-1" style={{ color: C.text }}>
          {r.name || username}
        </h1>
        {r.role && (
          <p className="text-base font-medium" style={{
            background: C.gradText,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>{r.role}</p>
        )}
      </div>
      {/* Summary */}
      {r.summary && (
        <p className="text-sm leading-relaxed line-clamp-3" style={{ color: C.muted }}>{r.summary}</p>
      )}
      {/* Quick skill pills */}
      {r.skills?.[0]?.items?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {r.skills.flatMap(g => g.items).slice(0, 6).map((skill, i) => (
            <Tag key={i} label={skill} />
          ))}
        </div>
      )}
    </GCard>
  );
}

function ContactCard({ r }: { r: ResumeParsed }) {
  return (
    <GCard className="col-span-1 flex flex-col gap-3 sm:gap-4">
      <SLabel label="Connect" />
      <div className="space-y-3">
        {r.contacts?.map((c, i) => (
          <a key={i} href={c.type === 'email' ? `mailto:${c.value}` : `tel:${c.value.replace(/\s/g,'')}`}
            className="flex items-center gap-3 text-sm group"
            style={{ color: C.muted }}>
            <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors group-hover:bg-white/10"
              style={{ background: C.faint }}>
              {c.type === 'email' ? <Mail className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
            </span>
            <span className="truncate group-hover:text-white transition-colors">{c.value}</span>
          </a>
        ))}
        {r.links?.map((l, i) => (
          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 text-sm group"
            style={{ color: C.muted }}>
            <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors group-hover:bg-white/10"
              style={{ background: C.faint }}>
              {l.type === 'github' && <GithubIcon className="w-3.5 h-3.5" />}
              {l.type === 'linkedin' && <LinkedinIcon className="w-3.5 h-3.5" />}
              {l.type === 'web' && <Globe className="w-3.5 h-3.5" />}
            </span>
            <span className="group-hover:text-white transition-colors">{l.label}</span>
            <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>
    </GCard>
  );
}

function SkillsCard({ r }: { r: ResumeParsed }) {
  if (!r.skills?.length) return null;
  return (
    <GCard className="col-span-1 flex flex-col gap-4 sm:gap-5" id="skills">
      <SLabel label="Skills" />
      <div className="space-y-5">
        {r.skills.map((g, i) => (
          <div key={i}>
            {g.category && (
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: C.muted }}>{g.category}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((item, ii) => (
                <span key={ii} className="px-2.5 py-1 rounded-lg text-[12px] font-medium"
                  style={{ background: C.faint, color: C.muted, border: `1px solid ${C.border}` }}>{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </GCard>
  );
}

function ExperienceCard({ r }: { r: ResumeParsed }) {
  if (!r.experience?.length) return null;
  return (
    <GCard className="col-span-1 md:col-span-2 flex flex-col gap-5 sm:gap-6" id="experience">
      <SLabel label="Experience" />
      <div className="space-y-6 sm:space-y-7">
        {r.experience.map((e, i) => (
          <motion.div key={i} {...fadeUp(i * 0.06)} className="flex flex-col sm:grid sm:grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            <div>
              <h3 className="text-sm font-bold mb-0.5" style={{ color: C.text }}>{e.company}</h3>
              {e.location && <p className="text-xs mb-1" style={{ color: C.muted }}>{e.location}</p>}
              {e.role && (
                <p className="text-xs font-semibold mb-2" style={{
                  background: C.gradText, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>{e.role}</p>
              )}
              {e.bullets?.length > 0 && (
                <ul className="space-y-1">
                  {e.bullets.slice(0, 3).map((b, bi) => (
                    <li key={bi} className="flex gap-2 items-start text-xs leading-relaxed" style={{ color: C.muted }}>
                      <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full" style={{ background: C.accentBorder }} />{b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <span className="text-[11px] font-mono shrink-0 mt-0.5 sm:text-right" style={{ color: C.muted }}>{e.period}</span>
            {i < r.experience.length - 1 && (
              <div className="sm:col-span-2 mt-5 sm:mt-6" style={{ borderTop: `1px solid ${C.border}` }} />
            )}
          </motion.div>
        ))}
      </div>
    </GCard>
  );
}

function ProjectsRow({ r }: { r: ResumeParsed }) {
  if (!r.projects?.length) return null;
  return (
    <div className="col-span-1 md:col-span-3" id="projects">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 px-1" style={{ color: C.muted }}>Projects</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {r.projects.map((p, i) => (
          <motion.div key={i} {...fadeUp(i * 0.06)}
            className="rounded-[20px] p-5 flex flex-col gap-3 group cursor-default transition-all duration-300"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
            whileHover={{ borderColor: C.borderHover, y: -2 }}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold" style={{ color: C.text }}>{p.name}</h3>
              {p.url && (
                <a href={p.url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                  style={{ color: C.muted }}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            {p.description && <p className="text-xs leading-relaxed line-clamp-2" style={{ color: C.muted }}>{p.description}</p>}
            {p.bullets?.slice(0, 2).map((b, bi) => (
              <p key={bi} className="text-xs leading-relaxed" style={{ color: C.muted }}>· {b}</p>
            ))}
            {p.tech?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                {p.tech.map((tech, ti) => (
                  <span key={ti} className="px-2 py-0.5 rounded-md text-[11px]"
                    style={{ background: C.accentSoft, color: '#a78bfa', border: `1px solid ${C.accentBorder}` }}>{tech}</span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function EducationCard({ r }: { r: ResumeParsed }) {
  if (!r.education?.length) return null;
  return (
    <GCard className="col-span-1 md:col-span-3 flex flex-col gap-4 sm:gap-5" id="education">
      <SLabel label="Education" />
      <div className="space-y-4 sm:space-y-5">
        {r.education.map((e, i) => (
          <motion.div key={i} {...fadeUp(i * 0.05)}
            className="flex flex-col sm:flex-row sm:justify-between gap-1 pb-4 sm:pb-5"
            style={{ borderBottom: i < r.education.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div>
              <h3 className="text-sm font-bold mb-0.5" style={{ color: C.text }}>{e.institution}</h3>
              {e.degree && <p className="text-xs" style={{ color: C.muted }}>{e.degree}</p>}
              {e.location && <p className="text-xs" style={{ color: C.muted }}>{e.location}</p>}
            </div>
            {e.period && <p className="text-xs font-mono shrink-0" style={{ color: C.muted }}>{e.period}</p>}
          </motion.div>
        ))}
      </div>
    </GCard>
  );
}

function CertsCard({ r }: { r: ResumeParsed }) {
  if (!r.certifications?.length && !r.achievements?.length) return null;
  return (
    <GCard className="col-span-1 flex flex-col gap-4 sm:gap-5" id="certifications">
      {r.certifications?.length > 0 && (
        <>
          <SLabel label="Certifications" />
          <div className="space-y-3">
            {r.certifications.map((c, i) => (
              <div key={i}>
                <p className="text-xs font-semibold" style={{ color: C.text }}>{c.name}</p>
                {c.issuer && <p className="text-[11px]" style={{ color: C.muted }}>{c.issuer} {c.date && `· ${c.date}`}</p>}
              </div>
            ))}
          </div>
        </>
      )}
      {r.achievements?.length > 0 && (
        <>
          <SLabel label="Achievements" />
          <ul className="space-y-2">
            {r.achievements.map((a, i) => (
              <li key={i} className="flex gap-2 items-start text-xs leading-relaxed" style={{ color: C.muted }}>
                <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full" style={{ background: C.accentBorder }} />{a}
              </li>
            ))}
          </ul>
        </>
      )}
    </GCard>
  );
}

// ─── Main Bento Template ──────────────────────────────────────────────────────────
export default function BentoTemplate({ r, username }: TemplateProps) {
  const initials = (r.name || username).split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const hasRight = r.certifications?.length > 0 || r.achievements?.length > 0;

  return (
    <div style={{
      background: C.bg, color: C.text,
      fontFamily: 'Inter, system-ui, sans-serif', minHeight: '100vh',
      // Subtle dot grid background
      backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)`,
      backgroundSize: '28px 28px',
    }}>
      {/* Noise overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{
        opacity: 0.025,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat', backgroundSize: '128px 128px',
      }} />

      {/* Top gradient bloom */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.1) 0%, transparent 70%)', filter: 'blur(40px)' }} />

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: C.navBg, borderColor: C.border, backdropFilter: 'blur(16px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black"
              style={{ background: C.grad }}>{initials}</div>
            <span className="text-sm font-semibold" style={{ color: C.text }}>{r.name || username}</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {['skills', 'experience', 'projects', 'education'].map(a => (
              <a key={a} href={`#${a}`}
                className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors hover:bg-white/5"
                style={{ color: C.muted }}>{a}</a>
            ))}
          </div>
        </div>
      </nav>

      {/* Bento grid */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 auto-rows-auto">

          {/* Row 1: Hero (2/3) + Contact (1/3) */}
          <HeroCard r={r} username={username} />
          <ContactCard r={r} />

          {/* Row 2: Skills (1/3) + Experience (2/3) */}
          <SkillsCard r={r} />
          <ExperienceCard r={r} />

          {/* Row 3: Projects full width */}
          <ProjectsRow r={r} />

          {/* Row 4: Education + Certs (if any) */}
          <EducationCard r={r} />
          {hasRight && <CertsCard r={r} />}

        </div>

        {/* Footer */}
        <div className="mt-10 flex items-center justify-between pb-6">
          <a href="https://kaamlee.in" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs hover:opacity-60 transition-opacity" style={{ color: C.muted }}>
            <ExternalLink className="w-3 h-3" /> Powered by Kaamlee
          </a>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.1)' }}>{r.name || username}</p>
        </div>
      </div>
    </div>
  );
}
