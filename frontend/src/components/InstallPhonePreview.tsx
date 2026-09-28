'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, useReducedMotion } from 'framer-motion';
import {
  Camera, MessageCircle, Mail, Music, Calendar, Cloud, Clock, Settings, Image as ImageIcon,
  Phone, Compass, Signal, Wifi, BatteryFull, Lock, Menu, ChevronLeft, ChevronRight, Share,
  BookOpen, Copy, Download,
} from 'lucide-react';

// Generic home-screen apps; the last grid slot is where Kaamlee lands.
const APPS = [
  { icon: Camera, label: 'Camera', color: '#64748b' },
  { icon: Calendar, label: 'Calendar', color: '#ef4444' },
  { icon: ImageIcon, label: 'Photos', color: '#f59e0b' },
  { icon: Cloud, label: 'Weather', color: '#0ea5e9' },
  { icon: Mail, label: 'Mail', color: '#3b82f6' },
  { icon: Clock, label: 'Clock', color: '#1f2937' },
  { icon: Music, label: 'Music', color: '#ec4899' },
  { icon: Settings, label: 'Settings', color: '#6b7280' },
  { icon: Compass, label: 'Browser', color: '#6366f1' },
  { icon: MessageCircle, label: 'Chat', color: '#22c55e' },
  { icon: Phone, label: 'Phone', color: '#14b8a6' },
];
const DOCK = [Phone, MessageCircle, Compass, Music];

// Scattered "jobs" on the mini map, as % positions.
const MAP_DOTS = [[18, 30], [34, 62], [52, 38], [66, 70], [78, 26], [88, 55], [26, 80], [60, 18]];

const GREEN_BG = { background: 'linear-gradient(180deg,#4ade80,#16a34a 55%,#15803d)' };

// 0: kaamlee.in in the browser, "Install app" tapped · 1: install dialog, "Install" tapped
// 2: browser closes to the home screen and the Kaamlee icon lands
const PHASE_MS = [2600, 2300, 3800];

/** Phone mockup (same frame as the login page) looping through installing Kaamlee from the website. */
export default function InstallPhonePreview() {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(reduceMotion ? 2 : 0);
  // Only loop while on screen, so visitors always catch it from the website step.
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.25 });

  useEffect(() => {
    if (reduceMotion || !inView) return;
    const t = setTimeout(() => setPhase((p) => (p + 1) % PHASE_MS.length), PHASE_MS[phase]);
    return () => clearTimeout(t);
  }, [phase, reduceMotion, inView]);

  return (
    <div ref={ref} className="rounded-[46px] bg-gradient-to-b from-[#3a3f4b] to-[#1b1e25] p-[9px] shadow-[0_40px_80px_-24px_rgba(16,18,26,.45),inset_0_0_0_1px_rgba(255,255,255,.12)]">
      <div className="relative aspect-[1/2] overflow-hidden rounded-[38px] bg-[#0d1522]" style={{ fontFamily: 'var(--font-outfit)' }}>
        <AnimatePresence initial={false}>
          {phase < 2 ? (
            <motion.div
              key="site"
              className="absolute inset-0"
              exit={{ opacity: 0, scale: 0.86, borderRadius: 38 }}
              transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            >
              <WebsiteScreen tapInstall={phase === 0 && !reduceMotion} />
            </motion.div>
          ) : (
            <motion.div
              key="home"
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <HomeScreen animateIcon={!reduceMotion} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* dynamic island */}
        <div className="absolute left-1/2 top-[10px] z-30 h-[22px] w-[80px] -translate-x-1/2 rounded-full bg-black" />

        <AnimatePresence>{phase === 1 && <InstallDialog />}</AnimatePresence>
      </div>
    </div>
  );
}

/** A finger tap: a ripple that expands and fades after `delay` seconds. */
function Tap({ delay, color = 'bg-white' }: { delay: number; color?: string }) {
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: [0.4, 1.7], opacity: [0, 0.65, 0] }}
      transition={{ delay, duration: 0.7 }}
      className={`pointer-events-none absolute left-1/2 top-1/2 -ml-4 -mt-4 h-8 w-8 rounded-full ${color}`}
    />
  );
}

function StatusBar({ dark }: { dark?: boolean }) {
  return (
    <div className={`relative z-10 flex items-center justify-between px-6 pt-[14px] text-[11px] font-semibold ${dark ? 'text-[#0b0b0c]' : 'text-white'}`}>
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <Signal size={11} strokeWidth={2.5} /><Wifi size={11} strokeWidth={2.5} /><BatteryFull size={14} strokeWidth={2} />
      </span>
    </div>
  );
}

