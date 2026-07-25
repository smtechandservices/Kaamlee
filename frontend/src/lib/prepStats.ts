import type { CategoryId, CategoryMeta, PrepProgress } from '@/components/jobprep/types';

// Rough weighting of how much each category counts toward "placement readiness" —
// coding and aptitude dominate most Indian campus placement processes.
const READINESS_WEIGHTS: Record<CategoryId, number> = {
  aptitude: 0.25,
  coding: 0.3,
  verbal: 0.15,
  reasoning: 0.15,
  interview: 0.15,
  companies: 0,
};

export function computeReadiness(progress: PrepProgress, categories: CategoryMeta[], totalQuestionsByCategory: Record<string, number>): number {
  let weightedSum = 0;
  let weightTotal = 0;

  for (const cat of categories) {
    const weight = READINESS_WEIGHTS[cat.id];
    if (!weight) continue;
    const total = totalQuestionsByCategory[cat.id] || 0;
    if (total === 0) continue;
    const solvedInCategory = cat.topics.reduce((sum, t) => sum + (progress.topicProgress[t.slug]?.attempted ?? 0), 0);
    const ratio = Math.min(1, solvedInCategory / total);
    weightedSum += ratio * weight;
    weightTotal += weight;
  }

  const testBonus = progress.testHistory.length > 0
    ? Math.min(1, progress.testHistory.filter((t) => t.passed).length / 3) * 0.1
    : 0;

  if (weightTotal === 0) return Math.round(testBonus * 100);
  return Math.round(Math.min(100, (weightedSum / weightTotal) * 90 + testBonus * 100));
}

export interface TopicAccuracy {
  slug: string;
  attempted: number;
  correct: number;
  accuracy: number;
}

export function rankTopicsByAccuracy(progress: PrepProgress): TopicAccuracy[] {
  return Object.entries(progress.topicProgress)
    .filter(([, stats]) => stats.attempted >= 1)
    .map(([slug, stats]) => ({
      slug,
      attempted: stats.attempted,
      correct: stats.correct,
      accuracy: Math.round((stats.correct / stats.attempted) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

export function getWeakestTopics(progress: PrepProgress, limit = 5): TopicAccuracy[] {
  return rankTopicsByAccuracy(progress).slice(0, limit);
}

export function getStrongestTopics(progress: PrepProgress, limit = 5): TopicAccuracy[] {
  return rankTopicsByAccuracy(progress)
    .slice()
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, limit);
}

export function getLast7DaysActivity(progress: PrepProgress): { date: string; count: number }[] {
  const days: { date: string; count: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({ date: iso, count: progress.activityLog[iso] ?? 0 });
  }
  return days;
}

export function getTodaySolvedCount(progress: PrepProgress): number {
  const today = new Date().toISOString().slice(0, 10);
  return progress.activityLog[today] ?? 0;
}
