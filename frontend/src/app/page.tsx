'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Search, Zap, Globe, Shield, LogOut, Briefcase, MapPin, Building2, Plus, Minus, RotateCcw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import MapComponent from '@/components/Map';
import { Map as Mapcn, MapMarker, MarkerContent } from "@/components/ui/map";
import PricingModal from '@/components/PricingModal';

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
            <div className="pb-10 pl-24 max-w-5xl text-[#888] leading-relaxed">
              {faq.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LandingPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isPricingOpen, setIsPricingOpen] = useState(false);

  const handleExploreClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
    } else if (!user.is_subscribed) {
      setIsPricingOpen(true);
    } else {
      router.push('/explore');
    }
  };

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/recent-jobs/`)
      .then(res => res.json())
      .then(data => setRecentJobs(data))
      .catch(err => console.error("Error fetching recent jobs:", err));

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stats/`)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error("Error fetching stats:", err));
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
      <nav className="fixed top-0 left-0 w-full h-20 px-8 flex items-center justify-between z-50 border-b border-white/40 bg-black/50 backdrop-blur-xl">
        <div className="cursor-default text-xl font-bold tracking-[0.3em] uppercase">
          KAAMLEE
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleExploreClick}
            className="cursor-pointer bg-white text-black px-6 py-2.5 rounded-sm text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#ededed] transition-all"
          >
            Find Jobs <ArrowRight size={14} />
          </button>
          {!user ? (
            <Link href="/login" className="cursor-pointer text-sm font-medium text-[#888] hover:text-white transition-colors">
              Log in
            </Link>
          ) : (
            <div className="flex items-center gap-4">
              <Link 
                href="/profile"
                className="hidden sm:flex items-center gap-3 px-2 py-2 bg-white/5 border border-white/10 rounded-full hover:border-white/20 transition-all group"
              >
                 <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold shadow-lg shadow-blue-500/10 group-hover:scale-110 transition-transform">
                   {user?.first_name?.[0]}{user?.last_name?.[0]}
                 </div>
                 <span className="text-xs font-medium text-[#888] group-hover:text-white transition-colors">{user?.first_name} {user?.last_name}</span>
              </Link>
              <div onClick={logout} className='flex items-center gap-2 group cursor-pointer hover:text-white transition-colors'>
                <LogOut size={18}/>
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="relative z-10 pt-20">
        {/* Section 01: Hero */}
        <section className="px-8 md:px-0 ps-0 md:ps-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center gap-4 mb-8">
              <span className="font-mono text-xs text-blue-500 font-bold">01</span>
              <div className="h-px w-20 bg-blue-500" />
              <span className="font-mono text-xs text-blue-500 tracking-widest uppercase">// THE_PITCH.MD</span>
            </div>

            <div className="inline-flex items-center gap-3 bg-[#111] border border-[#222] px-4 py-1.5 rounded-full mb-10">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-md font-black tracking-widest uppercase text-[#888]">
                <span className='text-lg'>{stats?.jobs_last_3_days.toLocaleString() || '420'}</span> NEW ROLES IN LAST 72H
              </span>
            </div>

            <h1 className="text-6xl md:text-7xl font-black tracking-tight leading-[1.1] mb-10">
              Job Applying.<br />
              is a <span className="text-serif font-normal italic">job.</span>
            </h1>

            <p className="text-2xl text-[#888] max-w-2xl mb-12 leading-relaxed">
              Kaamlee aggregates every <span className="text-white font-bold">ambitious </span> role from twelve job boards into one map. No popups. No &quot;8 people are viewing this job&quot;.
            </p>

            <div className="flex items-center gap-4">
              <button
                onClick={handleExploreClick}
                className="cursor-pointer bg-white text-black px-10 py-5 rounded-sm font-black uppercase tracking-widest text-sm flex items-center gap-2 hover:bg-[#ededed] transition-all group"
              >
                Open the map <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => setIsPricingOpen(true)}
                className="cursor-pointer border border-[#222] text-white px-10 py-5 rounded-sm font-black uppercase tracking-widest text-sm hover:border-white transition-all"
              >
                See Pricing
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
        <section className="px-12 py-16 border-y border-white/40 bg-black/20 backdrop-blur-sm relative overflow-hidden">
          <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { label: "LIVE_LISTINGS", value: stats?.total_jobs.toLocaleString() || "420" },
              { label: "COMPANIES", value: "1000 +" },
              { label: "SOURCES", value: "12 boards" },
              { label: "UPTIME", value: "98.99%" }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="font-mono text-[10px] font-bold text-[#444] tracking-widest uppercase">
                   // {stat.label}
                </div>
                <div className="text-4xl font-black tracking-tight">{stat.value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Job Cards Marquee/Grid */}
        <section className="py-24 px-12 mx-auto overflow-hidden">
          <div className="flex items-center gap-4 mb-16">
            <div className="h-px w-20 bg-blue-500" />
            <span className="font-mono text-xs text-blue-500 tracking-widest uppercase">// RECENTS.JSON</span>
          </div>

          {/* Horizontal Marquee */}
          <div className="relative flex overflow-hidden">
            <motion.div
              className="flex gap-6 whitespace-nowrap"
              animate={{ x: ["0%", "-50%"] }}
              transition={{
                duration: 60,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              {/* Double the array for seamless looping */}
              {[...recentJobs.slice(0, 10), ...recentJobs.slice(0, 10)].map((job, i) => (
                <div key={i} className="flex-shrink-0 w-[350px] group p-8 border border-white/5 bg-[#080808] hover:border-blue-500/30 hover:bg-[#0a0a0a] transition-all relative overflow-hidden">
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
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Sources Grid */}
        <section className="px-12 py-24 mx-auto border-t border-white/40">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px w-20 bg-blue-500" />
                <span className="font-mono text-xs text-blue-500 tracking-widest uppercase">// SOURCES.PY</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight leading-tight uppercase max-w-xs">
                We pull from twelve job boards. These are the busy ones.
              </h2>
            </div>

            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-x-12 gap-y-12">
              {[
                { name: "LinkedIn", count: "184,392 live" },
                { name: "Indeed", count: "92,118 live" },
                { name: "Google", count: "61,540 live" },
                { name: "Wellfound", count: "21,008 live" },
                { name: "Zip Recruiter", count: "14,776 live" },
                { name: "YC", count: "3,201 live" }
              ].map((source, i) => (
                <div key={i} className="flex flex-col gap-2 group cursor-default">
                  <div className="text-2xl font-bold tracking-tight text-white group-hover:text-blue-500 transition-colors">{source.name}</div>
                  <div className="font-mono text-[10px] text-[#444] tracking-widest uppercase">{source.count}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* New Feature Spotlight: AI Match */}
        <section className="px-12 py-20 border-t border-white/40 bg-[#050505] relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-video rounded-2xl border border-white/5 bg-black p-8 flex flex-col justify-center gap-6 group shadow-2xl"
            >
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500/20" />
                <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
                <div className="w-2 h-2 rounded-full bg-green-500/20" />
              </div>
              
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 group-hover:border-blue-500/30 transition-all">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Briefcase className="text-blue-500" size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                    <div className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-[10px] font-black text-blue-500 uppercase tracking-widest">89.4% Match</div>
                  </div>
                  <div className="h-3 w-48 bg-white/5 rounded animate-pulse" />
                </div>
              </div>

              <div className="space-y-3 opacity-50">
                <div className="h-2 w-full bg-white/5 rounded" />
                <div className="h-2 w-3/4 bg-white/5 rounded" />
              </div>

              <div className="absolute -bottom-6 -right-6 p-6 rounded-2xl bg-blue-600 shadow-2xl shadow-blue-600/20 max-w-[200px]">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">AI Engine Active</p>
                <p className="text-xs font-bold leading-relaxed text-white">Your resume was analyzed. We found 12 roles that match your DNA perfectly.</p>
              </div>
            </motion.div>

            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px w-20 bg-blue-500" />
                <span className="font-mono text-xs text-blue-500 tracking-widest uppercase">// RESUME_AI.MOD</span>
              </div>
              <h2 className="text-5xl font-black tracking-tight mb-8 leading-[1.1]">
                Stop guessing.<br />
                Start <span className="text-serif font-normal italic lowercase text-blue-500">matching.</span>
              </h2>
              <p className="text-xl text-[#888] leading-relaxed mb-10">
                Upload your resume once. Our AI parses your experience and calculates a <span className="text-white font-bold">real time match percentage</span> for every single listing on the map.
              </p>
              <ul className="space-y-4">
                {[
                  "Semantic keyword analysis",
                  "Job Title weighted matching",
                  "Automated experience extraction",
                  "Zero configuration setup"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-mono text-[#555] uppercase tracking-widest">
                    <Zap size={14} className="text-blue-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Section 02: How it Works */}
        <section className="px-12 py-32 border-t border-white/40 mx-auto">
          <div className="flex items-center justify-between mb-20">
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs text-blue-500 font-bold">02</span>
              <div className="h-px w-20 bg-blue-500" />
              <span className="font-mono text-xs text-blue-500 tracking-widest uppercase">// HOW_IT_WORKS.TS</span>
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
        <section id="faq" className="px-12 mx-auto mb-24">
          <div className="flex items-center gap-4 mb-20">
            <span className="font-mono text-xs text-blue-500 font-bold">03</span>
            <div className="h-px w-20 bg-blue-500" />
            <span className="font-mono text-xs text-blue-500 tracking-widest uppercase">// FAQ.MD</span>
          </div>

          <div className="border-t border-white/10">
            {[
              {
                q: "Where do these jobs actually come from?",
                a: "We crawl twelve major job boards (LinkedIn, Indeed, ZipRecruiter, etc.) and direct company career pages every fifteen minutes. If it's live on the internet, it's on the map."
              },
              {
                q: "How does the 'All-Access' pass work?",
                a: "One flat fee of $2.99/mo. No tiers, no 'pro' features locked behind higher paywalls. You get the map and the jobs."
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
        <footer className="px-12 py-24 border-t border-white/40 bg-black relative">
          <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-start gap-16">
            <div className="flex flex-col gap-6">
              <div className="text-lg font-bold tracking-[0.3em] uppercase">KAAMLEE</div>
              <p className="text-[#444] text-[10px] font-mono tracking-widest uppercase">
                © 2026 KAAMLEE <br />
                DESIGNED FOR THE AMBITIOUS
              </p>
            </div>

            {/* <div className="grid grid-cols-2 md:grid-cols-3 gap-x-24 gap-y-8">
              {['Product', 'Company', 'Legal'].map((group, i) => (
                <div key={i} className="flex flex-col gap-4">
                  <div className="font-mono text-[10px] text-[#444] font-bold tracking-widest uppercase mb-4">{group}</div>
                  {['About', 'Privacy', 'Terms', 'Support'].map((link, j) => (
                    <Link key={j} href="#" className="text-xs text-[#888] hover:text-white transition-colors">{link}</Link>
                  ))}
                </div>
              ))}
            </div> */}
          </div>
        </footer>
      </div>
      
      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital@1&display=swap');
        
        .text-serif {
          font-family: 'Playfair Display', serif;
        }
      `}</style>
    </main>
  );
}
