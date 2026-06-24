'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Search, Zap, Globe, Shield, LogOut, Briefcase, MapPin, Building2, Plus, Minus, RotateCcw, X, ExternalLink, CreditCard } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Map as Mapcn, MapMarker, MarkerContent } from "@/components/ui/map";
import PricingModal from '@/components/PricingModal';
import { PRICING } from '@/lib/constants';

function FAQItem({ faq, index, isOpen, onToggle }: { faq: { q: string, a: string }, index: number, isOpen: boolean, onToggle: () => void }) {
  return (
    <div className="border-b border-white/5">
      <div
        onClick={onToggle}
        className="cursor-pointer py-10 flex items-center justify-between group outline-none"
      >
        <div className="flex items-center gap-12">
          <span className="font-mono text-[10px] text-[#444] tracking-widest uppercase">Q.0{index + 1}</span>
          <h4 className={`text-2xl font-bold tracking-tight transition-colors ${isOpen ? 'text-blue-500' : 'group-hover:text-blue-500'}`}>{faq.q}</h4>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <Plus className={`${isOpen ? 'text-blue-500' : 'text-[#333] group-hover:text-blue-500'} transition-colors`} size={24} />
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pb-8 sm:pb-10 pl-8 sm:pl-24 max-w-5xl text-[#888] leading-relaxed text-xs sm:text-base">
              {faq.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LandingPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  const DUMMY_JOBS = [
    { title: "Senior Frontend Engineer", company: "Stripe", location_name: "San Francisco, US", site: "linkedin", is_remote: false, date_posted: null, created_at: null },
    { title: "Backend Engineer (Go)", company: "Zepto", location_name: "Bangalore, India", site: "indeed", is_remote: false, date_posted: null, created_at: null },
    { title: "Full Stack Developer", company: "Razorpay", location_name: "Mumbai, India", site: "wellfound", is_remote: false, date_posted: null, created_at: null },
    { title: "ML Engineer", company: "Anthropic", location_name: "Remote", site: "linkedin", is_remote: true, date_posted: null, created_at: null },
    { title: "DevOps Engineer", company: "Cloudflare", location_name: "Austin, US", site: "indeed", is_remote: true, date_posted: null, created_at: null },
    { title: "iOS Engineer", company: "Swiggy", location_name: "Hyderabad, India", site: "linkedin", is_remote: false, date_posted: null, created_at: null },
    { title: "Data Engineer", company: "Meesho", location_name: "Bangalore, India", site: "google", is_remote: false, date_posted: null, created_at: null },
    { title: "Security Engineer", company: "Notion", location_name: "Remote", site: "wellfound", is_remote: true, date_posted: null, created_at: null },
    { title: "Android Engineer", company: "CRED", location_name: "Bangalore, India", site: "linkedin", is_remote: false, date_posted: null, created_at: null },
    { title: "Platform Engineer", company: "Vercel", location_name: "Remote", site: "indeed", is_remote: true, date_posted: null, created_at: null },
  ];

  const [recentJobs, setRecentJobs] = useState<any[]>(DUMMY_JOBS);
  const [stats, setStats] = useState<any>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

  const handleExploreClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!user) {
      router.push('/login');
    } else {
      router.push('/explore');
    }
  };

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/recent-jobs/`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setRecentJobs(data);
        }
      })
      .catch(() => {});

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stats/`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error && !data.detail) {
          setStats(data);
        }
      })
      .catch(() => {});
  }, []);

  const timeAgo = (dateString: string | null, createdString: string | null = null) => {
    const referenceDate = createdString ? new Date(createdString) : (dateString ? new Date(dateString) : null);
    if (!referenceDate) return 'recently';

    const now = new Date();
    const diffInMs = now.getTime() - referenceDate.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInHours < 1) return 'just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays === 1) return 'yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return `recently`;
  };

  return (
    <main className="min-h-screen bg-black text-white selection:bg-blue-500 selection:text-white font-sans overflow-x-hidden">
      {/* Grid Background Layer */}
      <div className="fixed inset-0 bg-grid opacity-20 pointer-events-none z-0" />

      {/* Top Border Gradient */}
      <div className="fixed top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent z-50" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full h-20 px-4 sm:px-8 flex items-center justify-between z-50 border-b border-white/40 bg-black/50 backdrop-blur-xl">
        <div className="cursor-default flex items-center gap-2 sm:gap-3">
          <span className="text-lg sm:text-xl font-bold tracking-[0.2em] sm:tracking-[0.3em] uppercase">KAAMLEE</span>
          <span className="text-[8px] font-mono text-green-500 bg-green-500/10 border border-green-500/30 px-1.5 py-0.5 tracking-widest uppercase">BETA</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={handleExploreClick}
            className="cursor-pointer bg-white text-black px-4 sm:px-6 py-2 sm:py-2.5 rounded-sm text-[10px] sm:text-xs font-black uppercase tracking-widest hidden sm:flex items-center gap-2 hover:bg-[#ededed] transition-all"
          >
            <span>Find Jobs</span>
            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
          {!user ? (
            <Link href="/coming-soon" className="cursor-pointer text-xs sm:text-sm font-medium text-[#888] hover:text-white transition-colors">
              Log in
            </Link>
          ) : (
            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/profile"
                className="flex items-center gap-2 sm:gap-3 px-1.5 sm:px-2 py-1.5 sm:py-2 bg-white/5 border border-white/10 rounded-full hover:border-white/20 transition-all group"
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[8px] sm:text-[10px] font-bold shadow-lg shadow-blue-500/10 group-hover:scale-110 transition-transform">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </div>
                <span className="hidden sm:inline text-xs font-medium text-[#888] group-hover:text-white transition-colors">{user?.first_name}</span>
              </Link>
              <div onClick={logout} className='flex items-center gap-2 group cursor-pointer hover:text-white transition-colors text-[#888]'>
                <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="relative z-10 pt-20">
        {/* Section 01: Hero */}
        <section className="px-6 sm:px-8 lg:px-0 lg:ps-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mx-auto py-12 sm:py-0">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-[#111] border border-[#222] px-3 sm:px-4 py-1 sm:py-1.5 rounded-full mb-6 sm:mb-10">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] sm:text-md font-black tracking-widest uppercase text-[#888]">
                <span className='text-sm sm:text-lg text-white'>{stats?.total_jobs?.toLocaleString()?.toLocaleString() || '10K+'} </span> NEW ROLES IN LAST 72H
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6 sm:mb-10">
              Job Applying.<br />
              is a <span className="text-serif font-normal italic">job.</span>
            </h1>

            <p className="text-lg sm:text-2xl text-[#888] max-w-2xl mb-8 sm:mb-12 leading-relaxed">
              Kaamlee aggregates every <span className="text-white font-bold">ambitious </span> role from twelve job boards into one map. No popups. No &quot;8 people are viewing this job&quot;.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                onClick={handleExploreClick}
                className="cursor-pointer bg-white text-black px-8 sm:px-10 py-4 sm:py-5 rounded-sm font-black uppercase tracking-widest text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-[#ededed] transition-all group"
              >
                Open the map <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              {/* <button
                onClick={() => setIsPricingOpen(true)}
                className="cursor-pointer border border-[#222] text-white px-8 sm:px-10 py-4 sm:py-5 rounded-sm font-black uppercase tracking-widest text-xs sm:text-sm flex items-center justify-center gap-2 hover:border-white transition-all"
              >
                Beta — ₹9/mo
              </button>
            </div>
          </motion.div>

          {/* Real Mapcn Globe Component */}
          <motion.div
            className="relative aspect-square lg:aspect-auto lg:h-[650px] border border-white/5 overflow-hidden bg-black/40 backdrop-blur-sm group"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <div className="absolute inset-0 z-0">
              <Mapcn
                center={[75, 20]}
                zoom={3}
                theme="dark"
                className="w-full h-full opacity-75"
                interactive={false}
                attributionControl={false}
              >
                {/* Scatter markers across the globe */}
                {[
                  { coords: [77.5946, 12.9716], tag: "Fullstack Developer" }, // Bangalore
                  { coords: [72.8777, 19.0760], tag: "Product Lead" }, // Mumbai
                  { coords: [77.2090, 28.6139], tag: "Backend Engineer" }, // Delhi
                  { coords: [78.4867, 17.3850], tag: "Data Scientist" }, // Hyderabad
                  { coords: [73.8567, 18.5204], tag: "DevOps Architect" }, // Pune
                  { coords: [80.2707, 13.0827], tag: "iOS Engineer" }, // Chennai
                  { coords: [88.3639, 22.5726], tag: "UX Researcher" }, // Kolkata
                  { coords: [72.5714, 23.0225], tag: "Growth Manager" }, // Ahmedabad
                  { coords: [77.0266, 28.4595], tag: "Security Analyst" }, // Gurgaon
                  { coords: [77.3910, 28.5355], tag: "Cloud Engineer" }, // Noida
                  { coords: [75.7873, 26.9124], tag: "Frontend Lead" }, // Jaipur
                  { coords: [76.7794, 30.7333], tag: "AI Researcher" }, // Chandigarh
                  // UAE Markers
                  { coords: [55.2708, 25.2048], tag: "Blockchain Dev" }, // Dubai
                  { coords: [54.3773, 24.4539], tag: "AI Engineer" }, // Abu Dhabi
                  { coords: [55.4121, 25.3463], tag: "System Architect" }, // Sharjah
                ].map((marker, i) => (
                  <MapMarker key={i} longitude={marker.coords[0]} latitude={marker.coords[1]}>
                    <MarkerContent>
                      <div className="relative group/marker">
                        <motion.div
                          className={`w-1.5 h-1.5 rounded-full ${i % 3 === 0 ? 'bg-white shadow-[0_0_8px_white]' : 'bg-blue-500 shadow-[0_0_8px_#3b82f6]'}`}
                          animate={{
                            opacity: [0.4, 1, 0.4],
                            scale: [1, 1.3, 1]
                          }}
                          transition={{
                            duration: 2 + Math.random() * 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: Math.random() * 2
                          }}
                        />
                        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded text-[8px] font-mono text-white/70 whitespace-nowrap opacity-0 group-hover/marker:opacity-100 transition-opacity pointer-events-none uppercase tracking-tighter">
                          {marker.tag}
                        </div>
                      </div>
                    </MarkerContent>
                  </MapMarker>
                ))}
              </Mapcn>
            </div>

            {/* Map UI Overlay (Preserved from design) */}
            <div className="absolute inset-0 p-8 flex flex-col justify-end z-10 pointer-events-none">

              <div className="flex items-end justify-between">
                <div className="flex gap-12 font-mono text-[14px] text-white/30">
                  <div className="flex flex-col gap-1">
                    <span className="uppercase tracking-widest">Lat</span>
                    <span className="text-white/60">-53.46</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="uppercase tracking-widest">Lon</span>
                    <span className="text-white/60">186.01</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Stats Section */}
        <section className="px-6 md:px-8 py-12 sm:py-16 border-y border-white/40 bg-black/20 backdrop-blur-sm relative overflow-hidden">
          <div className="mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12">
            {[
              { label: "LIVE_LISTINGS", value: stats?.total_jobs?.toLocaleString() || "40,000 +" },
              { label: "COMPANIES", value: "50,000 +" },
              { label: "SOURCES", value: "12 boards" },
              { label: "UPTIME", value: "98.99%" }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col gap-1 sm:gap-2">
                <div className="font-mono text-[8px] sm:text-[10px] font-bold text-[#444] tracking-widest uppercase">
                   // {stat.label}
                </div>
                <div className="text-2xl sm:text-4xl font-black tracking-tight">{stat.value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Job Cards Marquee/Grid */}
        <section className="py-18 px-6 md:px-8 mx-auto overflow-hidden">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px w-20 bg-blue-500" />
            <span className="font-mono text-xs text-blue-500 tracking-widest uppercase">// RECENTS.JSON</span>
          </div>

          {/* Horizontal Marquee */}
          <div className="relative flex overflow-hidden">
            <motion.div
              className="flex gap-4 sm:gap-6 whitespace-nowrap"
              animate={{ x: ["0%", "-50%"] }}
              transition={{
                duration: 60,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              {/* Double the array for seamless looping */}
              {(Array.isArray(recentJobs) ? [...recentJobs.slice(0, 10), ...recentJobs.slice(0, 10)] : []).map((job, i) => (
                <Link key={i} href="/explore" className="flex-shrink-0 w-[280px] sm:w-[350px] group p-6 sm:p-8 border border-white/5 bg-[#080808] hover:border-green-500/30 hover:bg-[#0a0a0a] transition-all relative overflow-hidden cursor-pointer block">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xl font-bold tracking-tight text-white mb-4 line-clamp-1 truncate">{job.title}</h4>
                  </div>

                  <div className="flex items-center justify-between mb-8">
                    <p className="font-mono text-[10px] text-[#444] uppercase tracking-widest">{timeAgo(job.date_posted)}</p>
                    <div className="flex items-center gap-4 text-[10px] text-[#444] font-mono tracking-widest uppercase">
                      <span>◇ {job.location_name.split(',')[0]}</span>
                      <span>⟡ {job.site}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end border-t border-white/10 border-dashed pt-6 mt-6">
                    <div className="font-mono text-[10px] text-[#444] uppercase tracking-widest">{job.is_remote ? 'REMOTE' : 'ON-SITE'}</div>
                  </div>
                </Link>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Sources Grid */}
        <section className="px-6 sm:px-8 py-16 sm:py-24 mx-auto border-t border-white/40">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-4 mb-6 sm:mb-8">
                <div className="h-px w-12 sm:w-20 bg-blue-500" />
                <span className="font-mono text-[10px] sm:text-xs text-blue-500 tracking-widest uppercase">// SOURCES.PY</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight uppercase max-w-xs">
                We pull from twelve job boards. These are the busy ones.
              </h2>
            </div>

            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-x-8 sm:gap-x-12 gap-y-8 sm:gap-y-12">
              {[
                { name: "LinkedIn", count: "184,392 live" },
                { name: "Indeed", count: "92,118 live" },
                { name: "Google", count: "61,540 live" },
                { name: "Wellfound", count: "21,008 live" },
                { name: "Zip Recruiter", count: "14,776 live" },
                { name: "YC", count: "3,201 live" }
              ].map((source, i) => (
                <div key={i} className="flex flex-col gap-1 sm:gap-2 group cursor-default">
                  <div className="text-xl sm:text-2xl font-bold tracking-tight text-white group-hover:text-blue-500 transition-colors">{source.name}</div>
                  <div className="font-mono text-[8px] sm:text-[10px] text-[#444] tracking-widest uppercase">{source.count}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* New Feature Spotlight: AI Match */}
        <section className="px-6 py-16 sm:py-20 border-t border-white/40 bg-[#050505] relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-video rounded-2xl border border-white/5 bg-black p-4 sm:p-8 flex flex-col justify-center gap-4 sm:gap-6 group shadow-2xl"
            >
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-red-500/20" />
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-yellow-500/20" />
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-green-500/20" />
              </div>

              <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10 group-hover:border-blue-500/30 transition-all">
                <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Briefcase className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="h-3 sm:h-4 w-20 sm:w-32 bg-white/10 rounded animate-pulse" />
                    <div className="px-1.5 sm:px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-[8px] sm:text-[10px] font-black text-blue-500 uppercase tracking-widest whitespace-nowrap">89.4% Match</div>
                  </div>
                  <div className="h-2 sm:h-3 w-32 sm:w-48 bg-white/5 rounded animate-pulse" />
                </div>
              </div>

              <div className="space-y-2 sm:space-y-3 opacity-50">
                <div className="h-1.5 sm:h-2 w-full bg-white/5 rounded" />
                <div className="h-1.5 sm:h-2 w-3/4 bg-white/5 rounded" />
              </div>

              <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 p-4 sm:p-6 rounded-2xl bg-blue-600 shadow-2xl shadow-blue-600/20 max-w-[150px] sm:max-w-[200px]">
                <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white/60 mb-1 sm:mb-2">AI Engine Active</p>
                <p className="text-[10px] sm:text-xs font-bold leading-relaxed text-white">Your resume was analyzed. We found 12 roles that match your DNA perfectly.</p>
              </div>
            </motion.div>

            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px w-12 sm:w-20 bg-blue-500" />
                <span className="font-mono text-[10px] sm:text-xs text-blue-500 tracking-widest uppercase">// RESUME_AI.MOD</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-6 sm:mb-8 leading-[1.1]">
                Stop guessing.<br />
                Start <span className="text-serif font-normal italic lowercase text-blue-500">matching.</span>
              </h2>
              <p className="text-lg sm:text-xl text-[#888] leading-relaxed mb-8 sm:mb-10">
                Upload your resume once. Our AI parses your experience and calculates a <span className="text-white font-bold">real time match percentage</span> for every single listing on the map.
              </p>
              <ul className="space-y-3 sm:space-y-4">
                {[
                  "Semantic keyword analysis",
                  "Job Title weighted matching",
                  "Automated experience extraction",
                  "Zero configuration setup"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-xs sm:text-sm font-mono text-[#555] uppercase tracking-widest">
                    <Zap className="text-blue-500 w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Section 02: How it Works */}
        <section className="px-6 md:px-8 py-20 border-t border-white/40 mx-auto">
          <div className="flex items-center justify-between flex-wrap mb-16 gap-2">
            <div className="flex items-center gap-4">
              <div className="h-px w-12 bg-blue-500" />
              <span className="font-mono text-xs text-blue-500 tracking-widest uppercase text-nowrap">// HOW_IT_WORKS.TS</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="font-mono text-[10px] text-[#444] tracking-widest uppercase">THREE STEPS · ABOUT NINETY SECONDS</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            {[
              {
                step: "01",
                title: "We crawl, <span class='text-serif font-normal italic lowercase'>so you sleep.</span>",
                desc: "Twelve job boards, polled every fifteen minutes. Listings are de-duped by hash, fingerprinted by company, and stamped the moment they go live.",
                code: `<span class="text-white/40">$</span> kaamlee crawl --all\n<span class="text-green-500">↳</span> linkedin <span class="text-green-500">[✓]</span> 184,392\n<span class="text-green-500">↳</span> indeed <span class="text-green-500">[✓]</span> 92,118\n<span class="text-green-500">↳</span> google <span class="text-green-500">[✓]</span> 61,540\n<span class="text-blue-500">↳</span> wellfound <span class="text-blue-500 animate-pulse">[·]</span> crawling...`
              },
              {
                step: "02",
                title: "Open the <span class='text-serif font-normal italic lowercase'>map.</span>",
                desc: "No infinite scroll, no fifteen filters. Pan, zoom, see roles plotted where they actually live. A search bar that doesn't talk back.",
                code: `<span class="text-white/40">//</span> Loading map clusters...\n<span class="text-green-500">✓</span> 1,240 nodes resolved in NYC\n<span class="text-green-500">✓</span> 890 nodes resolved in London\n<span class="text-green-500">✓</span> UI Ready.`
              },
              {
                step: "03",
                title: "Apply <span class='text-serif font-normal italic lowercase'>before noon.</span>",
                desc: "One click takes you to the source posting. We don't middleman the application — we just made the haystack smaller.",
                code: `APPLY <span class="text-white/40">→</span> STRIPE.COM <span class="text-green-500">200 OK</span>\n<span class="text-white/10">--------------------------------------</span>\n<span class="text-green-500">↳</span> resume.pdf          <span class="text-green-500">↳</span> cover_letter.md\n\n<span class="text-blue-500 font-bold">Confirmation in inbox.</span> Time elapsed: 11s`
              }
            ].map((item, i) => (
              <div key={i} className="flex flex-col gap-8">
                <div>
                  <div className="font-mono text-[10px] text-blue-500 font-bold uppercase tracking-widest mb-4">Step {item.step}</div>
                  <h3 className="text-4xl font-black tracking-tight leading-[1.1] mb-6" dangerouslySetInnerHTML={{ __html: item.title }} />
                  <p className="text-[#888] leading-relaxed text-sm mb-8">
                    {item.desc}
                  </p>
                </div>

                <div className="bg-[#050505] border border-white/5 p-6 rounded-sm font-mono text-[10px] leading-relaxed text-[#555] h-[180px] relative group">
                  <div className="flex gap-1.5 mb-4 opacity-30 group-hover:opacity-100 transition-opacity">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                  </div>
                  <pre className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: item.code }} />
                </div>
              </div>
            ))}
          </div>
        </section>


        {/* Section 04: FAQ */}
        <section id="faq" className="px-6 sm:px-8 mx-auto mb-24">
          <div className="flex items-center gap-4 mb-12">
            <div className="h-px w-12 sm:w-20 bg-blue-500" />
            <span className="font-mono text-[10px] sm:text-xs text-blue-500 tracking-widest uppercase">// FAQ.MD</span>
          </div>

          <div className="border-t border-white/10">
            {[
              {
                q: "Where do these jobs actually come from?",
                a: "We crawl twelve major job boards (LinkedIn, Indeed, ZipRecruiter, etc.) and direct company career pages every fifteen minutes. If it's live on the internet, it's on the map."
              },
              {
                q: "Is Kaamlee in beta? Will the price change later?",
                a: "Yes — we're in early beta. Right now, early access is priced at ₹9/mo so you can get in and give us feedback while the product is still being shaped. As we roll out premium features (advanced filters, alerts, Auto apply, and more), the price will update to reflect them. Early access users who join now lock in the beta rate for their current billing cycle."
              },
              {
                q: "How does the 'All-Access' pass work?",
                a: `One flat beta fee of ${PRICING.currency} ${PRICING.amount_inr}/${PRICING.interval}. No tiers, no 'pro' features locked behind a paywall right now. This is early-access pricing — future plans will be priced higher as premium features launch. Payments are securely powered by Razorpay and handled by Commhawk.`
              },
              {
                q: "Can I cancel my subscription easily?",
                a: "Yes. One click in your dashboard. No 'call us to cancel' loops. No hidden retention tricks. We're here to help you get a job, not hold you hostage."
              },
              {
                q: "How does the AI Resume Matching work?",
                a: "Once you upload your resume in your profile, our AI engine parses your technical skills, experience, and career history. It then performs a real-time semantic comparison against every job listing to give you a personalized match percentage, helping you prioritize the roles you're most likely to land."
              },
              {
                q: "How fresh is the data on the map?",
                a: "Our crawlers operate on a 15-minute refresh cycle. When a job is taken down or filled, it's purged from our system within the hour to ensure you're never applying to ghost listings."
              },
              {
                q: "Can I use Kaamlee on my phone?",
                a: "Yes. The platform is fully responsive and optimized for mobile browsers. You can scout the map while you're on the go, with all data synced to your desktop account."
              }
            ].map((faq, i) => (
              <FAQItem
                key={i}
                faq={faq}
                index={i}
                isOpen={openFaqIndex === i}
                onToggle={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
              />
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="p-8 border-t border-white/40 bg-black relative">
          <div className="mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-16">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold tracking-[0.3em] uppercase">KAAMLEE</span>
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-blue-500/40 text-blue-400 bg-blue-500/10">Beta</span>
              </div>
              <p className="text-[#444] text-[10px] font-mono tracking-widest uppercase">
                © 2026 KAAMLEE <br />
                PAYMENTS BY RAZORPAY · HANDLED BY COMMHAWK
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 text-right self-end sm:self-auto">
              <div className="flex items-center gap-4 mb-2">
                <Link
                  href="/terms"
                  className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#444] hover:text-white transition-colors"
                >
                  Terms
                </Link>
                <span className="text-[#333]">·</span>
                <Link
                  href="/privacy"
                  className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#444] hover:text-white transition-colors"
                >
                  Privacy
                </Link>
              </div>
              <a
                href="https://commhawk.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#444] hover:text-white transition-colors flex items-center gap-2 group"
              >
                with love <span className="text-white underline underline-offset-4">commhawk</span>
              </a>
              {/* <button
                onClick={() => setIsTeamModalOpen(true)}
                className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#444] hover:text-blue-500 transition-colors cursor-pointer group text-right"
              >
                developed by <span className="text-blue-500 font-bold tracking-tighter group-hover:underline underline-offset-4">smtech</span>
              </button> */}
            </div>
          </div>
        </footer>
      </div>

      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />

      <AnimatePresence>
        {isTeamModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTeamModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={() => setIsTeamModalOpen(false)}
                  className="cursor-pointer p-2 hover:bg-white/5 rounded-full text-[#444] hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 sm:p-12">
                <div className="my-8 text-center">
                  <div className="font-mono text-[10px] text-blue-500 tracking-[0.3em] uppercase mb-3">// THE_ENGINEERS</div>
                  <div className="h-px w-20 bg-blue-500 mx-auto mt-4" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    { name: 'Satya', linkedin: 'https://www.linkedin.com/in/satyakant-mishra-958847203/' },
                    { name: 'Mayank', linkedin: 'https://www.linkedin.com/in/pruthimayank/' },
                    { name: 'Rajat', linkedin: 'https://www.linkedin.com/in/rajat-kumar-dabas/' }
                  ].map((member, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="group p-6 text-center"
                    >
                      <div className="text-lg font-bold text-white mb-1">{member.name}</div>
                      <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono uppercase tracking-widest text-[#444] cursor-pointer hover:text-blue-500 hover:underline transition-all">linkedin</a>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-12 pt-8 border-t border-white/5 text-center">
                  <p className="text-xs text-[#444] leading-relaxed max-w-sm mx-auto">
                    Wasn't that a lot of work?
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital@1&display=swap');
        
        .text-serif {
          font-family: 'Playfair Display', serif;
        }
      `}</style>
    </main>
  );
}
