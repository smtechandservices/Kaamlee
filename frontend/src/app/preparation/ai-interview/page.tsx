'use client';

import { Users, Cpu, FileText, Mic, Building2, Sparkles, Lock } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { Loader2 } from 'lucide-react';

const CARDS = [
  { icon: Users, title: 'Mock HR Interview', description: 'A conversational HR round covering background, motivation and fit.' },
  { icon: Cpu, title: 'Mock Technical Interview', description: 'Role-specific technical questions with real-time follow-ups.' },
  { icon: FileText, title: 'Resume Based Interview', description: 'Questions generated directly from your uploaded resume.' },
  { icon: Mic, title: 'Voice Interview', description: 'Practice speaking your answers out loud with instant feedback.' },
  { icon: Building2, title: 'Company Interview', description: 'Simulates the actual interview process of a specific company.' },
];

export default function AiInterviewPage() {
  const { isReady } = useSubscriptionGate();

  if (!isReady) {
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
        <PageHeader backHref="/preparation" title="AI Interview" />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="mx-auto max-w-4xl z-10 relative">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h1 className="text-lg font-black text-white">AI Interview</h1>
            </div>
            <p className="text-xs text-[#666] mb-8 max-w-lg">
              Real-time, voice-driven mock interviews powered by an LLM are coming soon. This preview shows what&apos;s on the way.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className="relative bg-[#111] border border-[#222] rounded-2xl p-6 opacity-90">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center mb-4 shadow-lg">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1.5">{card.title}</h3>
                    <p className="text-xs text-[#666] leading-relaxed mb-4">{card.description}</p>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#555] bg-[#1a1a1a] border border-[#222] px-3 py-1.5 rounded-full">
                      <Lock className="w-3 h-3" /> Coming Soon
                    </span>
                  </div>
                );
              })}

              <div className="relative bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border border-purple-500/20 rounded-2xl p-6 flex flex-col justify-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-purple-300 mb-2">Powered By Groq</p>
                <p className="text-xs text-[#ccc] leading-relaxed">
                  Once live, these interviews will run on Groq-hosted models for near-instant, low-latency responses —
                  practice under real interview pressure without waiting for replies.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
