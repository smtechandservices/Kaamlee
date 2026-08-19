'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TermsPage() {
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
        <h1 className="text-3xl sm:text-4xl tracking-[-0.03em] text-[#0b0b0c] mb-2" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>Terms &amp; Conditions</h1>
        <p className="text-sm text-black/45 mb-8" style={{ fontFamily: 'var(--font-outfit)' }}>Last updated: 23 June 2026</p>

        <div className="space-y-8 text-[rgba(61,61,61,0.85)] leading-relaxed">
          <p>
            Welcome to Kaamlee (&quot;Platform&quot;), operated by CommHawk Technologies Private Limited (&quot;Company&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). By accessing or using Kaamlee, you agree to be bound by these Terms &amp; Conditions.
          </p>

          <section>
            <h2 className="text-xl tracking-[-0.02em] text-[#0b0b0c] mb-4" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>1. About Kaamlee</h2>
            <p>Kaamlee is an online platform that helps connect job seekers with employers by providing job listings, application tools, and recruitment-related services.</p>
          </section>

          <section>
            <h2 className="text-xl tracking-[-0.02em] text-[#0b0b0c] mb-4" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>2. Beta Version Disclaimer</h2>
            <p>Kaamlee is currently operating in a Beta phase. Certain features may be incomplete, unavailable, modified, or removed without prior notice. We do not guarantee uninterrupted or error-free operation of the Platform during this period.</p>
          </section>

          <section>
            <h2 className="text-xl tracking-[-0.02em] text-[#0b0b0c] mb-4" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>3. Eligibility</h2>
            <p>To use Kaamlee, you must:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-[rgba(61,61,61,0.72)]">
              <li>Be at least 18 years of age.</li>
              <li>Provide accurate and complete information during registration.</li>
              <li>Use the Platform only for lawful purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl tracking-[-0.02em] text-[#0b0b0c] mb-4" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>4. User Accounts</h2>
            <p>Users are responsible for:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-[rgba(61,61,61,0.72)]">
              <li>Maintaining the confidentiality of their login credentials.</li>
              <li>All activities performed through their account.</li>
              <li>Immediately notifying us of any unauthorized use of their account.</li>
            </ul>
            <p className="mt-4">We reserve the right to suspend or terminate accounts that violate these Terms.</p>
          </section>

          <section>
            <h2 className="text-xl tracking-[-0.02em] text-[#0b0b0c] mb-4" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>5. Job Listings and Applications</h2>
            <p>Kaamlee serves only as a facilitator between employers and job seekers.</p>
            <p className="mt-2">Kaamlee does not:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-[rgba(61,61,61,0.72)]">
              <li>Guarantee employment opportunities.</li>
              <li>Guarantee interviews or job offers.</li>
              <li>Verify every employer or candidate.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl tracking-[-0.02em] text-[#0b0b0c] mb-4" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>6. Location Accuracy Disclaimer</h2>
            <p>
              Job locations displayed on Kaamlee, including map pins and city/region labels, are <span className="text-[#0b0b0c] font-medium">approximate and may not be fully accurate</span>. Location data is sourced directly from information provided by the hiring company and supplemented by geolocation services. We achieve approximately <span className="text-[#16a34a] font-semibold">~92.99% location accuracy</span> based on the available data; however, we cannot guarantee precision in all cases.
            </p>
            <p className="mt-3">
              We make our best effort to provide the most accurate location information possible. Users are advised to verify the exact job location directly with the employer before making any decisions based on location data shown on this Platform.
            </p>
          </section>
        </div>
      </motion.div>
    </main>
  );
}
