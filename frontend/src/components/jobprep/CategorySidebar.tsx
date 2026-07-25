'use client';

import type { Difficulty, TopicMeta } from '@/components/jobprep/types';

interface CategorySidebarProps {
  topics: TopicMeta[];
  topicProgress: Record<string, { attempted: number; correct: number }>;
  topicCounts: Record<string, number>;
  activeTopic?: string;
  difficultyFilter: Difficulty | 'all';
  onDifficultyChange: (value: Difficulty | 'all') => void;
  onTopicClick?: (slug: string) => void;
}

const DIFFICULTIES: (Difficulty | 'all')[] = ['all', 'easy', 'medium', 'hard'];

export default function CategorySidebar({
  topics,
  topicProgress,
  topicCounts,
  activeTopic,
  difficultyFilter,
  onDifficultyChange,
  onTopicClick,
}: CategorySidebarProps) {
  return (
    <aside className="hidden lg:block w-64 shrink-0 sticky top-0 self-start space-y-4">
      <div className="bg-[#111] border border-[#222] rounded-2xl p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-3">Difficulty</p>
        <div className="flex flex-wrap gap-1.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDifficultyChange(d)}
              className={`cursor-pointer text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all ${
                difficultyFilter === d
                  ? 'border-green-500 bg-green-500/10 text-green-400'
                  : 'border-[#222] text-[#666] hover:border-[#333]'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#111] border border-[#222] rounded-2xl p-4 max-h-[calc(100vh-220px)] overflow-y-auto no-scrollbar">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-3">Topics</p>
        <div className="space-y-1">
          {topics.map((topic) => {
            const stats = topicProgress[topic.slug];
            const total = topicCounts[topic.slug] ?? 0;
            const pct = stats && total > 0 ? Math.round((Math.min(stats.attempted, total) / total) * 100) : 0;
            const active = activeTopic === topic.slug;
            return (
              <button
                key={topic.slug}
                type="button"
                onClick={() => onTopicClick?.(topic.slug)}
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                  active ? 'bg-green-500/10 text-green-400' : 'text-[#888] hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="truncate">{topic.name}</span>
                <span className="shrink-0 text-[9px] text-[#555]">{pct > 0 ? `${pct}%` : total}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
