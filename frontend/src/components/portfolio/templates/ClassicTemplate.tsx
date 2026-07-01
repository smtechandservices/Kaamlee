'use client';

import { motion } from 'framer-motion';
import { Mail, Phone, Globe, ExternalLink } from 'lucide-react';
import { GithubIcon, LinkedinIcon } from '../icons';
import type { ResumeParsed } from '../types';

interface Theme {
  bg: string; surface: string; border: string;
  text: string; muted: string; faint: string;
  accent: string; navBg: string;
}

const THEMES: Record<string, Theme> = {
  noir: {
    bg: '#0d0d0d', surface: '#111111', border: '#2a2a2a',
    text: '#ffffff', muted: '#737373', faint: '#1a1a1a',
    accent: '#ffffff', navBg: 'rgba(13,13,13,0.85)',
  },
  minimal: {
    bg: '#f5f5f5', surface: '#ffffff', border: '#e0e0e0',
    text: '#111111', muted: '#888888', faint: '#ebebeb',
    accent: '#111111', navBg: 'rgba(245,245,245,0.85)',
  },
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { delay, duration: 0.52 },
});

function Card({ children, t, id }: { children: React.ReactNode; t: Theme; id?: string }) {
  return (
    <motion.section id={id} {...fadeUp()}
      className="rounded-[18px] sm:rounded-[20px] p-5 sm:p-8"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}>
      {children}
    </motion.section>
  );
}

function SectionLabel({ label, t }: { label: string; t: Theme }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <span className="w-1.5 h-5 rounded-full shrink-0" style={{ background: t.accent }} />
      <h2 className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: t.muted }}>{label}</h2>
    </div>
  );
}

export interface TemplateProps { r: ResumeParsed; username: string; theme: string }

