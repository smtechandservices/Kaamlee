import type { PrepProgress, RecentActivityEntry, TestHistoryEntry } from '@/components/jobprep/types';

const STORAGE_KEY = 'kaamlee_prep_progress';
const DEFAULT_DAILY_GOAL = 10;
const MAX_RECENT_ACTIVITY = 20;

function emptyProgress(): PrepProgress {
  return {
    solvedQuestionIds: [],
    bookmarkedQuestionIds: [],
    streak: { current: 0, longest: 0, lastActiveDate: null },
    topicProgress: {},
    activityLog: {},
    testHistory: [],
    recentActivity: [],
    dailyGoal: DEFAULT_DAILY_GOAL,
  };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadProgress(): PrepProgress {
  if (typeof window === 'undefined') return emptyProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    return { ...emptyProgress(), ...parsed };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress: PrepProgress): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// Bumps the streak if today is a new active day, resets it if a day was missed.
function touchStreak(progress: PrepProgress): PrepProgress {
  const today = todayISO();
  const { lastActiveDate, current, longest } = progress.streak;
  if (lastActiveDate === today) return progress;

  let next = current + 1;
  if (lastActiveDate) {
    const daysSince = Math.round((Date.parse(today) - Date.parse(lastActiveDate)) / 86400000);
    if (daysSince > 1) next = 1;
  } else {
    next = 1;
  }

  return {
    ...progress,
    streak: { current: next, longest: Math.max(longest, next), lastActiveDate: today },
  };
}

export function markSolved(progress: PrepProgress, questionId: string, topicSlug: string, isCorrect: boolean): PrepProgress {
  const today = todayISO();
  const alreadySolved = progress.solvedQuestionIds.includes(questionId);
  const withStreak = touchStreak(progress);

  const topicStats = withStreak.topicProgress[topicSlug] ?? { attempted: 0, correct: 0 };

  return {
    ...withStreak,
    solvedQuestionIds: alreadySolved ? withStreak.solvedQuestionIds : [...withStreak.solvedQuestionIds, questionId],
    topicProgress: {
      ...withStreak.topicProgress,
      [topicSlug]: { attempted: topicStats.attempted + 1, correct: topicStats.correct + (isCorrect ? 1 : 0) },
    },
    activityLog: {
      ...withStreak.activityLog,
      [today]: (withStreak.activityLog[today] ?? 0) + (alreadySolved ? 0 : 1),
    },
  };
}

export function toggleBookmark(progress: PrepProgress, questionId: string): PrepProgress {
  const isBookmarked = progress.bookmarkedQuestionIds.includes(questionId);
  return {
    ...progress,
    bookmarkedQuestionIds: isBookmarked
      ? progress.bookmarkedQuestionIds.filter((id) => id !== questionId)
      : [...progress.bookmarkedQuestionIds, questionId],
  };
}

export function recordTestResult(progress: PrepProgress, entry: TestHistoryEntry): PrepProgress {
  const withStreak = touchStreak(progress);
  return { ...withStreak, testHistory: [entry, ...withStreak.testHistory].slice(0, 50) };
}

export function logActivity(progress: PrepProgress, entry: Omit<RecentActivityEntry, 'at'>): PrepProgress {
  const full: RecentActivityEntry = { ...entry, at: new Date().toISOString() };
  return { ...progress, recentActivity: [full, ...progress.recentActivity].slice(0, MAX_RECENT_ACTIVITY) };
}

export function setDailyGoal(progress: PrepProgress, dailyGoal: number): PrepProgress {
  return { ...progress, dailyGoal };
}
