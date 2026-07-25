'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Loader2, Building2, ArrowRight } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { usePrepProgress } from '@/hooks/usePrepProgress';
import * as prepService from '@/services/preparation';
import CategorySidebar from '@/components/jobprep/CategorySidebar';
import TopicCard from '@/components/jobprep/TopicCard';
import DifficultyBadge from '@/components/jobprep/DifficultyBadge';
import EmptyState from '@/components/jobprep/EmptyState';
import type { CategoryId, CategoryMeta, Company, Difficulty } from '@/components/jobprep/types';

export default function CategoryPage() {
  const { isReady: gateReady } = useSubscriptionGate();
  const { progress, isReady: progressReady } = usePrepProgress();
  const params = useParams<{ category: string }>();
  const categoryId = params?.category as CategoryId;
  const isCompanies = categoryId === 'companies';

  const [category, setCategory] = useState<CategoryMeta | null>(null);
  const [questions, setQuestions] = useState<{ topic: string; difficulty: Difficulty }[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>('all');

  useEffect(() => {
    if (!categoryId) return;
    prepService.getCategory(categoryId).then((c) => setCategory(c ?? null));
    if (isCompanies) {
      prepService.getCompanies().then(setCompanies);
    } else {
      prepService.getCategoryQuestions(categoryId).then((qs) => setQuestions(qs.map((q) => ({ topic: q.topic, difficulty: q.difficulty }))));
    }
  }, [categoryId, isCompanies]);

  const filteredQuestions = useMemo(
    () => (difficultyFilter === 'all' ? questions : questions.filter((q) => q.difficulty === difficultyFilter)),
    [questions, difficultyFilter],
  );

  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of filteredQuestions) counts[q.topic] = (counts[q.topic] ?? 0) + 1;
    return counts;
  }, [filteredQuestions]);

  const isReady = gateReady && progressReady;

  if (!isReady || !progress || !category) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <main className="h-screen flex bg-[#0a0a0a] text-white overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/preparation" title={category.title} />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
          <div className="mx-auto max-w-6xl z-10 relative">
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                <span className="text-xl">{category.emoji}</span>
              </div>
              <div>
                <h1 className="text-lg font-black text-white">{category.title}</h1>
                <p className="text-xs text-[#666]">{category.description}</p>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {!isCompanies && (
                <CategorySidebar
                  topics={category.topics}
                  topicProgress={progress.topicProgress}
                  topicCounts={topicCounts}
                  difficultyFilter={difficultyFilter}
                  onDifficultyChange={setDifficultyFilter}
                />
              )}

              <div className="flex-1 min-w-0 w-full">
                {isCompanies ? (
                  companies.length === 0 ? (
                    <EmptyState icon={Building2} message="Loading companies…" />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {companies.map((company) => (
                        <Link key={company.slug} href={`/preparation/companies/${company.slug}`}>
                          <motion.div whileHover={{ y: -3 }} className="bg-[#111] border border-[#222] rounded-2xl p-5 hover:border-green-500/30 transition-colors h-full flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-black font-black text-sm shrink-0">
                                {company.name.charAt(0)}
                              </div>
                              <DifficultyBadge difficulty={company.difficulty} />
                            </div>
                            <h3 className="text-sm font-bold text-white mb-1.5">{company.name}</h3>
                            <p className="text-[11px] text-[#666] leading-relaxed mb-4 flex-1 line-clamp-2">{company.hiringNote}</p>
                            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-green-400">
                              Practice Questions <ArrowRight className="w-3 h-3" />
                            </span>
                          </motion.div>
                        </Link>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="space-y-2.5">
                    {category.topics.map((topic) => (
                      <TopicCard
                        key={topic.slug}
                        href={`/preparation/${categoryId}/${topic.slug}`}
                        name={topic.name}
                        questionCount={topicCounts[topic.slug] ?? 0}
                        completionPercent={
                          progress.topicProgress[topic.slug] && (topicCounts[topic.slug] ?? 0) > 0
                            ? Math.round((Math.min(progress.topicProgress[topic.slug].attempted, topicCounts[topic.slug]) / topicCounts[topic.slug]) * 100)
                            : 0
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
