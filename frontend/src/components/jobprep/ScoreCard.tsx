'use client';

import { Trophy, RotateCcw, Home } from 'lucide-react';
import CircularProgress from '@/components/jobprep/CircularProgress';

interface ScoreCardProps {
  score: number;
  total: number;
  passingPercent: number;
  onRetake: () => void;
  onExit: () => void;
}

export default function ScoreCard({ score, total, passingPercent, onRetake, onExit }: ScoreCardProps) {
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = percent >= passingPercent;

  return (
    <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-8 shadow-2xl text-center">
      <div className={`w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center ${passed ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
        <Trophy className={`w-8 h-8 ${passed ? 'text-green-400' : 'text-red-400'}`} />
      </div>

      <h2 className="text-xl font-black text-white mb-1">{passed ? 'Test Passed!' : 'Test Completed'}</h2>
      <p className="text-xs text-[#666] mb-6">
        {passed ? 'Great work — you cleared the passing threshold.' : `You needed ${passingPercent}% to pass. Keep practicing!`}
      </p>

      <div className="flex justify-center mb-6">
        <CircularProgress percent={percent} size={120} strokeWidth={8} colorClassName={passed ? 'text-green-500' : 'text-red-400'} label={<span className="text-2xl font-black text-white">{percent}%</span>} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3">
          <p className="text-lg font-black text-white">{score}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#555] mt-0.5">Correct</p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3">
          <p className="text-lg font-black text-white">{total - score}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#555] mt-0.5">Incorrect</p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3">
          <p className="text-lg font-black text-white">{total}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#555] mt-0.5">Total</p>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-dashed border-[#333] rounded-2xl p-4 mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#555]">Leaderboard</p>
        <p className="text-[11px] text-[#555] mt-1">Coming soon — compare your score with other Kaamlee users.</p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetake}
          className="cursor-pointer flex-1 flex items-center justify-center gap-2 bg-[#1a1a1a] border border-[#222] hover:border-[#333] text-white font-bold uppercase tracking-widest py-3 rounded-xl transition-all text-xs"
        >
          <RotateCcw className="w-4 h-4" /> Retake
        </button>
        <button
          type="button"
          onClick={onExit}
          className="cursor-pointer flex-1 flex items-center justify-center gap-2 bg-white text-black font-black uppercase tracking-widest py-3 rounded-xl hover:bg-[#ededed] transition-all text-xs"
        >
          <Home className="w-4 h-4" /> Back to Tests
        </button>
      </div>
    </div>
  );
}
