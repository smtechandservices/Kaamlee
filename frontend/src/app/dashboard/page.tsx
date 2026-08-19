'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Loader2, Compass, Kanban, FileText, Globe, Receipt,
  ArrowUpRight, Sparkles, ShieldCheck, MapPin, Eye, Briefcase,
  CheckCircle2, Link as LinkIcon,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import PricingModal from '@/components/PricingModal';
import PortfolioAnalyticsPanel, { PortfolioAnalyticsData } from '@/components/portfolio/PortfolioAnalyticsPanel';
import { useAuth } from '@/context/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { isSubscriptionActive } from '@/lib/subscription';
import { PRIMARY_BTN_CLS, PRIMARY_BTN_BG, CARD_CLS, ArrowChevron } from '@/components/ui/landing-kit';
import type { CustomCV } from '@/components/customcv/types';

interface Job {
  id: number;
  title: string;
  company: string | null;
  location_name: string;
  is_remote: boolean;
}

interface Application {
  id: number;
  job: Job;
  status: string;
  status_updated_at: string;
}

const QUICK_LINKS = [
  { href: '/explore', label: 'Explore jobs', desc: 'Search the live map across every board.', icon: Compass },
  { href: '/applications', label: 'Application tracker', desc: 'See where every application stands.', icon: Kanban },
  { href: '/custom-cv', label: 'Custom CV', desc: 'Generate an ATS-scored CV for a role.', icon: FileText },
  { href: '/transactions', label: 'Billing', desc: 'Subscription status and payment history.', icon: Receipt },
];

