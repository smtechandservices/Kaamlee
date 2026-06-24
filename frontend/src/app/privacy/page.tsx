'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-6 sm:p-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      <Link href="/" className="absolute top-6 left-6 sm:top-8 sm:left-8 text-[#888] hover:text-white transition-colors flex items-center gap-2 text-xs sm:text-sm font-medium z-20">
        <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Back to Home</span>
        <span className="sm:hidden">Back</span>
      </Link>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto mt-16 sm:mt-20 z-10 relative bg-[#111] border border-[#222] rounded-3xl p-8 sm:p-12 shadow-2xl"
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-green-500 mb-2">PRIVACY POLICY</h1>
        <p className="text-sm text-[#888] mb-8 font-mono">Last Updated: 23 June 2026</p>

        <div className="space-y-8 text-[#ccc] leading-relaxed">
          <p>
            Kaamlee ("Platform") respects your privacy and is committed to protecting your personal information.
          </p>
          <p>
            This Privacy Policy explains how CommHawk Technologies Private Limited collects, uses, stores, and protects information provided by users.
          </p>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. Information We Collect</h2>
            
            <h3 className="text-lg font-semibold text-[#ddd] mt-4 mb-2">Information You Provide</h3>
            <p>We may collect:</p>
            <ul className="list-disc pl-6 mt-2 mb-4 space-y-1 text-[#aaa]">
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

            <h3 className="text-lg font-semibold text-[#ddd] mt-6 mb-2">Information Automatically Collected</h3>
            <p>We may collect:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-[#aaa]">
              <li>IP address</li>
              <li>Browser type</li>
              <li>Device information</li>
              <li>Operating system</li>
              <li>Usage activity on the Platform</li>
              <li>Cookies and analytics data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-[#aaa]">
              <li>Create and manage user accounts.</li>
              <li>Facilitate job applications and recruitment.</li>
            </ul>
          </section>
        </div>
      </motion.div>
    </main>
  );
}
