'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Clock3 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { usePrepProgress } from '@/hooks/usePrepProgress';
import * as prepService from '@/services/preparation';
import QuestionCard from '@/components/jobprep/QuestionCard';
import QuestionNavigator from '@/components/jobprep/QuestionNavigator';
import CodingQuestionPanel from '@/components/jobprep/CodingQuestionPanel';
import EmptyState from '@/components/jobprep/EmptyState';
import type { CategoryId, CodingQuestion, McqQuestion, OpenQuestion } from '@/components/jobprep/types';
import { FileQuestion } from 'lucide-react';

type AnyQuestion = McqQuestion | OpenQuestion | CodingQuestion;

function useElapsedSeconds(resetKey: unknown) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [resetKey]);
  return seconds;
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TopicQuestionPage() {
  const { isReady: gateReady } = useSubscriptionGate();
  const { progress, isReady: progressReady, markSolved, toggleBookmark, isBookmarked, logActivity } = usePrepProgress();
  const params = useParams<{ category: string; topic: string }>();
  const categoryId = params?.category as CategoryId;
  const topicSlug = params?.topic as string;
  const isCompanyRoute = categoryId === 'companies';

  const [topicName, setTopicName] = useState<string>('');
  const [items, setItems] = useState<AnyQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedMap, setSelectedMap] = useState<Record<string, number>>({});
  const [submittedSet, setSubmittedSet] = useState<Set<string>>(new Set());
  const [revealedSet, setRevealedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!categoryId || !topicSlug) return;
    setLoaded(false);
    setCurrentIndex(0);

    if (isCompanyRoute) {
      prepService.getCompany(topicSlug).then((c) => setTopicName(c?.name ?? topicSlug));
      prepService.getCompanyQuestions(topicSlug).then((qs) => {
        setItems(qs);
        setLoaded(true);
      });
    } else if (categoryId === 'coding') {
      prepService.getCategory(categoryId).then((c) => setTopicName(c?.topics.find((t) => t.slug === topicSlug)?.name ?? topicSlug));
      prepService.getCodingQuestions(topicSlug).then((qs) => {
        setItems(qs);
        setLoaded(true);
      });
    } else {
      prepService.getCategory(categoryId).then((c) => setTopicName(c?.topics.find((t) => t.slug === topicSlug)?.name ?? topicSlug));
      prepService.getQuestions(categoryId, topicSlug).then((qs) => {
        setItems(qs);
        setLoaded(true);
      });
    }
  }, [categoryId, topicSlug, isCompanyRoute]);

  const elapsed = useElapsedSeconds(currentIndex);
  const current = items[currentIndex];

  const answeredIndexes = useMemo(
    () =>
      items
        .map((q, i) => (submittedSet.has(q.id) || revealedSet.has(q.id) || progress?.solvedQuestionIds.includes(q.id) ? i : -1))
        .filter((i) => i !== -1),
    [items, submittedSet, revealedSet, progress],
  );

  const relatedQuestions = useMemo(
    () =>
      items
        .map((q, i) => ({ q, i }))
        .filter(({ i }) => i !== currentIndex)
        .slice(0, 4),
    [items, currentIndex],
  );

  const isReady = gateReady && progressReady;

  if (!isReady || !progress) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  const handleSubmitMcq = (question: McqQuestion, selectedIndex: number) => {
    setSubmittedSet((prev) => new Set(prev).add(question.id));
    const isCorrect = selectedIndex === question.answer;
    markSolved(question.id, question.topic, isCorrect);
    logActivity({ label: `${isCorrect ? 'Solved' : 'Attempted'}: ${question.question.slice(0, 60)}`, href: `/preparation/${question.category}/${question.topic}` });
  };

  const handleRevealOpen = (question: OpenQuestion) => {
    setRevealedSet((prev) => new Set(prev).add(question.id));
    markSolved(question.id, question.topic, true);
    logActivity({ label: `Reviewed: ${question.question.slice(0, 60)}`, href: `/preparation/interview/${question.topic}` });
  };

  const handleSubmitCoding = (question: CodingQuestion) => {
    markSolved(question.id, question.topic, true);
    logActivity({ label: `Solved: ${question.title}`, href: `/preparation/coding/${question.topic}` });
  };

  return (
    <main className="h-screen flex bg-[#0a0a0a] text-white overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref={`/preparation/${categoryId}`} title={topicName || topicSlug}>
          <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[#666] bg-[#111] border border-[#222] px-3 py-1.5 rounded-full">
            <Clock3 className="w-3.5 h-3.5" /> {formatTime(elapsed)}
          </span>
        </PageHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
          <div className="mx-auto max-w-4xl z-10 relative space-y-4">
            {!loaded ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <EmptyState icon={FileQuestion} message="No questions available for this topic yet — check back soon." />
            ) : current?.kind === 'coding' ? (
              <>
                <CodingQuestionPanel
                  question={current}
                  isBookmarked={isBookmarked(current.id)}
                  onToggleBookmark={() => toggleBookmark(current.id)}
                  onSubmit={() => handleSubmitCoding(current)}
                  solved={progress.solvedQuestionIds.includes(current.id)}
                />
                {items.length > 1 && (
                  <QuestionNavigator
                    total={items.length}
                    currentIndex={currentIndex}
                    answeredIndexes={answeredIndexes}
                    onJump={setCurrentIndex}
                    onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    onNext={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
                  />
                )}
              </>
            ) : current?.kind === 'open' ? (
              <>
                <QuestionCard
                  kind="open"
                  question={current}
                  index={currentIndex}
                  total={items.length}
                  revealed={revealedSet.has(current.id)}
                  onReveal={() => handleRevealOpen(current)}
                  isBookmarked={isBookmarked(current.id)}
                  onToggleBookmark={() => toggleBookmark(current.id)}
                />
                <QuestionNavigator
                  total={items.length}
                  currentIndex={currentIndex}
                  answeredIndexes={answeredIndexes}
                  onJump={setCurrentIndex}
                  onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  onNext={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
                />
              </>
            ) : current ? (
              <>
                <QuestionCard
                  kind="mcq"
                  question={current}
                  index={currentIndex}
                  total={items.length}
                  selected={selectedMap[current.id] ?? null}
                  submitted={submittedSet.has(current.id)}
                  onSelect={(optionIndex) => setSelectedMap((prev) => ({ ...prev, [current.id]: optionIndex }))}
                  onSubmit={() => handleSubmitMcq(current, selectedMap[current.id])}
                  isBookmarked={isBookmarked(current.id)}
                  onToggleBookmark={() => toggleBookmark(current.id)}
                />
                <QuestionNavigator
                  total={items.length}
                  currentIndex={currentIndex}
                  answeredIndexes={answeredIndexes}
                  onJump={setCurrentIndex}
                  onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  onNext={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
                />
              </>
            ) : null}

            {relatedQuestions.length > 0 && (
              <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-3">Related Questions</p>
                <div className="space-y-1.5">
                  {relatedQuestions.map(({ q, i }) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIndex(i)}
                      className="cursor-pointer w-full text-left px-3 py-2 rounded-xl text-xs text-[#888] hover:text-white hover:bg-white/5 transition-colors truncate"
                    >
                      {q.kind === 'coding' ? q.title : q.question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
