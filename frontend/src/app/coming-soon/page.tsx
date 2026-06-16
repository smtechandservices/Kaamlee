'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap } from 'lucide-react';
import Link from 'next/link';

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen bg-black text-white font-sans overflow-hidden flex flex-col">
      <div className="fixed inset-0 bg-grid opacity-20 pointer-events-none z-0" />
      <div className="fixed top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent z-50" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full h-20 px-6 sm:px-8 flex items-center justify-between z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="text-lg sm:text-xl font-bold tracking-[0.2em] sm:tracking-[0.3em] uppercase">KAAMLEE</span>
          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-blue-500/40 text-blue-400 bg-blue-500/10">Beta</span>
        </div>
        <Link href="/" className="flex items-center gap-2 text-[#555] hover:text-white transition-colors group text-xs font-bold uppercase tracking-widest">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Back
        </Link>
      </nav>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-xl w-full text-center"
        >
          <div className="inline-flex items-center gap-2 bg-[#111] border border-[#222] px-4 py-1.5 rounded-full mb-10">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black tracking-widest uppercase text-[#888]">
              Currently in <span className="text-white">Beta</span>
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05] mb-8">
            Coming<br />
            <span className="text-serif font-normal italic text-blue-500">soon.</span>
          </h1>

          <p className="text-[#555] text-sm sm:text-base leading-relaxed mb-12 max-w-xl mx-auto">
            We&apos;re heads-down building this. <br /> Check back shortly it won&apos;t be long.
          </p>

          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 text-[10px] font-mono text-[#333] uppercase tracking-widest">
              <Zap size={10} className="text-blue-500/50" />
              No pricing for now · Premium features coming later
              <Zap size={10} className="text-blue-500/50" />
            </div>

            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-2 border border-[#222] text-[#555] hover:text-white hover:border-white/30 px-6 py-3 rounded-sm text-xs font-black uppercase tracking-widest transition-all"
            >
              <ArrowLeft size={12} />
              Back to home
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Footer line */}
      <div className="relative z-10 p-6 text-center">
        <p className="font-mono text-[#333] text-[10px] uppercase tracking-widest">
          © 2026 KAAMLEE · FREE DURING BETA
        </p>
      </div>

      <style jsx>{`
        .text-serif {
          font-family: 'Playfair Display', serif;
        }
      `}</style>
    </main>
  );
}
