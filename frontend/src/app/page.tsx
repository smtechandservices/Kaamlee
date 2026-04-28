'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Search, Zap, Globe, Shield, LogOut, Briefcase, MapPin, Building2, Plus, Minus, RotateCcw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import MapComponent from '@/components/Map';
import { Map as Mapcn, MapMarker, MarkerContent } from "@/components/ui/map";

function FAQItem({ faq, index }: { faq: { q: string, a: string }, index: number }) {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <div className="border-b border-white/5">
      <div 
        onClick={() => setIsOpen(!isOpen)}
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
            <div className="pb-10 pl-24 max-w-2xl text-[#888] leading-relaxed">
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
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/recent-jobs/')
      .then(res => res.json())
      .then(data => setRecentJobs(data))
      .catch(err => console.error("Error fetching recent jobs:", err));

    fetch('http://127.0.0.1:8000/api/stats/')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error("Error fetching stats:", err));
  }, []);

  return (
    <main className="min-h-screen bg-black text-white selection:bg-blue-500 selection:text-white font-sans overflow-x-hidden">
      {/* Grid Background Layer */}
      <div className="fixed inset-0 bg-grid opacity-20 pointer-events-none z-0" />

      {/* Top Border Gradient */}
      <div className="fixed top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent z-50" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full h-20 px-8 flex items-center justify-between z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="cursor-default text-xl font-bold tracking-[0.3em] uppercase">
          KAAMLEE
        </div>

        <div className="flex items-center gap-8">
          {!user ? (
            <Link href="/login" className="text-sm font-medium text-[#888] hover:text-white transition-colors">
              Log in
            </Link>
          ) : (
            <button onClick={logout} className="text-sm font-medium text-[#888] hover:text-white transition-colors">
              Logout
            </button>
          )}
          <Link
            href="/explore"
            className="bg-white text-black px-6 py-2.5 rounded-sm text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#ededed] transition-all"
          >
            Open the map <ArrowRight size={14} />
          </Link>
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
              <Link
                href="/explore"
                className="bg-white text-black px-10 py-5 rounded-sm font-black uppercase tracking-widest text-sm flex items-center gap-2 hover:bg-[#ededed] transition-all group"
              >
                Open the map <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="#pricing"
                className="border border-[#222] text-white px-10 py-5 rounded-sm font-black uppercase tracking-widest text-sm hover:border-white transition-all"
              >
                See Pricing
              </Link>
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
            <div className="absolute inset-0 p-8 flex flex-col justify-between z-10 pointer-events-none">
              <div className="flex items-center justify-end">
                <div className="flex flex-col gap-2 pointer-events-auto">
                  {[Plus, Minus, RotateCcw].map((Icon, i) => (
                    <button key={i} className="w-8 h-8 rounded-sm bg-black border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors">
                      <Icon size={14} className="text-white/60" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div className="flex gap-12 font-mono text-[10px] text-white/30">
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
        <section className="px-12 py-16 border-y border-white/5 bg-black/20 backdrop-blur-sm relative overflow-hidden">
          <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { label: "LIVE_LISTINGS", value: stats?.total_jobs.toLocaleString() || "420" },
              { label: "COMPANIES", value: "500 +" },
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
                  <div className="flex items-center justify-between mb-8">
                    <div className="w-10 h-10 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center font-black text-xs">
                      {job.company[0]}
                    </div>
                    <span className="font-mono text-[10px] text-[#444] uppercase tracking-widest">14h ago</span>
                  </div>

                  <div className="mb-8">
                    <div className="font-mono text-[10px] text-blue-500 uppercase tracking-widest font-bold mb-2 tracking-[0.2em]">{job.company}</div>
                    <h4 className="text-xl font-bold tracking-tight text-white mb-4 line-clamp-1 truncate">{job.title}</h4>
                    <div className="flex items-center gap-4 text-[10px] text-[#444] font-mono tracking-widest uppercase">
                      <span>⟡ {job.site}</span>
                      <span>◇ {job.location_name.split(',')[0]}</span>
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
        <section className="px-12 py-24 mx-auto border-t border-white/5">
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

        {/* Section 02: How it Works */}
        <section className="px-12 py-32 border-t border-white/5 mx-auto">
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

        {/* Section 03: Pricing Banner */}
        <section id="pricing" className="px-8 mx-auto mb-40 relative">
          <div className="mx-auto border border-blue-500/20 bg-[#050505] rounded-sm p-12 relative overflow-hidden group">

            <div className="relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-center mb-16">
                {/* Image Section - Now larger */}
                <div className="lg:col-span-7 relative h-[500px]">
                  <img
                    src="/image.png"
                    alt="job"
                    className="w-full h-full object-cover rounded-sm grayscale-50"
                  />
                  <div className="absolute -bottom-6 left-0 font-mono text-[8px] text-blue-500 uppercase tracking-[0.5em]">System_Interface.img</div>
                </div>

                {/* Content Section - Now more compact on the right */}
                <div className="lg:col-span-5 flex flex-col gap-8">
                  <div>
                    <div className="inline-flex items-center gap-3 bg-blue-500/5 border border-blue-500/20 px-3 py-1 rounded-full mb-6">
                      <div className="w-1 h-1 rounded-full bg-blue-500 animate-ping" />
                      <span className="font-mono text-[9px] text-blue-400 font-bold tracking-[0.2em] uppercase">Status: Available</span>
                    </div>

                    <h2 className="text-5xl md:text-6xl font-black tracking-tighter mb-6">
                      One Price.<br />
                      One Portal.<br />
                      <span className="text-serif font-normal italic lowercase text-blue-500">unlimited</span> Jobs.
                    </h2>

                    <div className="flex items-baseline gap-3 mb-4">
                      <span className="text-3xl font-mono text-blue-500/50">$</span>
                      <span className="text-8xl font-black tracking-tighter text-white">4.99</span>
                      <span className="font-mono text-xl text-[#444] uppercase tracking-widest">/ mo</span>
                    </div>

                    <p className="text-sm text-[#888] leading-relaxed max-w-xs">
                      Stop overthinking it. Get every role, and every map filter for the price of a coffee. <span className="text-white font-bold italic">We just do jobs.</span>
                    </p>
                  </div>

                  <div className="relative group/btn">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-blue-400 rounded-sm blur opacity-25 group-hover/btn:opacity-50 transition duration-1000 group-hover/btn:duration-200" />
                    <Link
                      href="/explore"
                      className="relative w-full flex items-center justify-center gap-4 bg-white text-black px-12 py-4 rounded-sm font-black uppercase tracking-[0.3em] text-sm hover:bg-[#ededed] transition-all overflow-hidden"
                    >
                      <span>Initialize All-Access Now</span>
                      <ArrowRight size={20} className="group-hover/btn:translate-x-2 transition-transform" />

                      {/* Subtle scanline on button */}
                      <div className="absolute inset-0 w-full h-[2px] bg-black/5 top-0 group-hover/btn:top-full transition-all duration-700 pointer-events-none" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-12 flex flex-wrap justify-end items-center gap-8 border-t border-white/5 pt-12">
                <div className="font-mono text-[9px] text-[#333] uppercase tracking-widest">
                  Secure Checkout · Stripe Encryption · 256-bit SSL
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 04: FAQ */}
        <section id="faq" className="px-8 mx-auto mb-40">
          <div className="flex items-center gap-4 mb-20">
            <span className="font-mono text-xs text-blue-500 font-bold">03</span>
            <div className="h-px w-20 bg-blue-500" />
            <span className="font-mono text-xs text-blue-500 tracking-widest uppercase">// FAQ.MD</span>
          </div>

          <div className="border-t border-white/5">
            {[
              {
                q: "Where do these jobs actually come from?",
                a: "We crawl twelve major job boards (LinkedIn, Indeed, ZipRecruiter, etc.) and direct company career pages every fifteen minutes. If it's live on the internet, it's on the map."
              },
              {
                q: "How does the 'All-Access' pass work?",
                a: "One flat fee of $4.99/mo. No tiers, no 'pro' features locked behind higher paywalls. You get the map, the alerts, the salary insights, and the AI application toolkit in one shot."
              },
              {
                q: "Can I cancel my subscription easily?",
                a: "Yes. One click in your dashboard. No 'call us to cancel' loops. No hidden retention tricks. We're here to help you get a job, not hold you hostage."
              }
            ].map((faq, i) => (
              <FAQItem key={i} faq={faq} index={i} />
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="px-12 py-24 border-t border-white/5 bg-black relative">
          <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-start gap-16">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-blue-600 rounded-sm" />
                <div className="text-lg font-bold tracking-[0.3em] uppercase">KAAMLEE</div>
              </div>
              <p className="text-[#444] text-[10px] font-mono tracking-widest uppercase">
                © 2026 KAAMLEE INC. <br />
                DESIGNED FOR THE AMBITIOUS.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-24 gap-y-8">
              {['Product', 'Company', 'Legal'].map((group, i) => (
                <div key={i} className="flex flex-col gap-4">
                  <div className="font-mono text-[10px] text-[#444] font-bold tracking-widest uppercase mb-4">{group}</div>
                  {['About', 'Privacy', 'Terms', 'Support'].map((link, j) => (
                    <Link key={j} href="#" className="text-xs text-[#888] hover:text-white transition-colors">{link}</Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital@1&display=swap');
        
        .text-serif {
          font-family: 'Playfair Display', serif;
        }
      `}</style>
    </main>
  );
}
