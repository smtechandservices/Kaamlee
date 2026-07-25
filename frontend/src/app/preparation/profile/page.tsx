'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, User, Bookmark, TrendingUp, TrendingDown, History, Trash2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { usePrepProgress } from '@/hooks/usePrepProgress';
import * as prepService from '@/services/preparation';
import CircularProgress from '@/components/jobprep/CircularProgress';
import EmptyState from '@/components/jobprep/EmptyState';
import { computeReadiness, getStrongestTopics, getWeakestTopics } from '@/lib/prepStats';
import type { CategoryId, CategoryMeta } from '@/components/jobprep/types';

interface BookmarkPreview {
  id: string;
  label: string;
  href: string;
}

export default function ProfilePage() {
  const { isReady: gateReady } = useSubscriptionGate();
  const { progress, isReady: progressReady, toggleBookmark } = usePrepProgress();
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [counts, setCounts] = useState<Record<CategoryId, number>>({} as Record<CategoryId, number>);
  const [bookmarks, setBookmarks] = useState<BookmarkPreview[]>([]);

  useEffect(() => {
    prepService.getCategories().then(setCategories);
    prepService.getQuestionCounts().then(setCounts);
  }, []);

  useEffect(() => {
    if (!progress) return;
    Promise.all(
      progress.bookmarkedQuestionIds.map(async (id) => {
        const q = await prepService.getQuestionById(id);
        if (!q) return null;
        const label = 'title' in q ? q.title : q.question;
        const href = `/preparation/${q.category}/${q.topic}`;
        return { id, label, href };
      }),
    ).then((res) => setBookmarks(res.filter(Boolean) as BookmarkPreview[]));
  }, [progress?.bookmarkedQuestionIds]);

  const totalQuestions = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  const isReady = gateReady && progressReady;

  if (!isReady || !progress) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  const readiness = computeReadiness(progress, categories, counts);
  const weakest = getWeakestTopics(progress, 5);
  const strongest = getStrongestTopics(progress, 5);
  const completionPercent = totalQuestions > 0 ? Math.round((progress.solvedQuestionIds.length / totalQuestions) * 100) : 0;

  return (
    <main className="h-screen flex bg-[#0a0a0a] text-white overflow-hidden relative">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/preparation" title="Prep Profile" />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
          <div className="mx-auto max-w-5xl z-10 relative space-y-4">
            <div className="bg-[#111] border border-[#222] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <User className="w-5 h-5 text-green-500" />
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Overview</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 flex flex-col items-center text-center">
                  <CircularProgress percent={completionPercent} size={56} />
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#555] mt-2">Completion</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-black text-white">{progress.solvedQuestionIds.length}</span>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#555] mt-1">Solved</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-black text-white">{progress.bookmarkedQuestionIds.length}</span>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#555] mt-1">Bookmarks</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 flex flex-col items-center text-center">
                  <CircularProgress percent={readiness} size={56} colorClassName="text-blue-400" />
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#555] mt-2">Readiness</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white">Strong Areas</p>
                </div>
                {strongest.length === 0 ? (
                  <p className="text-xs text-[#555]">Solve a few questions to see your strong topics.</p>
                ) : (
                  <div className="space-y-2">
                    {strongest.map((t) => (
                      <div key={t.slug} className="flex items-center justify-between text-xs">
                        <span className="text-[#ccc] capitalize truncate">{t.slug.replace(/-/g, ' ')}</span>
                        <span className="text-green-400 font-bold">{t.accuracy}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white">Weak Areas</p>
                </div>
                {weakest.length === 0 ? (
                  <p className="text-xs text-[#555]">Solve a few questions to see your weak topics.</p>
                ) : (
                  <div className="space-y-2">
                    {weakest.map((t) => (
                      <div key={t.slug} className="flex items-center justify-between text-xs">
                        <span className="text-[#ccc] capitalize truncate">{t.slug.replace(/-/g, ' ')}</span>
                        <span className="text-red-400 font-bold">{t.accuracy}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Bookmark className="w-4 h-4 text-green-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white">Bookmarks</p>
                </div>
                {bookmarks.length === 0 ? (
                  <EmptyState icon={Bookmark} message="Bookmark questions while practicing to revisit them here." />
                ) : (
                  <div className="space-y-1.5">
                    {bookmarks.map((b) => (
                      <div key={b.id} className="flex items-center justify-between gap-2 bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2.5">
                        <Link href={b.href} className="text-xs text-[#ccc] hover:text-white truncate flex-1">
                          {b.label}
                        </Link>
                        <button type="button" onClick={() => toggleBookmark(b.id)} className="cursor-pointer text-[#555] hover:text-red-400 transition-colors shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-4 h-4 text-green-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white">Recent Activity</p>
                </div>
                {progress.recentActivity.length === 0 ? (
                  <EmptyState icon={History} message="Your recent practice activity will show up here." />
                ) : (
                  <div className="space-y-1.5">
                    {progress.recentActivity.slice(0, 8).map((a, i) => (
                      <Link key={i} href={a.href} className="flex items-center justify-between gap-2 bg-[#0a0a0a] border border-[#222] rounded-xl px-3 py-2.5 hover:border-[#333] transition-colors">
                        <span className="text-xs text-[#ccc] truncate">{a.label}</span>
                        <span className="text-[10px] text-[#555] shrink-0">{new Date(a.at).toLocaleDateString()}</span>
                      </Link>
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
