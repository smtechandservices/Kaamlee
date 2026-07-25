import type { Difficulty } from '@/components/jobprep/types';

const STYLES: Record<Difficulty, string> = {
  easy: 'text-green-400 border-green-500/30 bg-green-500/10',
  medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  hard: 'text-red-400 border-red-500/30 bg-red-500/10',
};

const LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export default function DifficultyBadge({ difficulty, className = '' }: { difficulty: Difficulty; className?: string }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${STYLES[difficulty]} ${className}`}>
      {LABELS[difficulty]}
    </span>
  );
}
