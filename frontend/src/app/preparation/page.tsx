'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, ArrowRight, Sparkles, Lightbulb, FileText, MessageSquareText, TrendingDown, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { usePrepProgress } from '@/hooks/usePrepProgress';
import * as prepService from '@/services/preparation';
import PreparationCard from '@/components/jobprep/PreparationCard';
import ProgressCard from '@/components/jobprep/ProgressCard';
import DailyChallengeCard from '@/components/jobprep/DailyChallengeCard';
import StreakWidget from '@/components/jobprep/StreakWidget';
import SearchModal from '@/components/jobprep/SearchModal';
import { computeReadiness, getLast7DaysActivity, getTodaySolvedCount, getWeakestTopics } from '@/lib/prepStats';
import type { CategoryId, CategoryMeta, McqQuestion, Tip } from '@/components/jobprep/types';

const TIP_ICON = { placement: Sparkles, resume: FileText, interview: MessageSquareText } as const;
const TIP_LABEL = { placement: 'Placement Tip', resume: 'Resume Tip', interview: 'Interview Tip' } as const;

export default function PreparationHubPage() {
  const { isReady: gateReady } = useSubscriptionGate();
  const { progress, isReady: progressReady, isSolved } = usePrepProgress();

  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [counts, setCounts] = useState<Record<CategoryId, number>>({} as Record<CategoryId, number>);
  const [dailyChallenge, setDailyChallenge] = useState<McqQuestion | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    prepService.getCategories().then(setCategories);
    prepService.getQuestionCounts().then(setCounts);
    prepService.getDailyChallenge().then(setDailyChallenge);
    prepService.getTips().then(setTips);
  }, []);

  const isReady = gateReady && progressReady;

  if (!isReady || !progress) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  const weeklyActivity = getLast7DaysActivity(progress);
  const todaySolved = getTodaySolvedCount(progress);
  const readiness = computeReadiness(progress, categories, counts);
  const weakestTopics = getWeakestTopics(progress, 4);
  const continueHref = progress.recentActivity[0]?.href ?? '/preparation/aptitude';
  const tipsByGroup = (['placement', 'resume', 'interview'] as const).map((g) => ({ group: g, tip: tips.find((t) => t.group === g) }));

  return (
    <main className="h-screen flex bg-[#0a0a0a] text-white overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/" title="Job Preparation" wordmark>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="cursor-pointer flex items-center gap-2 text-[#666] hover:text-white bg-[#111] border border-[#222] hover:border-[#333] px-3 py-2 rounded-xl transition-all"
            title="Search preparation content"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest">Search</span>
          </button>
        </PageHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none" />

          <div className="mx-auto max-w-6xl z-10 relative space-y-6">
            {/* Hero */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-6 sm:py-10">
              <h1 className="text-2xl sm:text-4xl font-black tracking-tighter text-white mb-3">
                Prepare. Practice. Get Hired.
              </h1>
              <p className="text-xs sm:text-sm text-[#888] max-w-lg mx-auto mb-6">
                Master Aptitude, Coding, Reasoning, Verbal and Interviews—all in one place.
              </p>
              <Link
                href={continueHref}
                className="cursor-pointer inline-flex items-center gap-2 bg-white text-black font-black uppercase tracking-widest py-3 px-8 rounded-full hover:bg-[#ededed] active:scale-[0.98] transition-all text-xs shadow-lg"
              >
                Continue Learning <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
              <div className="lg:col-span-2 space-y-4">
                <ProgressCard
                  dailyGoal={progress.dailyGoal}
                  todaySolved={todaySolved}
                  streak={progress.streak.current}
                  totalSolved={progress.solvedQuestionIds.length}
                  weeklyActivity={weeklyActivity}
                  readinessPercent={readiness}
                />

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#555] mb-3 px-1">Practice Categories</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {categories.map((cat) => (
                      <PreparationCard key={cat.id} category={cat} questionCount={counts[cat.id] ?? 0} />
                    ))}
                  </div>
                </div>

                {tipsByGroup.some((t) => t.tip) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {tipsByGroup.map(({ group, tip }) => {
                      if (!tip) return null;
                      const Icon = TIP_ICON[group];
                      return (
                        <div key={group} className="bg-[#111] border border-[#222] rounded-2xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="w-3.5 h-3.5 text-green-500" />
                            <p className="text-[9px] font-black uppercase tracking-widest text-[#555]">{TIP_LABEL[group]}</p>
                          </div>
                          <p className="text-[11px] text-[#ccc] leading-relaxed">{tip.text}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {dailyChallenge && <DailyChallengeCard question={dailyChallenge} solved={isSolved(dailyChallenge.id)} />}
                <StreakWidget streak={progress.streak.current} longest={progress.streak.longest} />

                <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-white">Weakest Topics</p>
                  </div>
                  {weakestTopics.length === 0 ? (
                    <p className="text-[11px] text-[#555]">Solve a few questions to see your weak areas here.</p>
                  ) : (
                    <div className="space-y-2">
                      {weakestTopics.map((t) => (
                        <div key={t.slug} className="flex items-center justify-between text-xs">
                          <span className="text-[#ccc] capitalize truncate">{t.slug.replace(/-/g, ' ')}</span>
                          <span className="text-red-400 font-bold shrink-0 ml-2">{t.accuracy}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-white">Weekly Contest</p>
                  </div>
                  <p className="text-[11px] text-[#888] leading-relaxed mb-3">
                    Test your speed against a full placement-style paper this week.
                  </p>
                  <Link
                    href="/preparation/tests"
                    className="cursor-pointer inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-green-400 hover:text-green-300"
                  >
                    View Mock Tests <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </main>
  );
}
