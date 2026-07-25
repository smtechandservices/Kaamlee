'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Share2, Lightbulb, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { McqQuestion, OpenQuestion } from '@/components/jobprep/types';
import DifficultyBadge from '@/components/jobprep/DifficultyBadge';

interface McqCardProps {
  kind: 'mcq';
  question: McqQuestion;
  index: number;
  total: number;
  selected: number | null;
  submitted: boolean;
  onSelect: (optionIndex: number) => void;
  onSubmit: () => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}

interface OpenCardProps {
  kind: 'open';
  question: OpenQuestion;
  index: number;
  total: number;
  revealed: boolean;
  onReveal: () => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}

type QuestionCardProps = McqCardProps | OpenCardProps;

function ActionButtons({ isBookmarked, onToggleBookmark }: { isBookmarked: boolean; onToggleBookmark: () => void }) {
  const handleShare = () => {
    if (typeof window !== 'undefined') navigator.clipboard?.writeText(window.location.href);
  };
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleBookmark}
        title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
        className={`cursor-pointer p-2 rounded-lg border transition-all ${
          isBookmarked ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-transparent border-[#222] text-[#555] hover:border-[#333] hover:text-white'
        }`}
      >
        <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        onClick={handleShare}
        title="Copy link"
        className="cursor-pointer p-2 rounded-lg border border-[#222] text-[#555] hover:border-[#333] hover:text-white transition-all"
      >
        <Share2 size={14} />
      </button>
    </div>
  );
}

function Header({
  index,
  total,
  difficulty,
  estimatedTime,
  isBookmarked,
  onToggleBookmark,
}: {
  index: number;
  total: number;
  difficulty: McqQuestion['difficulty'];
  estimatedTime: number;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#555]">
          Question {index + 1} / {total}
        </span>
        <DifficultyBadge difficulty={difficulty} />
        <span className="flex items-center gap-1 text-[10px] text-[#555]">
          <Clock size={11} /> ~{Math.round(estimatedTime / 60) || 1} min
        </span>
      </div>
      <ActionButtons isBookmarked={isBookmarked} onToggleBookmark={onToggleBookmark} />
    </div>
  );
}

export default function QuestionCard(props: QuestionCardProps) {
  const [showHint, setShowHint] = useState(false);

  if (props.kind === 'open') {
    const { question, index, total, revealed, onReveal, isBookmarked, onToggleBookmark } = props;
    return (
      <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl">
        <Header index={index} total={total} difficulty={question.difficulty} estimatedTime={question.estimatedTime} isBookmarked={isBookmarked} onToggleBookmark={onToggleBookmark} />
        <p className="text-white text-base sm:text-lg font-semibold leading-relaxed mb-6">{question.question}</p>

        {!revealed ? (
          <button
            type="button"
            onClick={onReveal}
            className="cursor-pointer w-full bg-white text-black font-black uppercase tracking-widest py-3 rounded-xl hover:bg-[#ededed] active:scale-[0.98] transition-all text-xs"
          >
            Reveal Model Answer
          </button>
        ) : (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="bg-[#0a0a0a] border border-green-500/20 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-green-400 mb-2">Model Answer</p>
                <p className="text-xs text-[#ccc] leading-relaxed">{question.modelAnswer}</p>
              </div>
              <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-2 flex items-center gap-1.5">
                  <Lightbulb size={12} className="text-yellow-400" /> Tips
                </p>
                <ul className="space-y-1.5">
                  {question.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-[#888] flex gap-2">
                      <span className="text-green-500">•</span> {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    );
  }

  const { question, index, total, selected, submitted, onSelect, onSubmit, isBookmarked, onToggleBookmark } = props;

  return (
    <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl">
      <Header index={index} total={total} difficulty={question.difficulty} estimatedTime={question.estimatedTime} isBookmarked={isBookmarked} onToggleBookmark={onToggleBookmark} />

      <p className="text-white text-base sm:text-lg font-semibold leading-relaxed mb-6">{question.question}</p>

      <div className="space-y-2.5 mb-6">
        {question.options.map((option, i) => {
          const isSelected = selected === i;
          const isCorrect = i === question.answer;
          let stateClasses = 'border-[#222] hover:border-[#333] text-[#ccc]';
          if (submitted) {
            if (isCorrect) stateClasses = 'border-green-500/50 bg-green-500/10 text-green-400';
            else if (isSelected) stateClasses = 'border-red-500/50 bg-red-500/10 text-red-400';
            else stateClasses = 'border-[#222] text-[#555]';
          } else if (isSelected) {
            stateClasses = 'border-green-500/50 bg-green-500/10 text-white';
          }
          return (
            <button
              key={i}
              type="button"
              disabled={submitted}
              onClick={() => onSelect(i)}
              className={`cursor-pointer w-full text-left px-4 py-3 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-center justify-between gap-3 disabled:cursor-default ${stateClasses}`}
            >
              <span>{option}</span>
              {submitted && isCorrect && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {submitted && isSelected && !isCorrect && <XCircle className="w-4 h-4 shrink-0" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 mb-2">
        <button
          type="button"
          onClick={() => setShowHint((s) => !s)}
          className="cursor-pointer flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-yellow-400 hover:text-yellow-300 transition-colors"
        >
          <Lightbulb size={13} /> {showHint ? 'Hide Hint' : 'Show Hint'}
        </button>
        {!submitted && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={selected === null}
            className="cursor-pointer bg-white text-black font-black uppercase tracking-widest py-2.5 px-6 rounded-xl hover:bg-[#ededed] active:scale-[0.98] transition-all text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Submit
          </button>
        )}
      </div>

      <AnimatePresence>
        {showHint && !submitted && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-xs text-yellow-200/80 mb-2 overflow-hidden">
            {question.hint}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {submitted && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-5 mt-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-2">Explanation</p>
            <p className="text-xs text-[#888] leading-relaxed">{question.explanation}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
