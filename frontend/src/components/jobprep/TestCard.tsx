'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, ListChecks, Trophy, ArrowRight } from 'lucide-react';
import type { MockTest } from '@/components/jobprep/types';
import DifficultyBadge from '@/components/jobprep/DifficultyBadge';

const CATEGORY_LABEL: Record<MockTest['category'], string> = {
  quant: 'Quant',
  reasoning: 'Reasoning',
  verbal: 'Verbal',
  coding: 'Coding',
  mixed: 'Mixed Placement',
};

export default function TestCard({ test, bestScore }: { test: MockTest; bestScore?: number }) {
  return (
    <Link href={`/preparation/tests/${test.id}`}>
      <motion.div whileHover={{ y: -3 }} className="bg-[#111] border border-[#222] rounded-2xl p-5 hover:border-green-500/30 transition-colors h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
            {CATEGORY_LABEL[test.category]}
          </span>
          <DifficultyBadge difficulty={test.difficulty} />
        </div>

        <h3 className="text-sm font-bold text-white mb-3">{test.title}</h3>

        <div className="flex flex-wrap gap-3 text-[11px] text-[#666] mb-4">
          <span className="flex items-center gap-1"><Clock size={12} /> {test.durationMins} min</span>
          <span className="flex items-center gap-1"><ListChecks size={12} /> {test.questionCount} questions</span>
          <span className="flex items-center gap-1"><Trophy size={12} /> Pass {test.passingPercent}%</span>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <span className="text-[10px] text-[#555]">{bestScore !== undefined ? `Best: ${bestScore}%` : 'Not attempted'}</span>
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-white bg-white/5 group-hover:bg-white/10 px-3 py-1.5 rounded-full">
            Start <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </motion.div>
    </Link>
  );
}