export default function ClassicTemplate({ r, username, theme }: TemplateProps) {
  const t: Theme = THEMES[theme] ?? THEMES.noir;
  const initials = (r.name || username).split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const navAnchors = [
    r.summary && 'about', r.skills?.length && 'skills',
    r.experience?.length && 'experience', r.projects?.length && 'projects',
    r.education?.length && 'education',
  ].filter(Boolean) as string[];

  return (
    <div style={{ background: t.bg, color: t.text, fontFamily: 'Inter, system-ui, sans-serif', minHeight: '100vh' }}>
      <nav className="sticky top-0 z-50 border-b" style={{ background: t.navBg, borderColor: t.border, backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black"
              style={{ background: t.accent, color: t.bg }}>{initials}</div>
            <span className="text-sm font-semibold" style={{ color: t.text }}>{r.name || username}</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {navAnchors.map(a => (
              <a key={a} href={`#${a}`} className="text-xs font-medium capitalize hover:opacity-60 transition-opacity" style={{ color: t.muted }}>{a}</a>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-4 sm:space-y-5">
        <motion.div {...fadeUp(0)}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3 sm:mb-4" style={{ color: t.accent }}>Portfolio</p>
          <h1 className="font-black leading-[1.05] mb-3 sm:mb-4"
            style={{ fontSize: 'clamp(34px, 8vw, 82px)', color: t.text, letterSpacing: '-0.02em' }}>
            {r.name || username}
          </h1>
          {r.role && <p className="text-base sm:text-lg font-medium mb-6 sm:mb-8" style={{ color: t.muted }}>{r.role}</p>}
          <div className="flex flex-wrap gap-3 sm:gap-5">
            {r.contacts?.map((c, i) => (
              <a key={i} href={c.type === 'email' ? `mailto:${c.value}` : `tel:${c.value.replace(/\s/g,'')}`}
                className="flex items-center gap-2 text-sm hover:opacity-60 transition-opacity" style={{ color: t.muted }}>
                {c.type === 'email' ? <Mail className="w-4 h-4 shrink-0" /> : <Phone className="w-4 h-4 shrink-0" />}
                {c.value}
              </a>
            ))}
            {r.links?.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm hover:opacity-60 transition-opacity" style={{ color: t.muted }}>
                {l.type === 'github' && <GithubIcon className="w-4 h-4 shrink-0" />}
                {l.type === 'linkedin' && <LinkedinIcon className="w-4 h-4 shrink-0" />}
                {l.type === 'web' && <Globe className="w-4 h-4 shrink-0" />}
                {l.label}
              </a>
            ))}
          </div>
        </motion.div>

        {r.summary && (
          <Card t={t} id="about">
            <SectionLabel label="About" t={t} />
            <p className="text-base leading-[1.9] max-w-2xl" style={{ color: t.muted }}>{r.summary}</p>
          </Card>
        )}

        {r.skills?.length > 0 && (
          <Card t={t} id="skills">
            <SectionLabel label="Skills" t={t} />
            <div className="space-y-6">
              {r.skills.map((g, i) => (
                <div key={i}>
                  {g.category && <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: t.muted }}>{g.category}</p>}
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((item, ii) => (
                      <span key={ii} className="px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium"
                        style={{ background: t.faint, color: t.muted, border: `1px solid ${t.border}` }}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {r.experience?.length > 0 && (
          <Card t={t} id="experience">
            <SectionLabel label="Experience" t={t} />
            <div className="space-y-8">
              {r.experience.map((e, i) => (
                <motion.div key={i} {...fadeUp(i * 0.05)} className="pl-5 relative" style={{ borderLeft: `2px solid ${t.border}` }}>
                  <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full" style={{ background: t.accent }} />
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-0.5">
                    <h3 className="text-base font-bold" style={{ color: t.text }}>{e.company}</h3>
                    <span className="text-xs font-mono shrink-0" style={{ color: t.muted }}>{e.period}</span>
                  </div>
                  {e.location && <p className="text-xs mb-1" style={{ color: t.muted }}>{e.location}</p>}
                  {e.role && <p className="text-sm font-semibold mb-3" style={{ color: t.accent }}>{e.role}</p>}
                  {e.bullets?.length > 0 && (
                    <ul className="space-y-1.5">
                      {e.bullets.map((b, bi) => (
                        <li key={bi} className="flex gap-2.5 items-start text-sm leading-relaxed" style={{ color: t.muted }}>
                          <span className="shrink-0 mt-2 w-1 h-1 rounded-full" style={{ background: t.border }} />{b}
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {r.projects?.length > 0 && (
          <Card t={t} id="projects">
            <SectionLabel label="Projects" t={t} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {r.projects.map((p, i) => (
                <motion.div key={i} {...fadeUp(i * 0.06)} className="rounded-[14px] p-5 flex flex-col gap-3"
                  style={{ background: t.faint, border: `1px solid ${t.border}` }}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold" style={{ color: t.text }}>{p.name}</h3>
                    {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 hover:opacity-60" style={{ color: t.muted }}><ExternalLink className="w-3.5 h-3.5" /></a>}
                  </div>
                  {p.description && <p className="text-xs leading-relaxed" style={{ color: t.muted }}>{p.description}</p>}
                  {p.bullets?.length > 0 && (
                    <ul className="space-y-1">
                      {p.bullets.map((b, bi) => (
                        <li key={bi} className="flex gap-2 items-start text-xs leading-relaxed" style={{ color: t.muted }}>
                          <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full" style={{ background: t.border }} />{b}
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.tech?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                      {p.tech.map((tech, ti) => (
                        <span key={ti} className="px-2 py-0.5 rounded-md text-[11px]"
                          style={{ background: t.surface, color: t.muted, border: `1px solid ${t.border}` }}>{tech}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {r.education?.length > 0 && (
          <Card t={t} id="education">
            <SectionLabel label="Education" t={t} />
            <div className="space-y-6">
              {r.education.map((e, i) => (
                <motion.div key={i} {...fadeUp(i * 0.05)}
                  className="flex flex-col md:flex-row md:items-start md:justify-between gap-1 pb-6"
                  style={{ borderBottom: i < r.education.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                  <div>
                    <h3 className="text-base font-bold mb-0.5" style={{ color: t.text }}>{e.institution}</h3>
                    {e.degree && <p className="text-sm" style={{ color: t.muted }}>{e.degree}</p>}
                    {e.location && <p className="text-xs mt-0.5" style={{ color: t.muted }}>{e.location}</p>}
                  </div>
                  {e.period && <p className="text-xs font-mono shrink-0 mt-0.5" style={{ color: t.muted }}>{e.period}</p>}
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {(r.certifications?.length > 0 || r.achievements?.length > 0) && (
          <Card t={t} id="certifications">
            {r.certifications?.length > 0 && (
              <>
                <SectionLabel label="Certifications" t={t} />
                <div className="space-y-3 mb-8">
                  {r.certifications.map((c, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: t.text }}>{c.name}</p>
                        {c.issuer && <p className="text-xs" style={{ color: t.muted }}>{c.issuer}</p>}
                      </div>
                      {c.date && <p className="text-xs font-mono shrink-0" style={{ color: t.muted }}>{c.date}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
            {r.achievements?.length > 0 && (
              <>
                <SectionLabel label="Achievements" t={t} />
                <ul className="space-y-2">
                  {r.achievements.map((a, i) => (
                    <li key={i} className="flex gap-2.5 items-start text-sm leading-relaxed" style={{ color: t.muted }}>
                      <span className="shrink-0 mt-2 w-1 h-1 rounded-full" style={{ background: t.accent }} />{a}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        )}

        <div className="pt-4 pb-8 flex items-center justify-between">
          <a href="https://kaamlee.in" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs hover:opacity-60 transition-opacity" style={{ color: t.muted }}>
            <ExternalLink className="w-3 h-3" /> Powered by Kaamlee
          </a>
          <p className="text-xs" style={{ color: t.border }}>{r.name || username}</p>
        </div>
      </div>
    </div>
  );
}