/** kaamlee.in open in a mobile browser: a shrunk-down landing page. */
function WebsiteScreen({ tapInstall }: { tapInstall: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-[#f2f3f5] text-[#0b0b0c]">
      <StatusBar dark />
      <div className="mx-3 mt-2.5 flex items-center justify-center gap-1 rounded-full bg-black/[0.06] py-1.5 text-[9.5px] text-black/60">
        <Lock size={8} strokeWidth={2.5} /> kaamlee.in
      </div>

      <div className="flex-1 overflow-hidden px-3 pt-2.5">
        {/* site nav */}
        <div className="flex items-center justify-between rounded-[10px] border border-black/[0.06] bg-white/80 px-2 py-1.5">
          <span className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="h-4 w-4 rounded-[4px]" />
            <span className="text-[7.5px] font-semibold tracking-[0.15em]">KAAMLEE</span>
          </span>
          <Menu size={10} className="text-black/60" />
        </div>

        {/* hero */}
        <div className="mt-3.5 text-center">
          <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.06] bg-white px-2 py-[3px] text-[7px] text-black/60">
            <i className="h-1 w-1 rounded-full bg-[#16a34a]" /> 42,800 jobs added this week
          </span>
          <div className="mt-2 text-[20px] leading-[1.05] tracking-[-0.03em]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Job applying is <i>a job.</i>
          </div>
          <p className="mx-auto mt-1.5 max-w-[150px] text-[7.5px] leading-snug text-black/50">
            Every job board on one map, scored against your resume.
          </p>
        </div>

        {/* CTAs */}
        <div className="mt-2.5 flex justify-center gap-1.5 text-[8px] font-medium">
          <span className="rounded-full px-2.5 py-1.5 text-white" style={GREEN_BG}>Open the map</span>
          <span className="relative flex items-center gap-1 overflow-hidden rounded-full border border-[#16a34a]/30 bg-[#16a34a]/10 px-2.5 py-1.5 font-semibold text-[#16a34a]">
            <Download size={8} strokeWidth={2.5} /> Install app
            {tapInstall && <Tap delay={1.7} color="bg-[#16a34a]/45" />}
          </span>
        </div>

        {/* mini map */}
        <div
          className="relative mt-3 h-[110px] overflow-hidden rounded-[12px] border border-black/[0.06] bg-white"
          style={{ backgroundImage: 'radial-gradient(rgba(16,18,26,.09) 1px, transparent 1px)', backgroundSize: '8px 8px' }}
        >
          {MAP_DOTS.map(([x, y], i) => (
            <span key={i} className="absolute -ml-1 -mt-1 block h-2 w-2" style={{ left: `${x}%`, top: `${y}%` }}>
              {i === 2 && <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-[#16a34a]/50" />}
              <span className="relative block h-2 w-2 rounded-full border-[1.5px] border-white bg-[#16a34a] shadow-sm" />
            </span>
          ))}
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-1.5 py-0.5 text-[7px] font-medium text-black/70 shadow-sm">
            Bengaluru · 1,240 roles
          </span>
        </div>
      </div>

      {/* browser toolbar */}
      <div className="flex justify-around border-t border-black/[0.06] bg-white/90 pb-4 pt-2 text-black/40">
        {[ChevronLeft, ChevronRight, Share, BookOpen, Copy].map((Icon, i) => <Icon key={i} size={11} strokeWidth={2} />)}
      </div>
    </div>
  );
}

/** The browser's "Install app?" prompt, shown over the website. */
function InstallDialog() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-20 flex items-start justify-center bg-black/40 px-4 pt-[34%] backdrop-blur-[2px]"
    >
      <motion.div
        initial={{ y: 24, scale: 0.94 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 12, scale: 0.96 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full rounded-[20px] bg-white p-4 text-[#0b0b0c] shadow-2xl"
      >
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-[10px]" />
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold leading-tight">Install Kaamlee?</div>
            <div className="text-[10px] text-black/50">kaamlee.in</div>
          </div>
        </div>
        <div className="mt-3.5 flex justify-end gap-2 text-[11px] font-semibold">
          <span className="rounded-full px-3 py-1.5 text-black/50">Cancel</span>
          <span className="relative overflow-hidden rounded-full bg-[#16a34a] px-3.5 py-1.5 text-white">
            Install
            <Tap delay={1.4} />
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Home screen with Kaamlee landing in the last grid slot. */
function HomeScreen({ animateIcon }: { animateIcon: boolean }) {
  return (
    <div className="absolute inset-0 text-white" style={{ background: 'linear-gradient(165deg,#134e32 0%,#0b2a1d 40%,#0d1522 100%)' }}>
      <div className="pointer-events-none absolute -left-10 top-10 h-48 w-48 rounded-full bg-[#4ade80]/25 blur-[60px]" />
      <StatusBar />

      <div className="relative mt-9 grid grid-cols-4 gap-x-2 gap-y-4 px-4">
        {APPS.map(({ icon: Icon, label, color }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <span className="grid aspect-square w-full max-w-[44px] place-items-center rounded-[12px]" style={{ background: color }}>
              <Icon size={18} strokeWidth={1.8} />
            </span>
            <span className="text-[8.5px] text-white/85">{label}</span>
          </div>
        ))}

        <motion.div
          initial={animateIcon ? { scale: 0, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.55, type: 'spring', stiffness: 380, damping: 18 }}
          className="flex flex-col items-center gap-1"
        >
          <div className="relative aspect-square w-full max-w-[44px]">
            <span className="absolute inset-0 -m-1 animate-ping rounded-[14px] bg-[#4ade80]/40" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="relative h-full w-full rounded-[12px] ring-1 ring-white/20" />
          </div>
          <span className="text-[8.5px] text-white/85">Kaamlee</span>
        </motion.div>
      </div>

      <div className="absolute inset-x-3 bottom-3 flex justify-around rounded-[26px] bg-white/15 px-3 py-2.5 backdrop-blur-md">
        {DOCK.map((Icon, i) => (
          <span key={i} className="grid h-10 w-10 place-items-center rounded-[12px] bg-white/20">
            <Icon size={18} strokeWidth={1.8} />
          </span>
        ))}
      </div>
    </div>
  );
}
