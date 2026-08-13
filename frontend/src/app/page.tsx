'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { LogOut, Search, Check, Map as LucideMap, FileCheck, PenLine, Building2, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Map as Mapcn, MapMarker, MarkerContent } from '@/components/ui/map';
import PricingModal from '@/components/PricingModal';

const CACHE_TTL = 2 * 60 * 1000;
const _cache: Record<string, { data: any; ts: number }> = {};
function getCached(key: string) {
  const e = _cache[key];
  if (e && Date.now() - e.ts < CACHE_TTL) return e.data;
  return null;
}
function setCache(key: string, data: any) {
  _cache[key] = { data, ts: Date.now() };
}

const MAP_MARKERS = [
  { coords: [77.5946, 12.9716], tag: 'Fullstack Developer' }, // Bangalore
  { coords: [72.8777, 19.0760], tag: 'Product Lead' }, // Mumbai
  { coords: [77.2090, 28.6139], tag: 'Backend Engineer' }, // Delhi
  { coords: [78.4867, 17.3850], tag: 'Data Scientist' }, // Hyderabad
  { coords: [73.8567, 18.5204], tag: 'DevOps Architect' }, // Pune
  { coords: [80.2707, 13.0827], tag: 'iOS Engineer' }, // Chennai
  { coords: [88.3639, 22.5726], tag: 'UX Researcher' }, // Kolkata
  { coords: [72.5714, 23.0225], tag: 'Growth Manager' }, // Ahmedabad
  { coords: [77.0266, 28.4595], tag: 'Security Analyst' }, // Gurgaon
  { coords: [77.3910, 28.5355], tag: 'Cloud Engineer' }, // Noida
  { coords: [75.7873, 26.9124], tag: 'Frontend Lead' }, // Jaipur
  { coords: [76.7794, 30.7333], tag: 'AI Researcher' }, // Chandigarh
  { coords: [55.2708, 25.2048], tag: 'Blockchain Dev' }, // Dubai
  { coords: [54.3773, 24.4539], tag: 'AI Engineer' }, // Abu Dhabi
  { coords: [55.4121, 25.3463], tag: 'System Architect' }, // Sharjah
];

const AVATAR_COLORS = [
  'bg-[#EFF6FF] text-[#1D4ED8]',
  'bg-[#F5F3FF] text-[#6D28D9]',
  'bg-[#FEF3C7] text-[#B45309]',
  'bg-[#F0FDF4] text-[#15803D]',
];

function initials(text: string) {
  if (!text) return '··';
  const parts = text.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '');
}

