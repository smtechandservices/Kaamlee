'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import CircularProgress from '@/components/jobprep/CircularProgress';

interface TopicCardProps {
  href: string;
  name: string;
  questionCount: number;
  completionPercent: number;
}

export default function TopicCard({ href, name, questionCount, completionPercent }: TopicCardProps) {
  const started = completionPercent > 0;

  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -2 }}
        className="group flex items-center gap-4 bg-[#111] border border-[#222] rounded-2xl p-4 hover:border-green-500/30 transition-colors"
      >
        <CircularProgress percent={completionPercent} size={44} strokeWidth={4} label={<span className="text-[9px] font-black text-white">{completionPercent}%</span>} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate group-hover:text-green-400 transition-colors">{name}</p>
          <p className="text-[10px] text-[#555] mt-0.5">{questionCount} question{questionCount === 1 ? '' : 's'}</p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all flex items-center gap-1 ${
            started
              ? 'border-green-500/30 bg-green-500/10 text-green-400 group-hover:border-green-500/50'
              : 'border-[#222] text-[#888] group-hover:border-[#333]'
          }`}
        >
          {started ? 'Continue' : 'Start'}
          <ChevronRight className="w-3 h-3" />
        </span>
      </motion.div>
    </Link>
  );
}
