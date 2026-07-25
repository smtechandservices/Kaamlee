'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import type { McqQuestion } from '@/components/jobprep/types';
import DifficultyBadge from '@/components/jobprep/DifficultyBadge';

export default function DailyChallengeCard({ question, solved }: { question: McqQuestion; solved: boolean }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border border-purple-500/20 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-purple-300">Daily Challenge</p>
        </div>
        <DifficultyBadge difficulty={question.difficulty} />
      </div>
      <p className="text-sm text-white font-semibold leading-relaxed mb-4 line-clamp-2">{question.question}</p>
      <Link
        href={`/preparation/${question.category}/${question.topic}`}
        className="cursor-pointer inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white bg-white/10 hover:bg-white/15 px-4 py-2 rounded-full transition-all"
      >
        {solved ? 'Review Challenge' : 'Solve Now'} <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
