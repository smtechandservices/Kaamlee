'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertCircle } from 'lucide-react';

// MapLibre is heavy and the showcase is desktop-only, so the phone map is
// split out and only mounted once a desktop-width viewport is confirmed.
const LoginMapPhone = dynamic(() => import('@/components/LoginMapPhone'), { ssr: false });

/* ============ SHARED FORM PIECES (login + signup) ============ */

export const AUTH_INPUT_CLS =
  'w-full bg-white border border-black/[0.10] rounded-full px-6 py-4 text-[15px] text-[#0b0b0c] outline-none transition-all placeholder-black/40 focus:border-[#16a34a] focus:shadow-[0_0_0_4px_rgba(22,163,74,.12)]';

export const AUTH_SUBMIT_CLS =
  'cursor-pointer w-full flex items-center justify-center gap-2.5 rounded-full py-4 text-[15px] font-medium text-white shadow-[0_14px_30px_-14px_rgba(22,163,74,.9)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-14px_rgba(22,163,74,.95)] disabled:pointer-events-none disabled:opacity-60';

export const AUTH_SUBMIT_BG = { background: 'linear-gradient(90deg,#86efac 0%,#16a34a 55%,#0f766e 100%)' };

export const AUTH_SECONDARY_CLS =
  'cursor-pointer w-full flex items-center justify-center gap-2 rounded-full border border-black/[0.10] bg-white py-4 text-[15px] font-medium text-[#0b0b0c] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/20 disabled:pointer-events-none disabled:opacity-60';

export const AUTH_LINK_CLS =
  'cursor-pointer px-4 sm:px-6 text-left text-sm font-medium text-[#16a34a] hover:text-[#15803d] transition-colors';

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm py-3 px-5 rounded-2xl"
    >
      <AlertCircle size={16} className="shrink-0" />
      {message}
    </motion.div>
  );
}

export function AuthDivider({ label = 'Or' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-black/[0.08]" />
      <span
        className="text-[10px] font-semibold uppercase tracking-widest text-black/40"
        style={{ fontFamily: 'var(--font-outfit)' }}
      >
        {label}
      </span>
      <div className="flex-1 h-px bg-black/[0.08]" />
    </div>
  );
}

/** Dashed green callout under the form, e.g. "New to Kaamlee? Create an account". */
export function AuthNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-7 sm:mt-8 rounded-[20px] border border-dashed border-[#16a34a]/35 bg-[#16a34a]/[0.05] px-5 py-4 text-sm text-black/65">
      {children}
    </div>
  );
}

/* ============ PAGE SHELL ============ */

interface AuthSplitLayoutProps {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  /** Big serif headline on the dark showcase panel (desktop only). */
  headline?: React.ReactNode;
  children: React.ReactNode;
}

export default function AuthSplitLayout({ title, subtitle, headline, children }: AuthSplitLayoutProps) {
  return (
    <main className="min-h-dvh w-full bg-white lg:bg-[#07090d] flex leading-[1.55] tracking-[-0.01em] antialiased selection:bg-[#16a34a] selection:text-white">
      <ShowcasePanel headline={headline} />

      {/* ============ FORM PANEL ============ */}
      <section className="relative flex-1 lg:flex-none lg:w-[52%] bg-white lg:rounded-l-[56px] flex flex-col min-h-dvh px-5 sm:px-12 xl:px-20 py-6 sm:py-10">
        <div className="mx-auto lg:mx-0 w-full max-w-[640px] lg:max-w-none flex flex-1 flex-col">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="Kaamlee" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 rounded-[10px] object-cover" />
              <span className="uppercase tracking-[0.15em] text-[15px] sm:text-[18px] text-[#0b0b0c]">Kaamlee</span>
            </Link>
            <Link
              href="/"
              className="group flex items-center gap-2.5 text-sm font-medium text-black/70 hover:text-[#0b0b0c] transition-colors"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-full border border-black/[0.10] group-hover:border-black/20 transition-colors">
                <ArrowLeft size={15} />
              </span>
              <span className="hidden sm:inline">Back to home</span>
            </Link>
          </header>

          <div className="flex-1 flex items-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[540px] mx-auto lg:mx-0 py-10 sm:py-12"
            >
              <h1 className="text-[40px] sm:text-[58px] leading-[1.06] tracking-[-0.045em] text-[#0b0b0c]">
                {title}
              </h1>
              <p className="mt-3 text-[15px] sm:text-[16px] text-[rgba(61,61,61,0.72)]">{subtitle}</p>

              {children}
            </motion.div>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[13px] sm:text-sm text-black/55">
            <span>© {new Date().getFullYear()} KAAMLEE</span>
            <div className="flex items-center gap-6">
              <Link href="/terms" className="hover:text-[#0b0b0c] transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-[#0b0b0c] transition-colors">Privacy</Link>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}

/* ============ SHOWCASE PANEL (desktop only) ============ */

function ShowcasePanel({ headline }: { headline?: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return (
    <aside className="hidden lg:flex relative flex-1 flex-col overflow-hidden text-white">
      {/* glow + concentric rings */}
      <div className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full bg-[#16a34a]/[0.10] blur-[120px]" />
      {[360, 520, 680].map((size) => (
        <div
          key={size}
          className="pointer-events-none absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]"
          style={{ width: size, height: size }}
        />
      ))}

      <p className="relative z-10 px-12 pt-10 text-sm text-white/70">
        Job search infrastructure for candidates, employers and ambassadors.
      </p>

      <motion.h2
        initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mt-[12vh] px-10 text-center text-[clamp(52px,5.8vw,96px)] leading-[1.02] tracking-[-0.045em]"
      >
        {headline ?? (
          <>
            Find work
            <br />
            <span className="italic font-normal">without limits.</span>
          </>
        )}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 80, rotate: 10 }}
        animate={{ opacity: 1, y: 0, rotate: 16 }}
        transition={{ duration: 1.1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="absolute left-[calc(42%-150px)] top-[max(50vh,340px)] z-10 w-[300px] xl:w-[330px]"
      >
        {isDesktop && <LoginMapPhone />}
      </motion.div>
    </aside>
  );
}
