'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Clock3, ListChecks, Trophy, Play } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { usePrepProgress } from '@/hooks/usePrepProgress';
import * as prepService from '@/services/preparation';
import DifficultyBadge from '@/components/jobprep/DifficultyBadge';
import CodingQuestionPanel from '@/components/jobprep/CodingQuestionPanel';
import QuestionNavigator from '@/components/jobprep/QuestionNavigator';
import ScoreCard from '@/components/jobprep/ScoreCard';
import type { CodingQuestion, McqQuestion, MockTest } from '@/components/jobprep/types';

function TestMcqQuestion({
  question,
  index,
  total,
  selected,
  onSelect,
}: {
  question: McqQuestion;
  index: number;
  total: number;
  selected: number | undefined;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-[24px] p-6 sm:p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#555]">Question {index + 1} / {total}</span>
        <DifficultyBadge difficulty={question.difficulty} />
      </div>
      <p className="text-white text-base font-semibold leading-relaxed mb-6">{question.question}</p>
      <div className="space-y-2.5">
        {question.options.map((option, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={`cursor-pointer w-full text-left px-4 py-3 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
              selected === i ? 'border-green-500/50 bg-green-500/10 text-white' : 'border-[#222] hover:border-[#333] text-[#ccc]'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TestRunnerPage() {
  const { isReady: gateReady } = useSubscriptionGate();
  const { progress, isReady: progressReady, recordTestResult, markSolved } = usePrepProgress();
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const testId = params?.testId as string;

  const [test, setTest] = useState<MockTest | null>(null);
  const [questions, setQuestions] = useState<(McqQuestion | CodingQuestion)[]>([]);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | true>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  useEffect(() => {
    prepService.getMockTest(testId).then((t) => {
      setTest(t ?? null);
      if (t) setRemainingSeconds(t.durationMins * 60);
    });
  }, [testId]);

  useEffect(() => {
    if (!started || finished) return;
    if (remainingSeconds <= 0) {
      handleFinish();
      return;
    }
    const id = setTimeout(() => setRemainingSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, finished, remainingSeconds]);

  const handleStart = async () => {
    if (!test) return;
    const qs = await prepService.getMockTestQuestions(test);
    setQuestions(qs);
    setStarted(true);
  };

  const handleFinish = () => {
    if (!test) return;
    let score = 0;
    for (const q of questions) {
      if ('options' in q) {
        if (answers[q.id] === q.answer) score += 1;
      } else if (answers[q.id] !== undefined) {
        score += 1;
      }
    }
    const total = questions.length;
    const passed = total > 0 && (score / total) * 100 >= test.passingPercent;
    recordTestResult({ testId: test.id, score, total, passed, takenAt: new Date().toISOString() });
    for (const q of questions) {
      const correct = 'options' in q ? answers[q.id] === q.answer : answers[q.id] !== undefined;
      markSolved(q.id, q.topic, correct);
    }
    setResult({ score, total });
    setFinished(true);
  };

  const formatClock = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isReady = gateReady && progressReady;

  if (!isReady || !progress || !test) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  const current = questions[currentIndex];
  const answeredIndexes = questions.map((q, i) => (answers[q.id] !== undefined ? i : -1)).filter((i) => i !== -1);

  return (
    <main className="h-screen flex bg-[#0a0a0a] text-white overflow-hidden relative">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/preparation/tests" title={test.title}>
          {started && !finished && (
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
              <Clock3 className="w-3.5 h-3.5" /> {formatClock(remainingSeconds)}
            </span>
          )}
        </PageHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
          <div className="mx-auto max-w-4xl z-10 relative">
            {!started ? (
              <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-8 shadow-2xl text-center">
                <h1 className="text-xl font-black text-white mb-2">{test.title}</h1>
                <div className="flex items-center justify-center gap-4 text-xs text-[#888] mb-6 flex-wrap">
                  <span className="flex items-center gap-1"><Clock3 size={14} /> {test.durationMins} min</span>
                  <span className="flex items-center gap-1"><ListChecks size={14} /> {test.questionCount} questions</span>
                  <span className="flex items-center gap-1"><Trophy size={14} /> Pass {test.passingPercent}%</span>
                  <DifficultyBadge difficulty={test.difficulty} />
                </div>
                <p className="text-xs text-[#666] mb-8 max-w-md mx-auto">
                  Once started, the timer cannot be paused. Answer as many questions as you can before time runs out.
                </p>
                <button
                  type="button"
                  onClick={handleStart}
                  className="cursor-pointer inline-flex items-center gap-2 bg-white text-black font-black uppercase tracking-widest py-3 px-8 rounded-full hover:bg-[#ededed] active:scale-[0.98] transition-all text-xs"
                >
                  <Play className="w-4 h-4" /> Start Test
                </button>
              </div>
            ) : finished && result ? (
              <ScoreCard
                score={result.score}
                total={result.total}
                passingPercent={test.passingPercent}
                onRetake={() => {
                  setStarted(false);
                  setFinished(false);
                  setAnswers({});
                  setCurrentIndex(0);
                  setRemainingSeconds(test.durationMins * 60);
                }}
                onExit={() => router.push('/preparation/tests')}
              />
            ) : current ? (
              <div className="space-y-4">
                {'options' in current ? (
                  <TestMcqQuestion
                    question={current}
                    index={currentIndex}
                    total={questions.length}
                    selected={typeof answers[current.id] === 'number' ? (answers[current.id] as number) : undefined}
                    onSelect={(i) => setAnswers((prev) => ({ ...prev, [current.id]: i }))}
                  />
                ) : (
                  <CodingQuestionPanel
                    question={current}
                    isBookmarked={false}
                    onToggleBookmark={() => {}}
                    onSubmit={() => setAnswers((prev) => ({ ...prev, [current.id]: true }))}
                    solved={answers[current.id] !== undefined}
                  />
                )}

                <QuestionNavigator
                  total={questions.length}
                  currentIndex={currentIndex}
                  answeredIndexes={answeredIndexes}
                  onJump={setCurrentIndex}
                  onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  onNext={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                />

                {currentIndex === questions.length - 1 && (
                  <button
                    type="button"
                    onClick={handleFinish}
                    className="cursor-pointer w-full bg-white text-black font-black uppercase tracking-widest py-3 rounded-xl hover:bg-[#ededed] active:scale-[0.98] transition-all text-xs"
                  >
                    Submit Test
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
