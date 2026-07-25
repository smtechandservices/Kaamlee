'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface QuestionNavigatorProps {
  total: number;
  currentIndex: number;
  answeredIndexes: number[];
  onJump: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function QuestionNavigator({ total, currentIndex, answeredIndexes, onJump, onPrev, onNext }: QuestionNavigatorProps) {
  const progressPct = Math.round(((currentIndex + 1) / total) * 100);

  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl p-4">
      <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-4">
        <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {Array.from({ length: total }).map((_, i) => {
          const isActive = i === currentIndex;
          const isAnswered = answeredIndexes.includes(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onJump(i)}
              className={`cursor-pointer w-7 h-7 rounded-lg text-[10px] font-bold transition-all ${
                isActive
                  ? 'bg-white text-black'
                  : isAnswered
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : 'bg-[#1a1a1a] text-[#666] border border-[#222] hover:border-[#333]'
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="cursor-pointer flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} /> Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={currentIndex === total - 1}
          className="cursor-pointer flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
