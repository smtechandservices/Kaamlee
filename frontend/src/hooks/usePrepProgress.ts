'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PrepProgress, RecentActivityEntry, TestHistoryEntry } from '@/components/jobprep/types';
import {
  loadProgress,
  saveProgress,
  markSolved as applyMarkSolved,
  toggleBookmark as applyToggleBookmark,
  recordTestResult as applyRecordTestResult,
  logActivity as applyLogActivity,
  setDailyGoal as applySetDailyGoal,
} from '@/lib/prepStorage';

// Central localStorage-backed progress store for the whole Job Preparation
// module — every prep page reads/mutates through this one hook so streaks,
// solved counts and bookmarks stay consistent everywhere.
export function usePrepProgress() {
  const [progress, setProgress] = useState<PrepProgress | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const commit = useCallback((next: PrepProgress) => {
    saveProgress(next);
    setProgress(next);
  }, []);

  const markSolved = useCallback(
    (questionId: string, topicSlug: string, isCorrect: boolean) => {
      setProgress((prev) => {
        const base = prev ?? loadProgress();
        const next = applyMarkSolved(base, questionId, topicSlug, isCorrect);
        saveProgress(next);
        return next;
      });
    },
    [],
  );

  const toggleBookmark = useCallback((questionId: string) => {
    setProgress((prev) => {
      const base = prev ?? loadProgress();
      const next = applyToggleBookmark(base, questionId);
      saveProgress(next);
      return next;
    });
  }, []);

  const recordTestResult = useCallback((entry: TestHistoryEntry) => {
    setProgress((prev) => {
      const base = prev ?? loadProgress();
      const next = applyRecordTestResult(base, entry);
      saveProgress(next);
      return next;
    });
  }, []);

  const logActivity = useCallback((entry: Omit<RecentActivityEntry, 'at'>) => {
    setProgress((prev) => {
      const base = prev ?? loadProgress();
      const next = applyLogActivity(base, entry);
      saveProgress(next);
      return next;
    });
  }, []);

  const setDailyGoal = useCallback((goal: number) => {
    setProgress((prev) => {
      const base = prev ?? loadProgress();
      const next = applySetDailyGoal(base, goal);
      saveProgress(next);
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (questionId: string) => !!progress?.bookmarkedQuestionIds.includes(questionId),
    [progress],
  );

  const isSolved = useCallback(
    (questionId: string) => !!progress?.solvedQuestionIds.includes(questionId),
    [progress],
  );

  return {
    progress,
    isReady: progress !== null,
    markSolved,
    toggleBookmark,
    recordTestResult,
    logActivity,
    setDailyGoal,
    isBookmarked,
    isSolved,
    commit,
  };
}
