'use client';

import React from 'react';
import { MapPin, Briefcase, ExternalLink, Clock, Bookmark, Copy, Check } from 'lucide-react';

interface JobCardProps {
  job: {
    title: string;
    company: string | null;
    location: string;
    is_remote: boolean;
    job_type: string;
    job_url: string;
    description: string;
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

export const JobCard = React.memo(function JobCard({ job, isSelected, onClick, onToggleBookmark }: JobCardProps) {
  const [copied, setCopied] = React.useState(false);
  const companyName = job.company || 'Confidential';
  const getInitial = (name: string) => name ? name.charAt(0).toUpperCase() : '?';

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
    <div
      onClick={() => onClick?.(job.id)}
      className={`cursor-default job-card p-4 rounded-xl border border-[#222] bg-[#111] hover:border-[#22c55e] group transition-all relative overflow-hidden ${isSelected ? 'border-[#22c55e] bg-[#161616]' : ''
        }`}
    >
      {/* AI Match Circular Indicator */}
      {job.match_score !== undefined && job.match_score > 0 && (
        <div className="absolute top-4 right-4 z-10 group/match">
          <div className="relative w-8 h-8 flex items-center justify-center bg-[#111] rounded-full border border-[#222] shadow-lg">
            <svg className="w-7 h-7 -rotate-90">
              <circle
                cx="14"
                cy="14"
                r="11"
                stroke="currentColor"
                strokeWidth="2"
                fill="transparent"
                className="text-[#1a1a1a]"
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
                className={`transition-all duration-1000 ease-out ${job.match_score > 70 ? 'text-green-500' :
                    job.match_score > 40 ? 'text-green-500' :
                      'text-orange-500'
                  }`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/match:opacity-100 transition-all duration-300 bg-[#111]/80 backdrop-blur-sm rounded-full">
              <span className="text-[8px] font-black text-white">
                {Math.round(job.match_score)}%
              </span>
            </div>
            {/* Small glow dot always visible if score is high */}
            {job.match_score > 80 && (
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)] group-hover/match:opacity-0 transition-opacity" />
            )}
          </div>
        </div>
      )}
      <div className="flex gap-3 sm:gap-4 items-start">
        <div className="flex flex-col items-center shrink-0 gap-2">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white flex items-center justify-center border border-[#333] overflow-hidden group-hover:border-[#22c55e] transition-colors">
            {job.company_logo ? (
              <img
                src={job.company_logo}
                alt={companyName}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-lg sm:text-xl font-bold text-[#333]">${getInitial(companyName)}</span>`;
                }}
              />
            ) : (
              <span className="text-lg sm:text-xl font-bold text-[#333]">
                {getInitial(companyName)}
              </span>
            )}
          </div>

          {/* Bookmark Toggle below logo */}
          <button
            onClick={(e) => onToggleBookmark?.(e, job.id)}
            className={`w-full flex justify-center cursor-pointer p-1.5 sm:p-2 rounded-lg border transition-all ${job.is_bookmarked
                ? 'bg-green-500/10 border-green-500/30 text-green-500'
                : 'bg-transparent border-[#222] text-[#444] hover:border-[#333] hover:text-[#666]'
              }`}
            title={job.is_bookmarked ? "Unbookmark" : "Bookmark"}
          >
            <Bookmark size={16} fill={job.is_bookmarked ? "currentColor" : "none"} />
          </button>

          <button
            onClick={handleCopyLink}
            className={`w-full flex justify-center cursor-pointer p-1.5 sm:p-2 rounded-lg border transition-all ${
              copied 
                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                : 'bg-[#161616] border-[#222] text-[#555] hover:text-white hover:border-[#333]'
            }`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="max-w-[85%] font-semibold text-white group-hover:text-[#22c55e] transition-colors truncate">
            {job.title}
          </h3>

          <div className="flex items-center gap-3 mb-3 mt-1">
            <p className="max-w-[90%] text-sm text-[#888] truncate">{companyName}</p>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-1 text-[11px] text-[#666] bg-[#1a1a1a] px-2 py-1 rounded-full border border-[#222]">
              <MapPin size={12} />
              {job.location || 'Not specified'}
            </div>
            {job.is_remote && (
              <div className="flex items-center gap-1 text-[11px] text-green-500/80 bg-green-500/5 px-2 py-1 rounded-full border border-green-500/10">
                Remote
              </div>
            )}
            {job.is_bookmarked && (
              <div className="flex items-center gap-1 text-[11px] text-green-500/80 bg-green-500/5 px-2 py-1 rounded-full border border-green-500/10">
                <Bookmark size={10} fill="currentColor" />
                Bookmarked
              </div>
            )}
            {job.job_type && (
              <div className="flex items-center gap-1 text-[11px] text-[#666] bg-[#1a1a1a] px-2 py-1 rounded-full border border-[#222]">
                <Briefcase size={12} />
                {job.job_type.split(',')[0]}
              </div>
            )}


          </div>

          <p className="text-xs text-[#555] line-clamp-2 leading-relaxed mb-4">
            {job.description || 'No description provided...'}
          </p>

          <div className="flex justify-between items-center">
            <a 
              href={job.job_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-[#22c55e] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Apply on {job.site}
            </a>
            
            {(job.date_posted || job.created_at) && (
              <span className="text-[10px] text-[#555] ml-auto">
                {formatDate(job.date_posted || job.created_at)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