function getDaysLeft(expiry: string | null | undefined) {
  if (!expiry) return 0;
  const diff = new Date(expiry).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function DashboardPage() {
  const { user, token } = useAuth();
  const { isReady, isSubscribed } = useSubscriptionGate({ allowUnsubscribed: true });

  const [applications, setApplications] = useState<Application[]>([]);
  const [cvs, setCvs] = useState<CustomCV[]>([]);
  const [portfolio, setPortfolio] = useState<{ is_public: boolean; has_resume: boolean } | null>(null);
  const [totalJobs, setTotalJobs] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [analytics, setAnalytics] = useState<PortfolioAnalyticsData | null>(null);
  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState(true);

  useEffect(() => {
    if (!token) return;
    setIsFetching(true);
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/applications/`, { headers: { Authorization: `Token ${token}` } }).then((r) => r.json()).catch(() => []),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/custom-cv/`, { headers: { Authorization: `Token ${token}` } }).then((r) => r.json()).catch(() => []),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/me/`, { headers: { Authorization: `Token ${token}` } }).then((r) => r.json()).catch(() => null),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stats/`).then((r) => r.json()).catch(() => null),
    ]).then(([apps, cvList, portfolioData, stats]) => {
      setApplications(Array.isArray(apps) ? apps : []);
      setCvs(Array.isArray(cvList) ? cvList : []);
      if (portfolioData && !portfolioData.error) setPortfolio(portfolioData);
      if (stats && !stats.error && !stats.detail) setTotalJobs(Number(stats.total_jobs) || null);
    }).finally(() => setIsFetching(false));
  }, [token]);

  // Analytics stay a subscriber-only feature — non-subscribers never fetch them.
  useEffect(() => {
    if (!token || !isSubscribed) {
      setIsFetchingAnalytics(false);
      return;
    }
    setIsFetchingAnalytics(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/analytics/`, { headers: { Authorization: `Token ${token}` } })
      .then((r) => r.json())
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setIsFetchingAnalytics(false));
  }, [token, isSubscribed]);

  if (!isReady || isFetching) {
    return (
      <div className="h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#16a34a] animate-spin" />
      </div>
    );
  }

  const subscribed = isSubscriptionActive(user);
  const daysLeft = getDaysLeft(user?.subscription_expires_at);
  const activeCount = applications.filter((a) => a.status === 'applied' || a.status === 'interviewing').length;
  const offeredCount = applications.filter((a) => a.status === 'offered').length;
  const bestScore = cvs.reduce((max, cv) => Math.max(max, cv.ats_score ?? 0), 0);

  const STATS = [
    { label: 'Applications tracked', value: applications.length, sub: `${activeCount} in progress`, icon: Kanban },
    { label: 'Custom CVs', value: cvs.length, sub: bestScore ? `Best ATS score ${bestScore}%` : 'None yet', icon: FileText },
    { label: 'Offers', value: offeredCount, sub: offeredCount ? 'Nice work' : 'Keep going', icon: Sparkles },
    { label: 'Live jobs on the map', value: totalJobs ?? '—', sub: 'Updated every 15 min', icon: MapPin },
  ];

  return (
    <main className="h-screen flex bg-[#f2f3f5] text-[#0b0b0c] overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/" title="Dashboard" wordmark />

        <div className="flex-1 overflow-y-auto p-6 relative">
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#16a34a]/[0.06] blur-[120px] rounded-full" />

          <div className="mx-auto max-w-[1200px] relative z-10">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-2xl sm:text-3xl tracking-[-0.03em]" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>
                Welcome back{user?.first_name ? `, ${user.first_name}` : ''}
              </h1>
              <p className="mt-1.5 text-[15px] text-[rgba(61,61,61,0.72)]">Here&apos;s where your job search stands today.</p>
            </motion.div>

            {!subscribed && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#16a34a]/20 bg-[#16a34a]/5 px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#16a34a]/10 text-[#16a34a]"><ShieldCheck size={17} /></span>
                  <span className="text-[14px] font-medium text-[#15803d]">Subscribe to unlock the full map, tracker, and portfolio tools.</span>
                </div>
                <button onClick={() => setIsPricingOpen(true)} className={`${PRIMARY_BTN_CLS} px-5 py-2.5 text-[13.5px]`} style={{ ...PRIMARY_BTN_BG, fontFamily: 'var(--font-outfit)' }}>
                  Upgrade <ArrowChevron />
                </button>
              </motion.div>
            )}

            {subscribed && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mt-6 flex items-center gap-3 rounded-[18px] border border-black/[0.08] bg-white px-5 py-4"
              >
                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#16a34a]/10 text-[#16a34a]"><ShieldCheck size={17} /></span>
                <span className="text-[14px] text-[#3d3d3d]">Subscription active — <b className="font-semibold text-[#0b0b0c]">{daysLeft} days</b> remaining.</span>
                <Link href="/transactions" className="ml-auto text-[13px] font-medium text-[#16a34a] hover:text-[#15803d]" style={{ fontFamily: 'var(--font-outfit)' }}>Manage billing →</Link>
              </motion.div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STATS.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.05 }}
                  className={`${CARD_CLS} p-5`}
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-9 w-9 place-items-center rounded-[11px] border border-black/[0.08] bg-[#fafafa] text-[#16a34a]"><s.icon size={16} /></span>
                  </div>
                  <div className="mt-4 text-[28px] tracking-[-0.03em] text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>{s.value}</div>
                  <div className="mt-1 text-[13px] text-black/45">{s.label}</div>
                  <div className="mt-2 text-[12px] text-[rgba(61,61,61,0.6)]">{s.sub}</div>
                </motion.div>
              ))}
            </div>

            <div className="mt-8">
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {QUICK_LINKS.map((l, i) => (
                  <motion.div key={l.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.04 }}>
                    <Link href={l.href} className={`${CARD_CLS} group flex items-center gap-3.5 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#16a34a]/30`}>
                      <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] border border-black/[0.08] bg-[#fafafa] text-[#16a34a] transition-transform duration-300 group-hover:scale-105"><l.icon size={17} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-medium text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>{l.label}</div>
                        <div className="truncate text-[12px] text-black/45">{l.desc}</div>
                      </div>
                      <ArrowUpRight size={16} className="flex-none text-black/25 transition-colors group-hover:text-[#16a34a]" />
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`mt-8 ${CARD_CLS} p-6`}>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-outfit)' }}>
                  <Eye size={16} className="text-[#16a34a]" /> Portfolio insights
                </h2>
                <Link href="/portfolio" className="text-[13px] font-medium text-[#16a34a] hover:text-[#15803d]" style={{ fontFamily: 'var(--font-outfit)' }}>Manage portfolio →</Link>
              </div>

              {!portfolio?.has_resume ? (
                <div className="mt-8 flex flex-col items-center gap-3 py-8 text-center">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-black/[0.03] text-black/30"><Briefcase size={18} /></span>
                  <p className="text-[13.5px] text-black/40">Upload a resume to unlock your public portfolio.</p>
                  <Link href="/profile" className="text-[13px] font-medium text-[#16a34a] hover:text-[#15803d]">Go to profile →</Link>
                </div>
              ) : (
                <>
                  {user?.username && (
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-[#f2f3f5] px-4 py-3">
                      <span className="truncate text-[13px] text-black/55" style={{ fontFamily: 'var(--font-outfit)' }}>
                        kaamlee.in/portfolio/{user.username}
                      </span>
                      <div className="flex flex-none items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            portfolio.is_public ? 'bg-[#16a34a]/10 text-[#16a34a]' : 'bg-black/[0.05] text-black/45'
                          }`}
                          style={{ fontFamily: 'var(--font-outfit)' }}
                        >
                          {portfolio.is_public ? 'Public' : 'Private'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`https://kaamlee.in/portfolio/${user.username}`);
                            setLinkCopied(true);
                            setTimeout(() => setLinkCopied(false), 2000);
                          }}
                          className="cursor-pointer inline-flex items-center gap-1.5 rounded-full border border-black/[0.10] bg-white px-3 py-1.5 text-[11px] font-medium text-black/60 transition-colors hover:border-black/25 hover:text-black"
                          style={{ fontFamily: 'var(--font-outfit)' }}
                        >
                          {linkCopied ? <CheckCircle2 size={12} className="text-[#16a34a]" /> : <LinkIcon size={12} />}
                          {linkCopied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}

                  {!subscribed ? (
                    <div className="mt-5 rounded-2xl border border-dashed border-black/[0.12] bg-[#f2f3f5] p-6 text-center">
                      <Eye className="mx-auto mb-3 h-8 w-8 text-black/25" />
                      <p className="mb-4 text-[13px] font-medium text-[rgba(61,61,61,0.72)]">Subscribe to see who&apos;s viewing your portfolio.</p>
                      <button
                        type="button"
                        onClick={() => setIsPricingOpen(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-[#16a34a] hover:text-[#15803d]"
                        style={{ fontFamily: 'var(--font-outfit)' }}
                      >
                        Unlock analytics
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5">
                      <PortfolioAnalyticsPanel analytics={analytics} isLoading={isFetchingAnalytics} />
                    </div>
                  )}
                </>
              )}
            </motion.div>

          </div>
        </div>
      </div>

      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
    </main>
  );
}
