'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-6 sm:p-12 relative overflow-hidden" style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#16a34a]/[0.06] blur-[120px] rounded-full pointer-events-none" />

      <Link href="/" className="absolute top-6 left-6 sm:top-8 sm:left-8 text-black/45 hover:text-[#0b0b0c] transition-colors flex items-center gap-2 text-xs sm:text-sm font-medium z-20" style={{ fontFamily: 'var(--font-outfit)' }}>
        <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Back to Home</span>
        <span className="sm:hidden">Back</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto mt-16 sm:mt-20 z-10 relative bg-white border border-black/[0.08] rounded-[34px] p-8 sm:p-12 shadow-[0_30px_80px_-30px_rgba(16,18,26,.25)]"
      >
        <h1 className="text-3xl sm:text-4xl tracking-[-0.03em] text-[#0b0b0c] mb-2" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>Privacy Policy</h1>
        <p className="text-sm text-black/45 mb-8" style={{ fontFamily: 'var(--font-outfit)' }}>Last updated: 23 June 2026</p>

        <div className="space-y-8 text-[rgba(61,61,61,0.85)] leading-relaxed">
          <p>
            Kaamlee (&quot;Platform&quot;) respects your privacy and is committed to protecting your personal information.
          </p>
          <p>
            This Privacy Policy explains how CommHawk Technologies Private Limited collects, uses, stores, and protects information provided by users.
          </p>

          <section>
            <h2 className="text-xl tracking-[-0.02em] text-[#0b0b0c] mb-4" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>1. Information We Collect</h2>

            <h3 className="text-lg tracking-[-0.01em] text-[#3d3d3d] mt-4 mb-2" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>Information You Provide</h3>
            <p>We may collect:</p>
            <ul className="list-disc pl-6 mt-2 mb-4 space-y-1 text-[rgba(61,61,61,0.72)]">
              <li>Full name</li>
              <li>Email address</li>
              <li>Mobile number</li>
              <li>Location</li>
              <li>Resume/CV</li>
              <li>Educational qualifications</li>
              <li>Employment history</li>
              <li>Skills and professional information</li>
              <li>Employer company information</li>
            </ul>

            <h3 className="text-lg tracking-[-0.01em] text-[#3d3d3d] mt-6 mb-2" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>Information Automatically Collected</h3>
            <p>We may collect:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-[rgba(61,61,61,0.72)]">
              <li>IP address</li>
              <li>Browser type</li>
              <li>Device information</li>
              <li>Operating system</li>
              <li>Usage activity on the Platform</li>
              <li>Cookies and analytics data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl tracking-[-0.02em] text-[#0b0b0c] mb-4" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-[rgba(61,61,61,0.72)]">
              <li>Create and manage user accounts.</li>
              <li>Facilitate job applications and recruitment.</li>
            </ul>
          </section>
        </div>
      </motion.div>
    </main>
  );
}
