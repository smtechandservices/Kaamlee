'use client';

import { Flame, Trophy, Award, Zap, Target, Medal, Star, Crown, type LucideIcon } from 'lucide-react';
import type { Achievement } from '@/components/jobprep/types';

const ICON_MAP: Record<string, LucideIcon> = { Flame, Trophy, Award, Zap, Target, Medal, Star, Crown };

export default function AchievementBadge({ achievement, unlocked }: { achievement: Achievement; unlocked: boolean }) {
  const Icon = ICON_MAP[achievement.icon] ?? Award;

  return (
    <div
      className={`flex flex-col items-center text-center gap-2.5 rounded-2xl border p-5 transition-all ${
        unlocked ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/30' : 'bg-[#0a0a0a] border-[#222]'
      }`}
    >
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
          unlocked ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg' : 'bg-[#161616] border border-[#222]'
        }`}
      >
        <Icon className={`w-7 h-7 ${unlocked ? 'text-white' : 'text-[#444]'}`} />
      </div>
      <div>
        <p className={`text-xs font-black ${unlocked ? 'text-white' : 'text-[#555]'}`}>{achievement.label}</p>
        <p className="text-[10px] text-[#666] mt-1 leading-relaxed">{achievement.description}</p>
      </div>
      {!unlocked && <span className="text-[9px] font-bold uppercase tracking-widest text-[#444] bg-[#161616] px-2 py-0.5 rounded-full">Locked</span>}
    </div>
  );
}
