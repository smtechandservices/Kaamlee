'use client';

import React from 'react';
import { MapPin, Briefcase, ExternalLink, Clock, Bookmark, Copy, Check, FileEdit, DollarSign, Tag, GraduationCap } from 'lucide-react';
import CoverLetterModal from '@/components/CoverLetterModal';

interface JobCardProps {
  job: {
    title: string;
    company: string | null;
    location: string;
    is_remote: boolean;
    job_type: string;
    job_url: string;
    description: string;
    salary?: string | null;
    category?: string | null;
    experience_required?: string | null;
    site: string;
    company_logo?: string;
    date_posted?: string | null;
    created_at?: string;
    match_score?: number;
    is_bookmarked?: boolean;
    id: string;
  };
  isSelected?: boolean;
  onClick?: (jobId: string) => void;
  onToggleBookmark?: (e: React.MouseEvent, jobId: string) => void;
}

// Matches the tint palette used for the mini job-list mockup on the landing page.
const JOB_CARD_TINTS = [
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

export const JobCard = React.memo(function JobCard({ job, isSelected, onClick, onToggleBookmark }: JobCardProps) {
  const [copied, setCopied] = React.useState(false);
  const [isCoverLetterOpen, setIsCoverLetterOpen] = React.useState(false);
  const companyName = job.company || 'Confidential';
  const getInitial = (name: string) => name ? name.charAt(0).toUpperCase() : '?';
  const tint = JOB_CARD_TINTS[hashSeed(String(job.id ?? companyName)) % JOB_CARD_TINTS.length];

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(job.job_url);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <>
    <div
      onClick={() => onClick?.(job.id)}
      className={`cursor-default job-card p-5 sm:p-6 rounded-[20px] border bg-white group transition-all duration-300 relative overflow-hidden shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)] hover:border-[#16a34a]/40 ${isSelected ? 'border-[#16a34a] ring-1 ring-[#16a34a]/25 bg-[#f6fdf8]' : 'border-black/[0.08]'
        }`}
    >
      {/* AI Match Circular Indicator */}
      {job.match_score !== undefined && job.match_score > 0 && (
        <div className="absolute top-4 right-4 z-10 group/match">
          <div className="relative w-8 h-8 flex items-center justify-center bg-white rounded-full border border-black/[0.08] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
            <svg className="w-7 h-7 -rotate-90">
              <circle
                cx="14"
                cy="14"
                r="11"
                stroke="currentColor"
                strokeWidth="2"
                fill="transparent"
                className="text-black/[0.08]"
              />
              <circle
                cx="14"
                cy="14"
                r="11"
                stroke="currentColor"
                strokeWidth="2"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 11}
                strokeDashoffset={2 * Math.PI * 11 * (1 - job.match_score / 100)}
                strokeLinecap="round"
                className={`transition-all duration-1000 ease-out ${job.match_score > 70 ? 'text-[#16a34a]' :
                    job.match_score > 40 ? 'text-[#16a34a]' :
                      'text-orange-500'
                  }`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/match:opacity-100 transition-all duration-300 bg-white/90 backdrop-blur-sm rounded-full">
              <span className="text-[8px] font-black text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>
                {Math.round(job.match_score)}%
              </span>
            </div>
            {/* Small glow dot always visible if score is high */}
            {job.match_score > 80 && (
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[#16a34a] rounded-full animate-pulse shadow-[0_0_8px_rgba(22,163,74,0.5)] group-hover/match:opacity-0 transition-opacity" />
            )}
          </div>
        </div>
      )}
      <div className="flex gap-5 items-start">
        <div className="flex flex-col items-center shrink-0 gap-2.5">
          <div
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-[14px] flex items-center justify-center border border-black/[0.06] overflow-hidden transition-colors"
            style={{ background: job.company_logo ? '#ffffff' : tint.bg }}
          >
            {job.company_logo ? (
              <img
                src={job.company_logo}
                alt={companyName}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-lg font-bold" style="color:${tint.text}">${getInitial(companyName)}</span>`;
                }}
              />
            ) : (
              <span className="text-lg font-bold" style={{ color: tint.text, fontFamily: 'var(--font-outfit)' }}>
                {getInitial(companyName)}
              </span>
            )}
          </div>

          {/* Bookmark Toggle below logo */}
          <button
            onClick={(e) => onToggleBookmark?.(e, job.id)}
            className={`w-full flex justify-center cursor-pointer p-2 rounded-xl border transition-all ${job.is_bookmarked
                ? 'bg-[#16a34a]/10 border-[#16a34a]/25 text-[#16a34a]'
                : 'bg-white border-black/[0.08] text-black/35 hover:border-black/20 hover:text-black/60'
              }`}
            title={job.is_bookmarked ? "Unbookmark" : "Bookmark"}
          >
            <Bookmark size={16} fill={job.is_bookmarked ? "currentColor" : "none"} />
          </button>

          <button
            onClick={handleCopyLink}
            className={`w-full flex justify-center cursor-pointer p-2 rounded-xl border transition-all ${
              copied
                ? 'bg-[#16a34a]/10 border-[#16a34a]/25 text-[#16a34a]'
                : 'bg-white border-black/[0.08] text-black/35 hover:text-black/70 hover:border-black/20'
            }`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className="max-w-[85%] text-sm sm:text-base font-semibold text-[#0b0b0c] group-hover:text-[#16a34a] transition-colors truncate tracking-[-0.01em]"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            {job.title}
          </h3>

          <div className="flex items-center gap-3 mb-3 mt-1.5">
            <p className="max-w-[90%] text-sm text-[rgba(61,61,61,0.72)] truncate">{companyName}</p>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <div
              className="flex items-center gap-1 text-[11px] text-black/55 bg-black/[0.03] px-2 py-1 rounded-full border border-black/[0.08]"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              <MapPin size={12} />
              {job.location || 'Not specified'}
            </div>
            {job.is_remote && (
              <div className="flex items-center gap-1 text-[11px] text-[#16a34a] bg-[#16a34a]/10 px-2 py-1 rounded-full border border-[#16a34a]/20" style={{ fontFamily: 'var(--font-outfit)' }}>
                Remote
              </div>
            )}
            {job.is_bookmarked && (
              <div className="flex items-center gap-1 text-[11px] text-[#16a34a] bg-[#16a34a]/10 px-2 py-1 rounded-full border border-[#16a34a]/20" style={{ fontFamily: 'var(--font-outfit)' }}>
                <Bookmark size={10} fill="currentColor" />
                Bookmarked
              </div>
            )}
            {job.job_type && (
              <div className="flex items-center gap-1 text-[11px] text-black/55 bg-black/[0.03] px-2 py-1 rounded-full border border-black/[0.08]" style={{ fontFamily: 'var(--font-outfit)' }}>
                <Briefcase size={12} />
                {job.job_type.split(',')[0]}
              </div>
            )}
            {job.category && (
              <div className="flex items-center gap-1 text-[11px] text-black/55 bg-black/[0.03] px-2 py-1 rounded-full border border-black/[0.08]" style={{ fontFamily: 'var(--font-outfit)' }}>
                <Tag size={12} />
                {job.category}
              </div>
            )}
            {job.experience_required && (
              <div className="flex items-center gap-1 text-[11px] text-black/55 bg-black/[0.03] px-2 py-1 rounded-full border border-black/[0.08]" style={{ fontFamily: 'var(--font-outfit)' }}>
                <GraduationCap size={12} />
                {job.experience_required}
              </div>
            )}
            {job.salary && (
              <div className="flex items-center gap-1 text-[11px] text-[#16a34a] bg-[#16a34a]/10 px-2 py-1 rounded-full border border-[#16a34a]/20" style={{ fontFamily: 'var(--font-outfit)' }}>
                <DollarSign size={12} />
                {job.salary}
              </div>
            )}
          </div>

          <p className="text-xs text-black/45 line-clamp-2 leading-relaxed mb-5">
            {job.description || 'No description provided...'}
          </p>

          <div className="flex justify-between items-center mb-1">
            <a
              href={job.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#16a34a] hover:underline font-medium"
              style={{ fontFamily: 'var(--font-outfit)' }}
              onClick={(e) => e.stopPropagation()}
            >
              Apply here
            </a>

            {(job.date_posted || job.created_at) && (
              <span className="text-[10px] text-black/40 ml-auto" style={{ fontFamily: 'var(--font-outfit)' }}>
                {formatDate(job.date_posted || job.created_at)}
              </span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCoverLetterOpen(true);
            }}
            className="cursor-pointer mt-3 flex items-center gap-1.5 text-[11px] text-black/45 hover:text-[#0b0b0c] font-semibold uppercase tracking-widest transition-colors"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            <FileEdit size={12} />
            Cover Letter &amp; Prep
          </button>
        </div>
      </div>
    </div>

    <CoverLetterModal
      isOpen={isCoverLetterOpen}
      onClose={() => setIsCoverLetterOpen(false)}
      job={{ id: job.id, title: job.title, company: job.company }}
    />
    </>
  );
});