export default function LandingPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [featureTab, setFeatureTab] = useState(0);

  const handleExploreClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoading) return;
    router.push(user ? '/explore' : '/login');
  };

  useEffect(() => {
    const cachedJobs = getCached('recent-jobs');
    if (cachedJobs) {
      setRecentJobs(cachedJobs);
    } else {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/recent-jobs/`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setCache('recent-jobs', data);
            setRecentJobs(data);
          } else {
            console.error('Expected array for recent jobs, got:', data);
            setRecentJobs([]);
          }
        })
        .catch(err => console.error('Error fetching recent jobs:', err));
    }

    const cachedStats = getCached('stats');
    if (cachedStats) {
      setStats(cachedStats);
    } else {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stats/`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.error && !data.detail) {
            setCache('stats', data);
            setStats(data);
          } else {
            console.error('Invalid stats data:', data);
          }
        })
        .catch(err => console.error('Error fetching stats:', err));
    }
  }, []);

  const timeAgo = (dateString: string | null, createdString: string | null = null) => {
    const referenceDate = createdString ? new Date(createdString) : (dateString ? new Date(dateString) : null);
    if (!referenceDate) return 'recently';

    const now = new Date();
    const diffInMs = now.getTime() - referenceDate.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInHours < 1) return 'just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInDays === 1) return 'yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return 'recently';
  };

  const featuredJobs = (Array.isArray(recentJobs) ? recentJobs : []).slice(0, 3);

  return (
    <main className="min-h-screen bg-white text-[#111827] font-body selection:bg-[#DCFCE7]">
      {/* Header */}
      <header className="sticky top-0 z-60 border-b border-[#E5E7EB] bg-white/85 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 h-[70px] flex items-center gap-6 lg:gap-10">
          <Link href="/" className="flex items-center gap-2.5 text-[#111827]">
            <span className="w-[30px] h-[30px] rounded-[9px] bg-[#16A34A] grid place-items-center text-white font-extrabold text-[15px]">K</span>
            <span className="text-[19px] font-extrabold tracking-[-0.03em]">Kaamlee</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-6 text-[15px] font-medium">
            <a href="#jobs" className="text-[#374151] hover:text-[#111827] transition-colors">Jobs</a>
            <a href="#features" className="text-[#374151] hover:text-[#111827] transition-colors">Features</a>
            <a href="#how" className="text-[#374151] hover:text-[#111827] transition-colors">How it works</a>
            {/* <button onClick={() => setIsPricingOpen(true)} className="cursor-pointer text-[#374151] hover:text-[#111827] transition-colors">Pricing</button> */}
            <a href="#stories" className="text-[#374151] hover:text-[#111827] transition-colors">Stories</a>
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            {!user ? (
              <>
                <Link href="/login" className="text-[15px] font-semibold text-[#374151] px-3.5 py-2.5 hover:text-[#111827] transition-colors">
                  Log in
                </Link>
                <Link href="/login" className="text-[15px] font-bold text-white bg-[#111827] px-5 py-2.5 rounded-[11px] hover:bg-[#16A34A] transition-colors">
                  Sign up free
                </Link>
              </>
            ) : (
              <>
                <Link href="/profile" className="flex items-center gap-2.5 px-2.5 py-1.5 border border-[#E5E7EB] rounded-full hover:border-[#16A34A] transition-colors group">
                  <span className="w-7 h-7 rounded-full bg-[#16A34A] text-white grid place-items-center text-[11px] font-extrabold">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </span>
                  <span className="hidden sm:inline text-[14px] font-semibold text-[#374151] group-hover:text-[#111827] pr-1">{user?.first_name}</span>
                </Link>
                <button onClick={logout} className="cursor-pointer p-2.5 text-[#6B7280] hover:text-[#111827] transition-colors" aria-label="Log out">
                  <LogOut className="w-[18px] h-[18px]" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(70% 55% at 50% 0%, rgba(22,163,74,.13) 0%, rgba(22,163,74,0) 65%), radial-gradient(#EAEEF3 1px, transparent 1px)',
          backgroundSize: 'auto, 28px 28px',
        }}
      >
        <div className="max-w-[1000px] mx-auto px-5 sm:px-8 pt-16 sm:pt-[76px] text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 pl-3 pr-4 py-1.5 border border-[#E5E7EB] bg-white rounded-full text-[13px] font-semibold text-[#374151] shadow-[0_1px_2px_rgba(17,24,39,.05)]">
              <span className="w-[7px] h-[7px] rounded-full bg-[#16A34A] shadow-[0_0_0_3px_rgba(22,163,74,.18)]" />
              {stats?.total_jobs?.toLocaleString() || '420'} new roles added this week
            </div>

            <h1 className="mt-7 text-[44px] sm:text-[60px] lg:text-[76px] leading-[1.02] lg:leading-[0.98] font-bold tracking-[-0.045em] font-display">
              <span className="text-[#16A34A]">Job Hunt</span> shouldn&apos;t feel<br className="hidden sm:block" />{' '}
              like a full time job.
            </h1>

            <p className="mt-6 mx-auto text-[17px] sm:text-[20px] leading-[1.55] text-[#6B7280] max-w-[640px]">
              One search across 12+ job boards. AI resume matching, ATS scores, and every application tracked — in a single workspace.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <button
                onClick={handleExploreClick}
                className="cursor-pointer text-[16px] font-bold text-white bg-[#16A34A] px-7 py-4 rounded-[13px] shadow-[0_14px_30px_-12px_rgba(22,163,74,.6)] hover:bg-[#15803D] hover:-translate-y-px transition-all"
              >
                Get started free
              </button>
              <a
                href="#jobs"
                className="text-[16px] font-bold text-[#111827] bg-white border border-[#E5E7EB] px-7 py-4 rounded-[13px] shadow-[0_1px_2px_rgba(17,24,39,.05)] hover:bg-[#F8FAFC] transition-colors"
              >
                Explore jobs
              </a>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <div className="flex">
                <span className="w-[30px] h-[30px] rounded-full bg-[#DCFCE7] text-[#15803D] border-2 border-white grid place-items-center text-[11px] font-extrabold">AR</span>
                <span className="w-[30px] h-[30px] rounded-full bg-[#E0F2FE] text-[#0369A1] border-2 border-white -ml-2 grid place-items-center text-[11px] font-extrabold">KM</span>
                <span className="w-[30px] h-[30px] rounded-full bg-[#FEF3C7] text-[#B45309] border-2 border-white -ml-2 grid place-items-center text-[11px] font-extrabold">SD</span>
                <span className="w-[30px] h-[30px] rounded-full bg-[#111827] text-white border-2 border-white -ml-2 grid place-items-center text-[10px] font-extrabold">+9k</span>
              </div>
              <span className="text-[14px] text-[#6B7280] font-medium">12,400 offers landed · free forever plan</span>
            </div>
          </motion.div>
        </div>

        {/* Product shot */}
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 mt-12 sm:mt-14 -mb-24 sm:-mb-[120px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="border border-[#E5E7EB] rounded-[18px] bg-white shadow-[0_40px_80px_-40px_rgba(17,24,39,.35),0_2px_6px_rgba(17,24,39,.05)] overflow-hidden"
          >
            <div className="h-11 flex items-center gap-3.5 px-4 border-b border-[#E5E7EB] bg-[#F8FAFC]">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB]" />
              </div>
              <div className="flex-1 max-w-[420px] mx-auto h-[26px] rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center font-code text-[11px] text-[#6B7280]">
                kaamlee.com/map
              </div>
              <div className="w-16 hidden sm:block" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[296px_1fr]">
              <div className="border-b lg:border-b-0 lg:border-r border-[#E5E7EB] p-4 flex flex-col gap-3 bg-white">
                <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-[#111827]">
                  <Search className="w-[15px] h-[15px] text-[#9CA3AF]" />
                  Frontend engineer · worldwide
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 rounded-full">0–2 yrs</span>
                  <span className="text-[11px] font-bold text-[#374151] bg-[#F8FAFC] border border-[#E5E7EB] px-2.5 py-1 rounded-full">Remote ok</span>
                  <span className="text-[11px] font-bold text-[#374151] bg-[#F8FAFC] border border-[#E5E7EB] px-2.5 py-1 rounded-full">₹12L+</span>
                </div>
                <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#9CA3AF] mt-1">
                  48,600 roles · 32 countries · 312 dupes removed
                </div>

                {[
                  { name: 'Rz', color: AVATAR_COLORS[0], title: 'Frontend Engineer', meta: 'Razorpay · Bengaluru', badge: '94%', badgeStyle: 'text-[#15803D] bg-[#F0FDF4] border-[#BBF7D0]' },
                  { name: 'Sw', color: AVATAR_COLORS[1], title: 'UI Engineer', meta: 'Swiggy · Gurugram', badge: '90%', badgeStyle: 'text-[#15803D] bg-[#F0FDF4] border-[#BBF7D0]' },
                  { name: 'Zp', color: AVATAR_COLORS[2], title: 'Web Developer', meta: 'Zepto · Remote', badge: '71%', badgeStyle: 'text-[#B45309] bg-[#FFFBEB] border-[#FDE68A]' },
                ].map((job, i) => (
                  <div key={i} className="border border-[#E5E7EB] rounded-xl p-3 flex gap-2.5 items-start">
                    <span className={`shrink-0 w-8 h-8 rounded-[9px] grid place-items-center text-[12px] font-extrabold ${job.color}`}>
                      {job.name}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-extrabold tracking-[-0.01em] truncate">{job.title}</div>
                      <div className="mt-0.5 text-[12px] text-[#6B7280] font-medium truncate">{job.meta}</div>
                    </div>
                    <span className={`shrink-0 text-[11px] font-extrabold px-1.5 py-0.5 rounded-full border ${job.badgeStyle}`}>
                      {job.badge}
                    </span>
                  </div>
                ))}

                <div className="mt-auto pt-2 text-[12px] text-[#9CA3AF] font-semibold">Updated 2 minutes ago</div>
              </div>

              <div className="bg-[#F8FAFC] relative h-[360px] lg:h-[520px]">
                <Mapcn
                  center={[75, 20]}
                  zoom={3}
                  theme="light"
                  className="w-full h-full"
                  interactive={false}
                  attributionControl={false}
                >
                  {MAP_MARKERS.map((marker, i) => (
                    <MapMarker key={i} longitude={marker.coords[0]} latitude={marker.coords[1]}>
                      <MarkerContent>
                        <div className="relative group/marker">
                          <motion.div
                            className="w-2 h-2 rounded-full bg-[#16A34A] shadow-[0_0_0_3px_rgba(22,163,74,.18)]"
                            animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.25, 1] }}
                            transition={{ duration: 2 + (i % 4) * 0.4, repeat: Infinity, ease: 'easeInOut', delay: (i % 5) * 0.3 }}
                          />
                          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-white border border-[#E5E7EB] shadow-sm px-2 py-0.5 rounded text-[10px] font-semibold text-[#374151] whitespace-nowrap opacity-0 group-hover/marker:opacity-100 transition-opacity pointer-events-none">
                            {marker.tag}
                          </div>
                        </div>
                      </MarkerContent>
                    </MapMarker>
                  ))}
                </Mapcn>
              </div>
            </div>
          </motion.div>
        </div>
        <div className="h-28 sm:h-[140px]" />
      </section>

      {/* Stats */}
      <section className="bg-[#111827] text-white">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-9 grid grid-cols-2 lg:grid-cols-4 gap-y-8">
          {[
            { value: stats?.total_jobs?.toLocaleString() || '40,000+', label: 'Live jobs' },
            { value: '50,000+', label: 'Companies' },
            { value: '12+', label: 'Boards in one search' },
            { value: '93%', label: 'Match accuracy', accent: true },
          ].map((stat, i) => (
            <div key={i} className={`px-0 lg:px-7 ${i > 0 ? 'lg:border-l lg:border-[#1F2937]' : ''}`}>
              <div className={`text-[30px] sm:text-[34px] font-bold tracking-[-0.03em] font-display ${stat.accent ? 'text-[#4ADE80]' : ''}`}>
                {stat.value}
              </div>
              <div className="mt-0.5 text-[14px] text-[#9CA3AF] font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-[#E5E7EB]">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-10 flex items-center justify-center gap-3.5">
          <span className="w-[7px] h-[7px] rounded-full bg-[#16A34A] shadow-[0_0_0_3px_rgba(22,163,74,.18)]" />
          <span className="text-[22px] font-bold tracking-[-0.025em] text-[#111827] font-display">Seize the opportunity like many others have already.</span>
        </div>
      </section>

      {/* Fresh jobs */}
      <section id="jobs" className="max-w-[1240px] mx-auto px-5 sm:px-8 py-16 sm:py-[84px]">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <span className="inline-block border-l-[3px] border-[#16A34A] pl-2.5 text-[13px] font-bold tracking-[0.08em] uppercase text-[#16A34A]">Fresh today</span>
            <h2 className="mt-4 text-[32px] sm:text-[40px] font-bold tracking-[-0.04em] font-display">Roles posted in the last 24 hours</h2>
          </div>
          <button
            onClick={handleExploreClick}
            className="cursor-pointer shrink-0 text-[15px] font-bold text-[#111827] border border-[#E5E7EB] px-5 py-3 rounded-xl hover:bg-[#F8FAFC] transition-colors w-fit"
          >
            View all jobs →
          </button>
        </div>

        <div className="mt-7 flex flex-col gap-2.5">
          {featuredJobs.length === 0 && (
            <div className="border border-dashed border-[#E5E7EB] rounded-2xl p-8 text-center text-[15px] text-[#6B7280]">
              Loading the latest roles…
            </div>
          )}

          {featuredJobs.map((job: any, i: number) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:px-[22px] hover:border-[#16A34A] hover:shadow-[0_18px_36px_-24px_rgba(22,163,74,.6)] hover:-translate-y-0.5 transition-all"
            >
              <div className={`shrink-0 w-[50px] h-[50px] rounded-[14px] grid place-items-center font-extrabold text-[17px] ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                {initials(job.company_name || job.title || '')}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[17px] sm:text-[18px] font-extrabold tracking-[-0.02em]">{job.title}</span>
                  {job.is_remote && (
                    <span className="text-[12px] font-extrabold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded-full">Remote</span>
                  )}
                </div>
                <div className="mt-1 text-[15px] text-[#6B7280] font-medium">
                  {job.company_name ? `${job.company_name} · ` : ''}{job.location_name?.split(',')[0] || 'India'} · via {job.site}
                </div>
                <div className="mt-2.5 flex gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-[#374151] bg-[#F8FAFC] border border-[#E5E7EB] px-2.5 py-1 rounded-full">{job.site}</span>
                  <span className="text-[13px] font-semibold text-[#374151] bg-[#F8FAFC] border border-[#E5E7EB] px-2.5 py-1 rounded-full">
                    {job.is_remote ? 'Work from anywhere' : 'On-site / hybrid'}
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex sm:flex-col items-center sm:items-end gap-3">
                <span className="text-[13px] text-[#9CA3AF] font-semibold">{timeAgo(job.date_posted)}</span>
                <button
                  onClick={handleExploreClick}
                  className="cursor-pointer text-[15px] font-bold text-white bg-[#111827] px-5 py-2.5 rounded-[11px] hover:bg-[#16A34A] transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-[#F8FAFC] border-y border-[#E5E7EB]">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pt-20 sm:pt-24 pb-10">
          <div className="max-w-[680px]">
            <span className="inline-block border-l-[3px] border-[#16A34A] pl-2.5 text-[13px] font-bold tracking-[0.08em] uppercase text-[#16A34A]">The workspace</span>
            <h2 className="mt-4 text-[38px] sm:text-[52px] leading-[1.02] font-bold tracking-[-0.045em] font-display">
              Everything you need to get hired faster.
            </h2>
            <p className="mt-4 text-[18px] sm:text-[19px] leading-[1.6] text-[#6B7280]">
              Three tools do most of the work — flip through them. Five more fill in the gaps.
            </p>
          </div>
        </div>

        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pt-2 flex items-center gap-2.5 overflow-x-auto no-scrollbar">
          {['01 — Resume match', '02 — Tracker', '03 — Portfolio'].map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setFeatureTab(i)}
              className={`shrink-0 font-sans text-[13px] font-extrabold tracking-[0.06em] uppercase px-4.5 py-3 rounded-full border transition-all cursor-pointer ${featureTab === i
                ? 'border-[#16A34A] bg-[#16A34A] text-white'
                : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#111827]'
                }`}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setFeatureTab((t) => (t + 2) % 3)}
              aria-label="Previous"
              className="cursor-pointer w-10 h-10 rounded-[11px] border border-[#E5E7EB] bg-white text-[#111827] text-[16px] font-bold hover:bg-[#F8FAFC] transition-colors"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setFeatureTab((t) => (t + 1) % 3)}
              aria-label="Next"
              className="cursor-pointer w-10 h-10 rounded-[11px] border border-[#E5E7EB] bg-white text-[#111827] text-[16px] font-bold hover:bg-[#F8FAFC] transition-colors"
            >
              →
            </button>
          </div>
        </div>

        {/* 01 Resume match */}
        {featureTab === 0 && (
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pt-8 pb-10 grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-12 lg:gap-[72px] items-center">
          <div>
            <span className="text-[13px] font-bold tracking-[0.08em] uppercase text-[#16A34A]">01 — Resume match</span>
            <h3 className="mt-3.5 text-[30px] sm:text-[38px] leading-[1.08] font-bold tracking-[-0.035em] font-display">Know your score before you apply.</h3>
            <p className="mt-3.5 text-[17px] leading-[1.65] text-[#6B7280] max-w-[460px]">
              Upload your resume once. Every listing gets a match percentage and a plain-English list of what&apos;s missing — so you spend your evenings on the jobs you can actually win.
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              {['Scored against the real job description', 'Tells you the exact skills to add', 'Works on every job, not just ours'].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[15px] font-semibold text-[#374151]">
                  <Check className="w-4 h-4 text-[#16A34A]" strokeWidth={3} /> {item}
                </div>
              ))}
            </div>
            <Link href="/profile" className="inline-block mt-6 text-[15px] font-bold text-white bg-[#111827] px-5 py-3 rounded-xl hover:bg-[#16A34A] transition-colors">
              Check my match →
            </Link>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-[18px] p-6 shadow-[0_30px_60px_-40px_rgba(17,24,39,.4)]">
            <div className="flex items-center gap-5">
              <div
                className="shrink-0 w-28 h-28 rounded-full grid place-items-center"
                style={{ background: 'conic-gradient(#16A34A 0% 92%, #E5E7EB 92% 100%)' }}
              >
                <div className="w-[86px] h-[86px] rounded-full bg-white grid place-items-center text-center">
                  <div>
                    <div className="text-[26px] font-extrabold tracking-[-0.03em] font-display">92%</div>
                    <div className="text-[10px] font-bold tracking-[0.06em] uppercase text-[#9CA3AF]">match</div>
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[17px] font-extrabold tracking-[-0.02em]">Frontend Engineer, Checkout</div>
                <div className="mt-1 text-[14px] text-[#6B7280] font-medium">resume-v3.pdf</div>
                <div className="mt-3 flex gap-1.5 flex-wrap">
                  <span className="text-[12px] font-bold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 rounded-full">React ✓</span>
                  <span className="text-[12px] font-bold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 rounded-full">TypeScript ✓</span>
                  <span className="text-[12px] font-bold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-2.5 py-1 rounded-full">GraphQL — missing</span>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-[#F1F5F9] pt-4 flex flex-col gap-3.5">
              {[
                { label: 'Skills overlap', value: 94, color: '#16A34A', text: 'text-[#16A34A]' },
                { label: 'Experience fit', value: 88, color: '#16A34A', text: 'text-[#16A34A]' },
                { label: 'Keyword coverage', value: 64, color: '#F59E0B', text: 'text-[#B45309]' },
              ].map((bar, i) => (
                <div key={i}>
                  <div className="flex justify-between text-[13px] font-bold">
                    <span>{bar.label}</span>
                    <span className={bar.text}>{bar.value}%</span>
                  </div>
                  <div className="mt-1.5 h-[7px] rounded-full bg-[#F1F5F9]">
                    <div className="h-full rounded-full" style={{ width: `${bar.value}%`, background: bar.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* 02 Tracker */}
        {featureTab === 1 && (
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pt-8 py-10 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-[72px] items-center">
          <div className="bg-[#111827] rounded-[18px] p-5 shadow-[0_30px_60px_-40px_rgba(17,24,39,.6)] order-2 lg:order-1">
            <div className="flex items-center justify-between px-1.5 pb-4">
              <span className="text-[13px] font-bold text-white">My applications</span>
              <span className="text-[12px] font-semibold text-[#9CA3AF]">18 active</span>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { label: 'Saved · 6', cards: [['Meesho', 'SDE-1'], ['Cred', 'Frontend']] },
                { label: 'Applied · 8', cards: [['Razorpay', 'Checkout'], ['Zepto', 'Design intern'], ['Swiggy', 'Analyst']] },
                { label: 'Interview · 3', cards: [['PhonePe', 'Round 2 · Fri']], highlight: true },
                { label: 'Offer · 1', cards: [['Groww', '₹22 LPA']], offer: true },
              ].map((col, i) => (
                <div key={i} className="bg-[#1F2937] rounded-xl p-2 sm:p-3 flex flex-col gap-2 min-h-[180px]">
                  <div className="text-[9px] sm:text-[10px] font-extrabold tracking-[0.06em] uppercase text-[#9CA3AF]">{col.label}</div>
                  {col.cards.map(([name, meta], j) => (
                    <div
                      key={j}
                      className={`rounded-[9px] p-2 border ${col.offer
                        ? 'bg-[#052E16] border-[#16A34A]'
                        : col.highlight
                          ? 'bg-[#111827] border-[#16A34A] shadow-[0_0_0_3px_rgba(22,163,74,.18)]'
                          : 'bg-[#111827] border-[#374151]'
                        }`}
                    >
                      <div className="text-[10px] sm:text-[11px] font-bold text-white truncate">{name}</div>
                      <div className={`mt-0.5 text-[9px] sm:text-[10px] truncate ${col.offer || col.highlight ? 'text-[#4ADE80]' : 'text-[#9CA3AF]'}`}>{meta}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <span className="text-[13px] font-bold tracking-[0.08em] uppercase text-[#16A34A]">02 — Tracker</span>
            <h3 className="mt-3.5 text-[30px] sm:text-[38px] leading-[1.08] font-bold tracking-[-0.035em] font-display">Track every application on one board.</h3>
            <p className="mt-3.5 text-[17px] leading-[1.65] text-[#6B7280] max-w-[460px]">
              Saved, applied, interviewing, offered. Cards appear the moment you apply, so you never lose a thread — or forget who owes you a reply.
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              {['Auto-populated from jobs you apply to', 'Drag cards to update status', 'Interview reminders before the day'].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[15px] font-semibold text-[#374151]">
                  <Check className="w-4 h-4 text-[#16A34A]" strokeWidth={3} /> {item}
                </div>
              ))}
            </div>
            <Link href="/applications" className="inline-block mt-6 text-[15px] font-bold text-white bg-[#111827] px-5 py-3 rounded-xl hover:bg-[#16A34A] transition-colors">
              See my board →
            </Link>
          </div>
        </div>
        )}

        {/* 03 Portfolio */}
        {featureTab === 2 && (
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pt-8 py-10 pb-20 sm:pb-[88px] grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-12 lg:gap-[72px] items-center">
          <div>
            <span className="text-[13px] font-bold tracking-[0.08em] uppercase text-[#16A34A]">03 — Portfolio</span>
            <h3 className="mt-3.5 text-[30px] sm:text-[38px] leading-[1.08] font-bold tracking-[-0.035em] font-display">Your resume, as a website.</h3>
            <p className="mt-3.5 text-[17px] leading-[1.65] text-[#6B7280] max-w-[460px]">
              One click turns your resume into a live personal site with its own link — the thing recruiters actually click from your LinkedIn.
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              {['kaamlee.com/p/your-name', 'Six themes, light or dark', 'See who viewed it'].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[15px] font-semibold text-[#374151]">
                  <Check className="w-4 h-4 text-[#16A34A]" strokeWidth={3} /> {item}
                </div>
              ))}
            </div>
            <Link href="/portfolio" className="inline-block mt-6 text-[15px] font-bold text-white bg-[#111827] px-5 py-3 rounded-xl hover:bg-[#16A34A] transition-colors">
              Build my site →
            </Link>
          </div>

          <div className="border border-[#E5E7EB] rounded-[18px] overflow-hidden bg-white shadow-[0_30px_60px_-40px_rgba(17,24,39,.4)]">
            <div className="h-[38px] flex items-center gap-3 px-3.5 border-b border-[#E5E7EB] bg-[#F8FAFC]">
              <div className="flex gap-1.5">
                <span className="w-[9px] h-[9px] rounded-full bg-[#E5E7EB]" />
                <span className="w-[9px] h-[9px] rounded-full bg-[#E5E7EB]" />
                <span className="w-[9px] h-[9px] rounded-full bg-[#E5E7EB]" />
              </div>
              <div className="flex-1 h-[22px] rounded-[7px] bg-white border border-[#E5E7EB] flex items-center px-2.5 font-code text-[10px] text-[#6B7280] truncate">
                kaamlee.com/p/ananya
              </div>
              <span className="text-[10px] font-extrabold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-1.5 py-0.5 rounded">LIVE</span>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3.5">
                <span className="w-[52px] h-[52px] rounded-full bg-[#DCFCE7] text-[#15803D] grid place-items-center text-[17px] font-extrabold">AR</span>
                <div>
                  <div className="text-[20px] font-extrabold tracking-[-0.025em]">Ananya Rao</div>
                  <div className="mt-0.5 text-[14px] text-[#6B7280] font-medium">Frontend engineer · Bengaluru</div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="border border-[#E5E7EB] rounded-xl p-3.5">
                  <div className="text-[11px] font-extrabold tracking-[0.06em] uppercase text-[#9CA3AF]">Experience</div>
                  <div className="mt-2 text-[14px] font-bold">Razorpay · SDE Intern</div>
                  <div className="mt-0.5 text-[13px] text-[#6B7280]">2025 — present</div>
                </div>
                <div className="border border-[#E5E7EB] rounded-xl p-3.5">
                  <div className="text-[11px] font-extrabold tracking-[0.06em] uppercase text-[#9CA3AF]">Projects</div>
                  <div className="mt-2 text-[14px] font-bold">Campus Ledger</div>
                  <div className="mt-0.5 text-[13px] text-[#6B7280]">React · Postgres</div>
                </div>
                <div className="sm:col-span-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-3.5 flex items-center justify-between">
                  <span className="text-[14px] font-bold text-[#15803D]">Profile views this week</span>
                  <span className="text-[20px] font-extrabold text-[#16A34A] tracking-[-0.02em]">248</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Small features */}
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pb-20 sm:pb-24">
          <div className="border-t border-[#E5E7EB] pt-11 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {[
              { icon: LucideMap, title: 'Find jobs on a live map', desc: "See who's hiring near you." },
              { icon: FileCheck, title: 'Beat the Resume Bots', desc: 'ATS checks catch what quietly gets you rejected.' },
              { icon: PenLine, title: 'Write a resume that fits', desc: 'Tailor a fresh version as the role demands.' },
              { icon: Building2, title: 'Know the company first', desc: 'Salary, team size and interview rounds up front.' },
              { icon: Bell, title: "Alerts the minute it's posted", desc: 'Be early, before applications pile up.' },
            ].map((f, i) => (
              <div key={i} className="bg-white border border-[#E5E7EB] rounded-2xl p-[22px] flex flex-col gap-2.5 hover:border-[#16A34A] hover:-translate-y-0.5 transition-all">
                <span className="w-[38px] h-[38px] rounded-[11px] bg-[#F0FDF4] text-[#16A34A] grid place-items-center">
                  <f.icon className="w-[19px] h-[19px]" strokeWidth={1.75} />
                </span>
                <h3 className="text-[16px] font-extrabold tracking-[-0.02em]">{f.title}</h3>
                <p className="text-[14px] leading-[1.5] text-[#6B7280]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how"
        className="bg-[#0B1220] text-white"
        style={{ backgroundImage: 'radial-gradient(60% 60% at 20% 0%, rgba(22,163,74,.18) 0%, rgba(22,163,74,0) 60%)' }}
      >
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-20 sm:py-24">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="max-w-[620px]">
              <span className="inline-block border-l-[3px] border-[#4ADE80] pl-2.5 text-[13px] font-bold tracking-[0.08em] uppercase text-[#4ADE80]">How it works</span>
              <h2 className="mt-4 text-[38px] sm:text-[52px] leading-[1.02] font-bold tracking-[-0.045em] font-display">Three steps. About ninety seconds.</h2>
            </div>
            <span className="shrink-0 font-code text-[12px] text-[#6B7280] tracking-[0.06em]">NO CREDIT CARD</span>
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="border border-[#1F2937] rounded-[18px] p-7 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[#16A34A] text-white grid place-items-center font-extrabold text-[14px]">1</span>
                <span className="text-[12px] font-extrabold tracking-[0.08em] uppercase text-[#6B7280]">Search jobs</span>
              </div>
              <h3 className="mt-5 text-[26px] font-bold tracking-[-0.03em] font-display">One search, twelve boards.</h3>
              <p className="mt-3 text-[16px] leading-[1.6] text-[#9CA3AF]">
                We&apos;ve already crawled LinkedIn, Indeed, Wellfound and nine more — and removed the duplicates.
              </p>
              <div className="mt-6 border border-[#1F2937] rounded-xl p-3.5 font-code text-[12px] text-[#6B7280] leading-[1.9]">
                <div className="text-[#4ADE80]">$ kaamlee search &quot;frontend&quot;</div>
                <div>1,240 roles · 312 dupes removed</div>
                <div>12 boards · 15 min freshness</div>
              </div>
            </div>

            <div className="border border-[#1F2937] rounded-[18px] p-7 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[#16A34A] text-white grid place-items-center font-extrabold text-[14px]">2</span>
                <span className="text-[12px] font-extrabold tracking-[0.08em] uppercase text-[#6B7280]">Upload resume</span>
              </div>
              <h3 className="mt-5 text-[26px] font-bold tracking-[-0.03em] font-display">Upload once. Scored forever.</h3>
              <p className="mt-3 text-[16px] leading-[1.6] text-[#9CA3AF]">
                Drop your PDF and every job instantly shows a match score and the skills you&apos;re missing.
              </p>
              <div className="mt-6 border border-[#1F2937] rounded-xl p-3.5">
                <div className="flex justify-between text-[13px] font-bold">
                  <span>resume.pdf</span>
                  <span className="text-[#4ADE80]">92%</span>
                </div>
                <div className="mt-2.5 h-[7px] rounded-full bg-[#1F2937]">
                  <div className="h-full w-[92%] rounded-full bg-[#16A34A]" />
                </div>
                <div className="mt-3 text-[12px] text-[#6B7280] font-medium">Add &quot;GraphQL&quot; to reach 97%.</div>
              </div>
            </div>

            <div className="border border-[#1F2937] rounded-[18px] p-7 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[#16A34A] text-white grid place-items-center font-extrabold text-[14px]">3</span>
                <span className="text-[12px] font-extrabold tracking-[0.08em] uppercase text-[#6B7280]">Apply smarter</span>
              </div>
              <h3 className="mt-5 text-[26px] font-bold tracking-[-0.03em] font-display">Apply, then stop worrying.</h3>
              <p className="mt-3 text-[16px] leading-[1.6] text-[#9CA3AF]">
                One click takes you to the real posting, and the application lands on your tracker automatically.
              </p>
              <div className="mt-6 grid grid-cols-4 gap-2">
                {['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER'].map((label, i) => (
                  <div
                    key={i}
                    className={`rounded-[10px] py-2.5 px-1.5 text-center text-[9px] sm:text-[10px] font-extrabold border ${i === 3 ? 'border-[#16A34A] bg-[#052E16] text-[#4ADE80]' : 'border-[#1F2937] text-[#6B7280]'
                      }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="max-w-[1040px] mx-auto px-5 sm:px-8 py-20 sm:py-24">
        <div className="text-center max-w-[640px] mx-auto">
          <span className="inline-block border-l-[3px] border-[#16A34A] pl-2.5 text-[13px] font-bold tracking-[0.08em] uppercase text-[#16A34A]">Why Kaamlee</span>
          <h2 className="mt-4 text-[34px] sm:text-[48px] leading-[1.04] font-bold tracking-[-0.045em] font-display">
            A job board finds jobs. Kaamlee gets you hired.
          </h2>
        </div>

        <div className="mt-11 border border-[#E5E7EB] rounded-[20px] overflow-hidden shadow-[0_1px_2px_rgba(17,24,39,.04)]">
          <div className="grid grid-cols-[1.5fr_1fr_1fr] items-center px-5 sm:px-7 py-4.5 border-b border-[#E5E7EB]">
            <span className="text-[12px] font-extrabold tracking-[0.08em] uppercase text-[#9CA3AF]">What you get</span>
            <span className="text-center text-[13px] sm:text-[15px] font-semibold text-[#6B7280]">Traditional boards</span>
            <span className="text-center text-[13px] sm:text-[15px] font-extrabold text-[#16A34A]">Kaamlee</span>
          </div>
          {[
            ['One search across every board', null],
            ['AI match score on every job', null],
            ['Live job map', null],
            ['Application tracking', 'Your spreadsheet'],
            ['Resume website', null],
            ['ATS optimisation', 'Paid add-on'],
            ['Instant job alerts', 'Daily digest'],
          ].map(([label, theirs], i) => (
            <div
              key={i}
              className={`grid grid-cols-[1.5fr_1fr_1fr] items-center px-5 sm:px-7 py-4 ${i % 2 === 1 ? 'bg-[#FCFDFE]' : ''} ${i < 6 ? 'border-b border-[#F1F5F9]' : ''}`}
            >
              <span className="text-[15px] sm:text-[16px] font-semibold">{label}</span>
              <span className="text-center text-[14px] text-[#6B7280] font-semibold">{theirs || <span className="text-[#D1D5DB] text-[16px]">✕</span>}</span>
              <span className="text-center text-[#16A34A] font-extrabold">✓</span>
            </div>
          ))}
        </div>
      </section>

      {/* Stories */}
      <section id="stories" className="bg-[#F8FAFC] border-y border-[#E5E7EB]">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-20 sm:py-[88px]">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="max-w-[620px]">
              <span className="inline-block border-l-[3px] border-[#16A34A] pl-2.5 text-[13px] font-bold tracking-[0.08em] uppercase text-[#16A34A]">Success stories</span>
              <h2 className="mt-4 text-[34px] sm:text-[48px] leading-[1.04] font-bold tracking-[-0.045em] font-display">12,400 offers and counting.</h2>
            </div>
            <div className="shrink-0 flex items-center gap-2.5 px-5 py-3.5 border border-[#E5E7EB] rounded-[14px] bg-white w-fit">
              <span className="text-[22px] font-extrabold tracking-[-0.03em]">4.8</span>
              <span className="text-[#F59E0B] text-[15px] tracking-[2px]">★★★★★</span>
              <span className="text-[14px] text-[#6B7280] font-medium">3,200 students</span>
            </div>
          </div>

          <div className="mt-9 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr] gap-4">
            <div className="bg-[#111827] rounded-[18px] p-8 flex flex-col gap-5 text-white">
              <p className="text-[19px] sm:text-[21px] leading-[1.5] font-semibold tracking-[-0.02em]">
                &quot;I stopped opening six tabs every morning. The match score told me which applications were worth my time — offer in five weeks.&quot;
              </p>
              <div className="mt-auto flex items-center gap-3">
                <span className="w-[42px] h-[42px] rounded-full bg-[#16A34A] text-white grid place-items-center font-extrabold">AR</span>
                <div>
                  <div className="text-[15px] font-bold">Ananya R.</div>
                  <div className="text-[14px] text-[#9CA3AF]">SDE-1 at Razorpay · NIT Trichy &apos;25</div>
                </div>
              </div>
            </div>

            {[
              {
                quote: 'The ATS checker found three formatting things quietly killing my resume. Callbacks went from zero to four in a fortnight.',
                initials: 'KM',
                name: 'Karthik M.',
                meta: "Designer at Zepto · BITS '24",
              },
              {
                quote: 'The portfolio link is what got me noticed. A recruiter clicked it from my LinkedIn and messaged me the same day.',
                initials: 'SD',
                name: 'Sneha D.',
                meta: "Analyst at Swiggy · DTU '25",
              },
            ].map((t, i) => (
              <div key={i} className="bg-white border border-[#E5E7EB] rounded-[18px] p-7 flex flex-col gap-4.5">
                <p className="text-[17px] leading-[1.6] font-medium">&quot;{t.quote}&quot;</p>
                <div className="mt-auto flex items-center gap-3 pt-4">
                  <span className="w-10 h-10 rounded-full bg-[#F0FDF4] text-[#16A34A] grid place-items-center font-extrabold">{t.initials}</span>
                  <div>
                    <div className="text-[15px] font-bold">{t.name}</div>
                    <div className="text-[14px] text-[#6B7280]">{t.meta}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1240px] mx-auto px-5 sm:px-8 py-20 sm:py-24">
        <div
          className="relative overflow-hidden rounded-[26px] px-6 sm:px-12 py-16 sm:py-[84px] text-center text-white"
          style={{
            backgroundColor: '#052E16',
            backgroundImage:
              'radial-gradient(70% 80% at 50% 0%, rgba(22,163,74,.45) 0%, rgba(5,46,22,0) 70%), radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px)',
            backgroundSize: 'auto, 24px 24px',
          }}
        >
          <h2 className="text-[36px] sm:text-[56px] leading-[1.02] font-bold tracking-[-0.045em] font-display">
            Ready to land your next opportunity?
          </h2>
          <p className="mt-4 mx-auto text-[18px] sm:text-[19px] text-[#A7F3D0] max-w-[540px]">
            Start for free. No credit card required — and the free plan stays free.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button
              onClick={handleExploreClick}
              className="cursor-pointer text-[17px] font-bold text-[#052E16] bg-white px-7 py-4 rounded-[14px] hover:bg-[#DCFCE7] hover:-translate-y-px transition-all"
            >
              Get started free
            </button>
            <a
              href="#jobs"
              className="text-[17px] font-bold text-white bg-white/10 border border-white/20 px-7 py-4 rounded-[14px] hover:bg-white/20 transition-colors"
            >
              Explore jobs first
            </a>
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[14px] text-[#86EFAC] font-semibold">
            <span>✓ Free forever plan</span>
            <span>✓ Setup in 90 seconds</span>
            <span>✓ Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] bg-white">
        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pt-14 pb-8 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-[30px] h-[30px] rounded-[9px] bg-[#16A34A] grid place-items-center text-white font-extrabold text-[15px]">K</span>
              <span className="text-[19px] font-extrabold tracking-[-0.03em]">Kaamlee</span>
            </div>
            <p className="mt-4 text-[15px] text-[#6B7280] max-w-[290px] leading-[1.6]">
              One search, every job board. Built for students and early-career engineers and designers.
            </p>
            <div className="mt-5 flex gap-2.5">
              <a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 border border-[#E5E7EB] rounded-[10px] text-[14px] font-semibold text-[#374151] hover:border-[#16A34A] hover:text-[#111827] transition-colors">LinkedIn</a>
              <a href="https://twitter.com/" target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 border border-[#E5E7EB] rounded-[10px] text-[14px] font-semibold text-[#374151] hover:border-[#16A34A] hover:text-[#111827] transition-colors">Twitter</a>
              <a href="https://github.com/" target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 border border-[#E5E7EB] rounded-[10px] text-[14px] font-semibold text-[#374151] hover:border-[#16A34A] hover:text-[#111827] transition-colors">GitHub</a>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-extrabold tracking-[0.08em] uppercase text-[#9CA3AF]">Product</span>
            <button onClick={handleExploreClick} className="cursor-pointer text-left text-[15px] text-[#374151] font-medium hover:text-[#16A34A] transition-colors">Job map</button>
            <Link href="/profile" className="text-[15px] text-[#374151] font-medium hover:text-[#16A34A] transition-colors">Resume match</Link>
            <Link href="/custom-cv" className="text-[15px] text-[#374151] font-medium hover:text-[#16A34A] transition-colors">ATS checker</Link>
            <Link href="/applications" className="text-[15px] text-[#374151] font-medium hover:text-[#16A34A] transition-colors">Application tracker</Link>
            <button onClick={() => setIsPricingOpen(true)} className="cursor-pointer text-left text-[15px] text-[#374151] font-medium hover:text-[#16A34A] transition-colors">Pricing</button>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-extrabold tracking-[0.08em] uppercase text-[#9CA3AF]">Resources</span>
            <a href="#how" className="text-[15px] text-[#374151] font-medium hover:text-[#16A34A] transition-colors">How it works</a>
            <a href="#features" className="text-[15px] text-[#374151] font-medium hover:text-[#16A34A] transition-colors">Features</a>
            <a href="#stories" className="text-[15px] text-[#374151] font-medium hover:text-[#16A34A] transition-colors">Success stories</a>
            <Link href="/portfolio" className="text-[15px] text-[#374151] font-medium hover:text-[#16A34A] transition-colors">Portfolio</Link>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-extrabold tracking-[0.08em] uppercase text-[#9CA3AF]">Company</span>
            <Link href="/terms" className="text-[15px] text-[#374151] font-medium hover:text-[#16A34A] transition-colors">Terms</Link>
            <Link href="/privacy" className="text-[15px] text-[#374151] font-medium hover:text-[#16A34A] transition-colors">Privacy</Link>
            <a href="https://commhawk.in/" target="_blank" rel="noopener noreferrer" className="text-[15px] text-[#374151] font-medium hover:text-[#16A34A] transition-colors">
              Built by Commhawk
            </a>
          </div>
        </div>

        <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-5 pb-10 border-t border-[#E5E7EB] flex justify-between text-[14px] text-[#9CA3AF]">
          <span>© 2026 Kaamlee</span>
          <span>Made in India</span>
        </div>
      </footer>

      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
    </main>
  );
}
