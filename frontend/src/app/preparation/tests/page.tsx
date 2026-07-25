'use client';

import { useEffect, useState } from 'react';
import { Loader2, ClipboardList } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { usePrepProgress } from '@/hooks/usePrepProgress';
import * as prepService from '@/services/preparation';
import TestCard from '@/components/jobprep/TestCard';
import EmptyState from '@/components/jobprep/EmptyState';
import type { MockTest } from '@/components/jobprep/types';

export default function MockTestsPage() {
  const { isReady: gateReady } = useSubscriptionGate();
  const { progress, isReady: progressReady } = usePrepProgress();
  const [tests, setTests] = useState<MockTest[]>([]);

  useEffect(() => {
    prepService.getMockTests().then(setTests);
  }, []);

  const isReady = gateReady && progressReady;

  if (!isReady || !progress) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  const bestScoreFor = (testId: string) => {
    const attempts = progress.testHistory.filter((t) => t.testId === testId);
    if (attempts.length === 0) return undefined;
    return Math.max(...attempts.map((a) => Math.round((a.score / a.total) * 100)));
  };

  return (
    <main className="h-screen flex bg-[#0a0a0a] text-white overflow-hidden relative">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/preparation" title="Mock Tests" />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
          <div className="mx-auto max-w-5xl z-10 relative">
            <div className="flex items-center gap-3 mb-6">
              <ClipboardList className="w-5 h-5 text-green-500" />
              <div>
                <h1 className="text-lg font-black text-white">Mock Tests</h1>
                <p className="text-xs text-[#666]">Timed, placement-style tests across every category.</p>
              </div>
            </div>

            {tests.length === 0 ? (
              <EmptyState icon={ClipboardList} message="Loading mock tests…" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {tests.map((test) => (
                  <TestCard key={test.id} test={test} bestScore={bestScoreFor(test.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
