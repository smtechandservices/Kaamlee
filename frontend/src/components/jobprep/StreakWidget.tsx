'use client';

import { Flame } from 'lucide-react';

const MESSAGES = [
  "Let's start your streak today!",
  'Great start — come back tomorrow to keep it going.',
  "You're on a roll, keep it up!",
  "Don't break the chain now!",
  "You're unstoppable this week!",
];

export default function StreakWidget({ streak, longest }: { streak: number; longest: number }) {
  const message = streak === 0 ? MESSAGES[0] : streak < 3 ? MESSAGES[1] : streak < 7 ? MESSAGES[2] : streak < 14 ? MESSAGES[3] : MESSAGES[4];

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-orange-500/10 to-red-500/5 border border-orange-500/20 rounded-2xl p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shrink-0 shadow-lg">
        <Flame className="w-6 h-6 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black text-white">
          {streak} Day{streak === 1 ? '' : 's'} Streak
          {longest > streak && <span className="text-[#555] font-medium"> · best {longest}</span>}
        </p>
        <p className="text-[11px] text-[#888] mt-0.5">{message}</p>
      </div>
    </div>
  );
}
