'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Brain, Code2, BookOpenText, Puzzle, Briefcase, Building2, ArrowRight, type LucideIcon } from 'lucide-react';
import type { CategoryMeta } from '@/components/jobprep/types';

const ICON_MAP: Record<string, LucideIcon> = { Brain, Code2, BookOpenText, Puzzle, Briefcase, Building2 };

interface PreparationCardProps {
  category: CategoryMeta;
  questionCount: number;
  completionPercent?: number;
}

export default function PreparationCard({ category, questionCount, completionPercent = 0 }: PreparationCardProps) {
  const Icon = ICON_MAP[category.icon] ?? Brain;

  return (
    <Link href={`/preparation/${category.id}`} className="block h-full">
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="group relative overflow-hidden bg-[#111] border border-[#222] rounded-2xl p-6 hover:border-[#333] transition-colors h-full flex flex-col"
      >
        <div
          className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${category.gradient} opacity-10 group-hover:opacity-25 transition-opacity blur-2xl pointer-events-none`}
        />

        <div className="relative flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.gradient} flex items-center justify-center shadow-lg shrink-0`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl leading-none">{category.emoji}</span>
        </div>

        <h3 className="text-base font-black text-white mb-1.5 group-hover:text-green-400 transition-colors">{category.title}</h3>
        <p className="text-xs text-[#666] leading-relaxed mb-4 line-clamp-2 flex-1">{category.description}</p>

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#555]">{questionCount} Questions</span>
          <ArrowRight className="w-4 h-4 text-[#444] group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
        </div>

        {completionPercent > 0 && (
          <div className="mt-3 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-700"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        )}
      </motion.div>
    </Link>
  );
}
