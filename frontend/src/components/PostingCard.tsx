'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Briefcase, Tag, Bookmark, Copy, Check } from 'lucide-react';
import type { JobPosting } from '@/lib/hiring-types';

const EMPLOYMENT_TYPE_LABELS: Record<JobPosting['employment_type'], string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

// Same tint palette as JobCard, so the two card types read as one family
// even though they're rendered by separate components (their action sets
// differ too much to share one component — bookmark/copy-link/cover-letter
// are scraped-job-only, "Apply on Kaamlee" is posting-only).
const CARD_TINTS = [
  { bg: '#ecfdf5', text: '#16a34a' },
  { bg: '#f3eeff', text: '#7c4dff' },
  { bg: '#fff7e0', text: '#c08a12' },
  { bg: '#eafaf0', text: '#16a34a' },
  { bg: '#eef2ff', text: '#4f46e5' },
];

function hashSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function formatLocation(p: JobPosting): string {
  const parts = [p.city, p.state, p.country].filter(Boolean);
  if (p.is_remote) return parts.length ? `Remote · ${parts.join(', ')}` : 'Remote';
  return parts.length ? parts.join(', ') : 'Not specified';
}

function formatSalary(p: JobPosting): string | null {
  if (p.salary_min == null && p.salary_max == null) return null;
  const fmt = (n: number) => n.toLocaleString('en-IN');
  if (p.salary_min != null && p.salary_max != null) return `${p.salary_currency} ${fmt(p.salary_min)} – ${fmt(p.salary_max)}`;
  return `${p.salary_currency} ${fmt((p.salary_min ?? p.salary_max) as number)}+`;
}

interface PostingCardProps {
  posting: JobPosting;
  isSelected?: boolean;
  onClick?: () => void;
  onToggleBookmark?: (e: React.MouseEvent, postingId: number) => void;
  /** Extra classes for the root, e.g. `h-full` to match sibling card heights. */
  className?: string;
}

export const PostingCard = React.memo(function PostingCard({ posting, isSelected, onClick, onToggleBookmark, className = '' }: PostingCardProps) {
  const [copied, setCopied] = React.useState(false);
  const getInitial = (name: string) => (name ? name.charAt(0).toUpperCase() : '?');
  const tint = CARD_TINTS[hashSeed(String(posting.id)) % CARD_TINTS.length];
  const salary = formatSalary(posting);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/apply/${posting.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={onClick}
      className={`cursor-default job-card p-5 sm:p-6 rounded-[20px] border bg-white group transition-all duration-300 relative overflow-hidden shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)] hover:border-[#16a34a]/40 ${
        isSelected ? 'border-[#16a34a] ring-1 ring-[#16a34a]/25 bg-[#f6fdf8]' : 'border-black/[0.08]'
      } flex flex-col ${className}`}
    >
      <div className="absolute top-4 right-4 z-10">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#16a34a] bg-[#16a34a]/10 border border-[#16a34a]/20 px-2 py-1 rounded-full" style={{ fontFamily: 'var(--font-outfit)' }}>
          Direct
        </span>
      </div>

      <div className="flex gap-5 items-start flex-1">
        <div className="flex flex-col items-center shrink-0 gap-2.5">
          <div
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-[14px] flex items-center justify-center border border-black/[0.06] overflow-hidden transition-colors"
            style={{ background: posting.employer_logo ? '#ffffff' : tint.bg }}
          >
            {posting.employer_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posting.employer_logo} alt={posting.employer_name} className="w-full h-full object-contain" />
            ) : (
              <span className="text-lg font-bold" style={{ color: tint.text, fontFamily: 'var(--font-outfit)' }}>
                {getInitial(posting.employer_name)}
              </span>
            )}
          </div>

          <button
            onClick={(e) => onToggleBookmark?.(e, posting.id)}
            className={`w-full flex justify-center cursor-pointer p-2 rounded-xl border transition-all ${
              posting.is_saved
                ? 'bg-[#16a34a]/10 border-[#16a34a]/25 text-[#16a34a]'
                : 'bg-white border-black/[0.08] text-black/35 hover:border-black/20 hover:text-black/60'
            }`}
            title={posting.is_saved ? 'Unbookmark' : 'Bookmark'}
          >
            <Bookmark size={16} fill={posting.is_saved ? 'currentColor' : 'none'} />
          </button>

          <button
            onClick={handleCopyLink}
            className={`w-full flex justify-center cursor-pointer p-2 rounded-xl border transition-all ${
              copied
                ? 'bg-[#16a34a]/10 border-[#16a34a]/25 text-[#16a34a]'
                : 'bg-white border-black/[0.08] text-black/35 hover:text-black/70 hover:border-black/20'
            }`}
            title="Copy link"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>

        {/* Column stretches to the card's height so the footer below can
            sit at the bottom when the card is stretched (className="h-full"). */}
        <div className="flex-1 min-w-0 self-stretch flex flex-col">
          <h3
            className="max-w-[85%] text-sm sm:text-base font-semibold text-[#0b0b0c] group-hover:text-[#16a34a] transition-colors truncate tracking-[-0.01em]"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            {posting.title}
          </h3>

          <div className="flex items-center gap-3 mb-3 mt-1.5">
            <p className="max-w-[90%] text-sm text-[rgba(61,61,61,0.72)] truncate">{posting.employer_name}</p>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-1 text-[11px] text-black/55 bg-black/[0.03] px-2 py-1 rounded-full border border-black/[0.08]" style={{ fontFamily: 'var(--font-outfit)' }}>
              <MapPin size={12} />
              {formatLocation(posting)}
            </div>
            {posting.is_remote && (
              <div className="flex items-center gap-1 text-[11px] text-[#16a34a] bg-[#16a34a]/10 px-2 py-1 rounded-full border border-[#16a34a]/20" style={{ fontFamily: 'var(--font-outfit)' }}>
                Remote
              </div>
            )}
            <div className="flex items-center gap-1 text-[11px] text-black/55 bg-black/[0.03] px-2 py-1 rounded-full border border-black/[0.08]" style={{ fontFamily: 'var(--font-outfit)' }}>
              <Briefcase size={12} />
              {EMPLOYMENT_TYPE_LABELS[posting.employment_type]}
            </div>
            {posting.category && (
              <div className="flex items-center gap-1 text-[11px] text-black/55 bg-black/[0.03] px-2 py-1 rounded-full border border-black/[0.08]" style={{ fontFamily: 'var(--font-outfit)' }}>
                <Tag size={12} />
                {posting.category}
              </div>
            )}
            {salary && (
              <div className="flex items-center gap-1 text-[11px] text-[#16a34a] bg-[#16a34a]/10 px-2 py-1 rounded-full border border-[#16a34a]/20" style={{ fontFamily: 'var(--font-outfit)' }}>
                {salary}
              </div>
            )}
          </div>

          <p className="text-xs text-black/45 line-clamp-2 leading-relaxed mb-5">
            {posting.description || 'No description provided...'}
          </p>

          <div className="flex justify-between items-center mb-1 mt-auto">
            <Link
              href={`/apply/${posting.id}`}
              className="text-xs text-[#16a34a] hover:underline font-medium"
              style={{ fontFamily: 'var(--font-outfit)' }}
              onClick={(e) => e.stopPropagation()}
            >
              Apply on Kaamlee
            </Link>

            {posting.published_at && (
              <span className="text-[10px] text-black/40 ml-auto" style={{ fontFamily: 'var(--font-outfit)' }}>
                {new Date(posting.published_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
