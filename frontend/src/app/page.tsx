'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Search, Zap, Globe, Shield } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Navbar */}
      <nav className="h-20 px-8 flex items-center justify-between relative z-10 max-w-7xl mx-auto w-full">
        <div className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">KAAMLEE</div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#888]">
          <Link href="/resume" className="hover:text-white transition-colors">ATS Checker</Link>
          <Link href="/contact-hr" className="hover:text-white transition-colors">Contact HR</Link>
        </div>
        <div className="flex gap-4 items-center">
          <Link
            href="/login"
            className="bg-[#111] text-white px-5 py-2 border border-white/20 rounded-full text-sm font-semibold hover:bg-[#222] transition-all"
          >
            Sign In
          </Link>
          <Link
            href="/explore"
            className="bg-white text-black px-5 py-2 rounded-full text-sm font-semibold hover:bg-[#ededed] transition-all"
          >
            Explore Jobs
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-8 relative z-10 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 bg-[#161616] border border-[#222] px-3 py-1 rounded-full text-xs font-medium text-[#888] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Aggregating 50,000+ jobs dynamically
          </div>

          <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
            Find your next <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              ambitious role.
            </span>
          </h1>

          <p className="text-lg text-[#888] mb-12 max-w-2xl mx-auto leading-relaxed">
            Kaamlee aggregates the best roles from LinkedIn, Indeed, Glassdoor, and more.
            No more jumping between tabs. Just one clean, map-based interface.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <Link
              href="/explore"
              className="bg-emerald-500 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-400 transition-all flex items-center gap-2 group shadow-lg shadow-emerald-500/20"
            >
              Start Exploring
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <button className="text-[#888] hover:text-white transition-colors font-medium flex items-center gap-2 px-6 py-4">
              How it works
            </button>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-8 max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: <Zap className="text-emerald-500" />, title: "Instant Aggregation", desc: "Real-time updates from over 10 different job boards simultaneously." },
            { icon: <Globe className="text-cyan-500" />, title: "Map-Based Search", desc: "Visualize your future commute or find remote roles across the globe." },
            { icon: <Shield className="text-purple-500" />, title: "ATS Score Checks", desc: "Our AI-powered filters instantly evaluate your resume against live job descriptions." }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="p-8 rounded-3xl bg-[#111] border border-[#222] hover:border-[#333] transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-[#666] leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
}
