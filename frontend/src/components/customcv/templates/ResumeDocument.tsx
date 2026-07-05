import type { ResumeParsed } from '@/components/portfolio/types';
import type { CVTemplate } from '../types';

interface Variant {
  fontFamily: string;
  headingColor: string;
  accent: string;
  labelTransform: string;
}

const VARIANTS: Record<CVTemplate, Variant> = {
  modern: {
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    headingColor: '#1d4ed8',
    accent: '#1d4ed8',
    labelTransform: 'uppercase',
  },
  classic: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    headingColor: '#111827',
    accent: '#111827',
    labelTransform: 'uppercase',
  },
  ats: {
    fontFamily: 'Helvetica, Arial, sans-serif',
    headingColor: '#000000',
    accent: '#000000',
    labelTransform: 'uppercase',
  },
};

function SectionTitle({ children, v }: { children: React.ReactNode; v: Variant }) {
  return (
    <h2
      className="text-[11px] font-bold mb-1.5 pb-1 border-b"
      style={{ color: v.headingColor, borderColor: v.accent, textTransform: v.labelTransform as React.CSSProperties['textTransform'], letterSpacing: '0.05em' }}
    >
      {children}
    </h2>
  );
}

export default function ResumeDocument({ r, template }: { r: ResumeParsed; template: CVTemplate }) {
  const v = VARIANTS[template];

  return (
    <div
      className="bg-white text-black w-full max-w-[816px] mx-auto p-8 sm:p-10 shadow-lg text-[12px] leading-snug"
      style={{ fontFamily: v.fontFamily, minHeight: '1056px' }}
    >
      <h1 className="text-2xl font-bold mb-0.5" style={{ color: v.headingColor }}>{r.name || 'Your Name'}</h1>
      {r.role && <p className="text-sm text-gray-600 mb-2">{r.role}</p>}

      <p className="text-[10px] text-gray-600 mb-4">
        {(r.contacts || []).map((c, i) => (
          <span key={i}>{i > 0 && ' | '}{c.value}</span>
        ))}
        {(r.links || []).length > 0 && (r.contacts || []).length > 0 && ' | '}
        {(r.links || []).map((l, i) => (
          <span key={i}>{i > 0 && ' | '}{l.label}: {l.url}</span>
        ))}
      </p>

      {r.summary && (
        <div className="mb-4">
          <SectionTitle v={v}>Summary</SectionTitle>
          <p>{r.summary}</p>
        </div>
      )}

      {(r.skills || []).length > 0 && (
        <div className="mb-4">
          <SectionTitle v={v}>Skills</SectionTitle>
          {r.skills.map((group, i) => (
            <p key={i}>
              {group.category && <span className="font-bold">{group.category}: </span>}
              {(group.items || []).join(', ')}
            </p>
          ))}
        </div>
      )}

      {(r.experience || []).length > 0 && (
        <div className="mb-4">
          <SectionTitle v={v}>Experience</SectionTitle>
          {r.experience.map((exp, i) => (
            <div key={i} className="mb-2.5">
              <p className="font-bold text-[12.5px]">{exp.role} — {exp.company}</p>
              <p className="text-[10px] text-gray-600 mb-1">{exp.period}{exp.location && ` | ${exp.location}`}</p>
              <ul className="list-disc ml-4 space-y-0.5">
                {(exp.bullets || []).map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {(r.projects || []).length > 0 && (
        <div className="mb-4">
          <SectionTitle v={v}>Projects</SectionTitle>
          {r.projects.map((proj, i) => (
            <div key={i} className="mb-2.5">
              <p className="font-bold text-[12.5px]">{proj.name}{(proj.tech || []).length > 0 && ` (${proj.tech.join(', ')})`}</p>
              {proj.description && <p className="text-[10px] text-gray-600 mb-1">{proj.description}</p>}
              <ul className="list-disc ml-4 space-y-0.5">
                {(proj.bullets || []).map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {(r.education || []).length > 0 && (
        <div className="mb-4">
          <SectionTitle v={v}>Education</SectionTitle>
          {r.education.map((edu, i) => (
            <div key={i} className="mb-1.5">
              <p className="font-bold text-[12.5px]">{edu.degree} — {edu.institution}</p>
              <p className="text-[10px] text-gray-600">{edu.period}{edu.location && ` | ${edu.location}`}</p>
            </div>
          ))}
        </div>
      )}

      {(r.certifications || []).length > 0 && (
        <div className="mb-4">
          <SectionTitle v={v}>Certifications</SectionTitle>
          {r.certifications.map((cert, i) => (
            <p key={i}>{cert.name}{cert.issuer && ` — ${cert.issuer}`}{cert.date && ` (${cert.date})`}</p>
          ))}
        </div>
      )}

      {(r.achievements || []).length > 0 && (
        <div className="mb-4">
          <SectionTitle v={v}>Achievements</SectionTitle>
          <ul className="list-disc ml-4 space-y-0.5">
            {r.achievements.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
