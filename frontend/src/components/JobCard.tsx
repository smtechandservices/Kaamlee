'use client';

import React from 'react';
import { MapPin, Briefcase, ExternalLink, Clock } from 'lucide-react';

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
    min_amount?: number | null;
    max_amount?: number | null;
    currency?: string | null;
    interval?: string | null;
    experience_range?: string | null;
    skills?: string | null;
    company_rating?: number | null;
    date_posted?: string | null;
  };
  isSelected?: boolean;
  onClick?: () => void;
}

export const JobCard = ({ job, isSelected, onClick }: JobCardProps) => {
  const companyName = job.company || 'Confidential';
  const getInitial = (name: string) => name ? name.charAt(0).toUpperCase() : '?';

  const formatSalary = () => {
    if (job.min_amount && job.max_amount) {
      return `${job.currency || '$'}${Math.round(job.min_amount)}k - ${job.currency || '$'}${Math.round(job.max_amount)}k ${job.interval ? `/ ${job.interval}` : ''}`;
    } else if (job.min_amount) {
      return `${job.currency || '$'}${Math.round(job.min_amount)}k+ ${job.interval ? `/ ${job.interval}` : ''}`;
    }
    return null;
  };

  const salaryString = formatSalary();

  return (
    <div 
      onClick={onClick}
      className={`job-card p-4 rounded-xl border border-[#222] bg-[#111] hover:border-[#3b82f6] cursor-pointer group transition-all ${
        isSelected ? 'border-[#3b82f6] bg-[#161616]' : ''
      }`}
    >
      <div className="flex gap-4 items-start">
        <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center border border-[#333] overflow-hidden group-hover:border-[#3b82f6] transition-colors shrink-0">
          {job.company_logo ? (
            <img 
              src={job.company_logo} 
              alt={companyName} 
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-xl font-bold text-[#333]">${getInitial(companyName)}</span>`;
              }}
            />
          ) : (
            <span className="text-xl font-bold text-[#333]">
              {getInitial(companyName)}
            </span>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white group-hover:text-[#3b82f6] transition-colors truncate">
            {job.title}
          </h3>
          
          <div className="flex items-center gap-2 mb-3 mt-1">
            <p className="text-sm text-[#888] truncate">{companyName}</p>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-1 text-[11px] text-[#666] bg-[#1a1a1a] px-2 py-1 rounded-full border border-[#222]">
              <MapPin size={12} />
              {job.location}
            </div>
            {job.is_remote && (
              <div className="flex items-center gap-1 text-[11px] text-green-500/80 bg-green-500/5 px-2 py-1 rounded-full border border-green-500/10">
                Remote
              </div>
            )}
            {job.job_type && (
              <div className="flex items-center gap-1 text-[11px] text-[#666] bg-[#1a1a1a] px-2 py-1 rounded-full border border-[#222]">
                <Briefcase size={12} />
                {job.job_type.split(',')[0]}
              </div>
            )}
            {salaryString && (
              <div className="flex items-center gap-1 text-[11px] text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20 font-medium">
                {salaryString}
              </div>
            )}
            {job.experience_range && (
              <div className="flex items-center gap-1 text-[11px] text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/20">
                <Clock size={12} />
                {job.experience_range}
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
              className="text-xs text-[#3b82f6] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Apply on {job.site}
            </a>
            
            {job.date_posted && (
              <span className="text-[10px] text-[#555] ml-auto">
                {job.date_posted}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
