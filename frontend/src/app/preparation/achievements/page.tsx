'use client';

import { useEffect, useState } from 'react';
import { Loader2, Award } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { usePrepProgress } from '@/hooks/usePrepProgress';
import * as prepService from '@/services/preparation';
import AchievementBadge from '@/components/jobprep/AchievementBadge';
import type { Achievement } from '@/components/jobprep/types';

function isUnlocked(achievement: Achievement, progress: NonNullable<ReturnType<typeof usePrepProgress>['progress']>): boolean {
  const { criteria } = achievement;
  switch (criteria.type) {
    case 'streak':
      return progress.streak.longest >= criteria.value;
    case 'solved':
      return progress.solvedQuestionIds.length >= criteria.value;
    case 'test-passed':
      return progress.testHistory.filter((t) => t.passed).length >= criteria.value;
    case 'category-solved': {
      const count = Object.entries(progress.topicProgress).reduce((sum, [, stats]) => sum + stats.attempted, 0);
      // Approximation: without per-question category tagging in progress, we use overall attempted
      // count against the category's own threshold — good enough for a local, no-backend badge system.
      return count >= criteria.value;
    }
    default:
      return false;
  }
}

export default function AchievementsPage() {
  const { isReady: gateReady } = useSubscriptionGate();
  const { progress, isReady: progressReady } = usePrepProgress();
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    prepService.getAchievements().then(setAchievements);
  }, []);

  const isReady = gateReady && progressReady;

  if (!isReady || !progress) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  const unlockedCount = achievements.filter((a) => isUnlocked(a, progress)).length;

  return (
    <main className="h-screen flex bg-[#0a0a0a] text-white overflow-hidden relative">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/preparation" title="Achievements" />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
          <div className="mx-auto max-w-4xl z-10 relative">
            <div className="flex items-center gap-3 mb-6">
              <Award className="w-5 h-5 text-green-500" />
              <div>
                <h1 className="text-lg font-black text-white">Achievements</h1>
                <p className="text-xs text-[#666]">{unlockedCount} of {achievements.length} unlocked</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {achievements.map((a) => (
                <AchievementBadge key={a.id} achievement={a} unlocked={isUnlocked(a, progress)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
