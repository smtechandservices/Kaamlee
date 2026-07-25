'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, CheckCircle2, Loader2, Bookmark, Lightbulb, Clock, TerminalSquare } from 'lucide-react';
import type { CodingLanguage, CodingQuestion } from '@/components/jobprep/types';
import DifficultyBadge from '@/components/jobprep/DifficultyBadge';

const LANGUAGES: { id: CodingLanguage; label: string }[] = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
];

interface CodingQuestionPanelProps {
  question: CodingQuestion;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onSubmit: () => void;
  solved: boolean;
}

export default function CodingQuestionPanel({ question, isBookmarked, onToggleBookmark, onSubmit, solved }: CodingQuestionPanelProps) {
  const [language, setLanguage] = useState<CodingLanguage>('javascript');
  const [code, setCode] = useState<Record<CodingLanguage, string>>(question.starterCode);
  const [isRunning, setIsRunning] = useState(false);
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(solved);
  const [showHint, setShowHint] = useState(false);

  const handleRun = () => {
    setIsRunning(true);
    setRunOutput(null);
    // No backend yet — mock execution against the question's predefined sample output.
    setTimeout(() => {
      setRunOutput(question.sampleOutput);
      setIsRunning(false);
    }, 700);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setRunOutput(question.sampleOutput);
    onSubmit();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* Problem statement */}
      <div className="bg-[#111] border border-[#222] rounded-[24px] p-6 sm:p-7 shadow-2xl lg:sticky lg:top-4 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <DifficultyBadge difficulty={question.difficulty} />
            <span className="flex items-center gap-1 text-[10px] text-[#555]">
              <Clock size={11} /> ~{Math.round(question.estimatedTime / 60)} min
            </span>
          </div>
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
        </div>

        <h1 className="text-lg font-black text-white mb-3">{question.title}</h1>
        <p className="text-xs text-[#ccc] leading-relaxed whitespace-pre-line mb-5">{question.question}</p>

        <p className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-2">Sample Test Cases</p>
        <div className="space-y-2 mb-5">
          {question.testCases.map((tc, i) => (
            <div key={i} className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3 text-[11px] font-mono">
              <p className="text-[#666]">Input: <span className="text-[#ccc]">{tc.input}</span></p>
              <p className="text-[#666] mt-1">Output: <span className="text-green-400">{tc.expectedOutput}</span></p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowHint((s) => !s)}
          className="cursor-pointer flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-yellow-400 hover:text-yellow-300 transition-colors mb-2"
        >
          <Lightbulb size={13} /> {showHint ? 'Hide Hint' : 'Show Hint'}
        </button>
        <AnimatePresence>
          {showHint && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-xs text-yellow-200/80 overflow-hidden mb-2">
              {question.hint}
            </motion.div>
          )}
        </AnimatePresence>

        {submitted && (
          <div className="bg-[#0a0a0a] border border-green-500/20 rounded-xl p-4 mt-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-green-400 mb-2">Explanation</p>
            <p className="text-xs text-[#888] leading-relaxed">{question.explanation}</p>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="bg-[#111] border border-[#222] rounded-[24px] p-4 sm:p-5 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setLanguage(lang.id)}
                className={`cursor-pointer text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all ${
                  language === lang.id ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-[#222] text-[#666] hover:border-[#333]'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
          {submitted && (
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-green-400">
              <CheckCircle2 size={13} /> Solved
            </span>
          )}
        </div>

        <textarea
          value={code[language]}
          onChange={(e) => setCode((prev) => ({ ...prev, [language]: e.target.value }))}
          spellCheck={false}
          className="w-full flex-1 min-h-[280px] bg-[#0a0a0a] border border-[#222] rounded-xl p-4 text-[12px] font-mono text-[#ddd] leading-relaxed outline-none focus:border-green-500/40 transition-colors resize-none"
        />

        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="cursor-pointer flex-1 flex items-center justify-center gap-2 bg-[#1a1a1a] border border-[#222] hover:border-[#333] text-white font-bold uppercase tracking-widest py-2.5 rounded-xl transition-all text-xs disabled:opacity-60"
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Code
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="cursor-pointer flex-1 flex items-center justify-center gap-2 bg-white text-black font-black uppercase tracking-widest py-2.5 rounded-xl hover:bg-[#ededed] active:scale-[0.98] transition-all text-xs"
          >
            <CheckCircle2 className="w-4 h-4" /> Submit
          </button>
        </div>

        <AnimatePresence>
          {(isRunning || runOutput) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden">
              <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-2 flex items-center gap-1.5">
                  <TerminalSquare size={12} /> Console
                </p>
                {isRunning ? (
                  <p className="text-[11px] font-mono text-[#666]">Running against {question.testCases.length} test case(s)…</p>
                ) : (
                  <pre className="text-[11px] font-mono text-green-400 whitespace-pre-wrap">{runOutput}</pre>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
