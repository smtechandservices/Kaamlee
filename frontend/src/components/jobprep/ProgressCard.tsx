'use client';

import { Flame, Target, ListChecks, TrendingUp } from 'lucide-react';
import CircularProgress from '@/components/jobprep/CircularProgress';

interface ProgressCardProps {
  dailyGoal: number;
  todaySolved: number;
  streak: number;
  totalSolved: number;
  weeklyActivity: { date: string; count: number }[];
  readinessPercent: number;
}

export default function ProgressCard({ dailyGoal, todaySolved, streak, totalSolved, weeklyActivity, readinessPercent }: ProgressCardProps) {
  const goalPct = dailyGoal > 0 ? Math.round((Math.min(todaySolved, dailyGoal) / dailyGoal) * 100) : 0;
  const maxCount = Math.max(1, ...weeklyActivity.map((d) => d.count));

  return (
    <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="w-5 h-5 text-green-500" />
        <h2 className="text-sm font-black uppercase tracking-widest text-white">Daily Progress</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 flex flex-col items-center text-center">
          <CircularProgress percent={goalPct} size={48} strokeWidth={4} label={<span className="text-[10px] font-black text-white">{todaySolved}/{dailyGoal}</span>} />
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#555] mt-2">Today&apos;s Goal</p>
        </div>

        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 mb-1">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="text-xl font-black text-white">{streak}</span>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#555]">Day Streak</p>
        </div>

        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 mb-1">
            <ListChecks className="w-5 h-5 text-green-500" />
            <span className="text-xl font-black text-white">{totalSolved}</span>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#555]">Questions Solved</p>
        </div>

        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 flex flex-col items-center text-center">
          <CircularProgress percent={readinessPercent} size={48} strokeWidth={4} colorClassName="text-blue-400" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#555] mt-2 flex items-center gap-1">
            <Target size={9} /> Readiness
          </p>
        </div>
      </div>

      <p className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-3">Weekly Activity</p>
      <div className="flex items-end justify-between gap-2 h-20">
        {weeklyActivity.map((d) => {
          const heightPct = Math.max(6, Math.round((d.count / maxCount) * 100));
          const label = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' });
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-md transition-all duration-500 ${d.count > 0 ? 'bg-green-500/70' : 'bg-[#1a1a1a]'}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[9px] text-[#555] font-bold">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
