'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Map } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { usePrepProgress } from '@/hooks/usePrepProgress';
import * as prepService from '@/services/preparation';
import RoadmapCard from '@/components/jobprep/RoadmapCard';
import type { RoadmapStage } from '@/components/jobprep/types';

export default function RoadmapPage() {
  const { isReady: gateReady } = useSubscriptionGate();
  const { progress, isReady: progressReady } = usePrepProgress();
  const [stages, setStages] = useState<RoadmapStage[]>([]);

  useEffect(() => {
    prepService.getRoadmap().then(setStages);
  }, []);

  const completedMilestoneIds = useMemo(() => {
    if (!progress) return new Set<string>();
    const done = new Set<string>();
    for (const stage of stages) {
      for (const m of stage.milestones) {
        if (!m.topicSlug) continue;
        const attempted = progress.topicProgress[m.topicSlug]?.attempted ?? 0;
        if (attempted > 0) done.add(m.id);
      }
    }
    // Category-only milestones (no topicSlug) — mark done from broader signals.
    for (const stage of stages) {
      for (const m of stage.milestones) {
        if (m.topicSlug) continue;
        if (m.categoryId === 'companies' && progress.recentActivity.some((a) => a.href.includes('/companies/'))) done.add(m.id);
        if (progress.testHistory.some((t) => t.passed)) done.add(m.id);
      }
    }
    return done;
  }, [progress, stages]);

  const isReady = gateReady && progressReady;

  if (!isReady || !progress) {
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
        <PageHeader backHref="/preparation" title="Roadmap" />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
          <div className="mx-auto max-w-3xl z-10 relative">
            <div className="flex items-center gap-3 mb-6">
              <Map className="w-5 h-5 text-green-500" />
              <div>
                <h1 className="text-lg font-black text-white">Your Placement Roadmap</h1>
                <p className="text-xs text-[#666]">Follow these stages from beginner to placement-ready.</p>
              </div>
            </div>

            <div className="space-y-4">
              {stages.map((stage, i) => (
                <RoadmapCard key={stage.id} stage={stage} stageIndex={i} completedMilestoneIds={completedMilestoneIds} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
