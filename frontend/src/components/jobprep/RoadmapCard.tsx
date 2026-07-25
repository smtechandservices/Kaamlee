'use client';

import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import type { RoadmapStage } from '@/components/jobprep/types';

interface RoadmapCardProps {
  stage: RoadmapStage;
  stageIndex: number;
  completedMilestoneIds: Set<string>;
}

export default function RoadmapCard({ stage, stageIndex, completedMilestoneIds }: RoadmapCardProps) {
  const doneCount = stage.milestones.filter((m) => completedMilestoneIds.has(m.id)).length;
  const pct = stage.milestones.length > 0 ? Math.round((doneCount / stage.milestones.length) * 100) : 0;

  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-7 h-7 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-black flex items-center justify-center shrink-0">
          {stageIndex + 1}
        </span>
        <h3 className="text-base font-black text-white">{stage.title}</h3>
        <span className="ml-auto text-[10px] font-bold text-[#555]">{doneCount}/{stage.milestones.length}</span>
      </div>
      <p className="text-xs text-[#666] mb-4 ml-10">{stage.description}</p>

      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden mb-4 ml-10">
        <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-1.5 ml-2">
        {stage.milestones.map((m) => {
          const done = completedMilestoneIds.has(m.id);
          const href = m.topicSlug ? `/preparation/${m.categoryId}/${m.topicSlug}` : `/preparation/${m.categoryId}`;
          return (
            <Link
              key={m.id}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors group"
            >
              {done ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <Circle className="w-4 h-4 text-[#333] shrink-0" />}
              <span className={`text-xs truncate ${done ? 'text-[#666] line-through' : 'text-[#ccc] group-hover:text-white'}`}>{m.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
