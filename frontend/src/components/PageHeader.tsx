'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import SidebarToggle from '@/components/SidebarToggle';

interface PageHeaderProps {
  /** Where the mobile-only "Back" link points. */
  backHref: string;
  title: React.ReactNode;
  /** Use the "KAAMLEE" wordmark styling — hidden on mobile, non-interactive. */
  wordmark?: boolean;
  /** Extra content after the title, still inside the left flex-1 container (e.g. a count badge). */
  badge?: React.ReactNode;
  /** Extra content on the right, rendered before SidebarToggle (e.g. view-mode toggles). */
  children?: React.ReactNode;
}

export default function PageHeader({ backHref, title, wordmark = false, badge, children }: PageHeaderProps) {
  return (
    <header className="h-16 border-b border-[#222] px-4 sm:px-6 flex items-center justify-between z-20 shrink-0">
      <div className="flex items-center gap-3 sm:gap-4 flex-1 overflow-hidden">
        <Link href={backHref} className="group flex md:hidden items-center gap-1.5 sm:gap-2 text-[#555] hover:text-white transition-colors mr-1 sm:mr-2 shrink-0">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] hidden sm:inline">Back</span>
        </Link>
        <div className="w-px h-4 bg-[#222] mr-1 sm:mr-2 shrink-0 md:hidden" />
        <h1
          className={`text-lg sm:text-xl font-black tracking-tighter text-white mr-2 sm:mr-4 truncate ${
            wordmark ? 'hidden sm:inline cursor-default' : ''
          }`}
        >
          {title}
        </h1>
        {badge}
      </div>

      <div className="flex items-center gap-2">
        {children}
        <SidebarToggle />
      </div>
    </header>
  );
}
