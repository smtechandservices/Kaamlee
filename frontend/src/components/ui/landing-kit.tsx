'use client';

/**
 * Shared visual primitives from the landing page's design language — light
 * cream background, Georgia serif body, Outfit for display/UI chrome, green
 * (#16a34a) accent, rounded-full pills, soft layered shadows. Pulled out of
 * app/page.tsx so the app's logged-in pages can reuse the same look instead
 * of re-implementing it.
 */

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

export const EASE_OUT = 'cubic-bezier(0.16,1,0.3,1)';

/* ============ REVEAL ON SCROLL ============ */
export function Reveal({
  children,
  className = '',
  delay = 0,
  type = 'up',
  as: Tag = 'div',
  style: extraStyle,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  type?: 'up' | 'left' | 'right' | 'scale';
  as?: any;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hiddenTransform =
    type === 'left' ? 'translateX(-32px)' :
    type === 'right' ? 'translateX(32px)' :
    type === 'scale' ? 'translateY(30px) scale(0.965)' :
    'translateY(28px)';

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...extraStyle,
        opacity: inView ? 1 : 0,
        transform: inView ? (extraStyle?.transform ?? 'none') : hiddenTransform,
        filter: inView ? 'blur(0)' : 'blur(9px)',
        transition: `opacity 900ms ${EASE_OUT}, transform 900ms ${EASE_OUT}, filter 900ms ${EASE_OUT}`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </Tag>
  );
}

/* ============ ANIMATED COUNTER ============ */
export function Counter({ target, suffix = '', className = '' }: { target: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          const start = performance.now();
          const dur = 1500;
          const tick = (now: number) => {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  return (
    <span ref={ref} className={className}>
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ============ SPOTLIGHT CARD WRAPPER ============ */
export function Spotlight({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(ev) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${((ev.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty('--my', `${((ev.clientY - r.top) / r.height) * 100}%`);
      }}
      className={`group relative ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'radial-gradient(420px 200px at var(--mx,50%) var(--my,0%), rgba(22,163,74,0.10), transparent 70%)' }}
      />
      {children}
    </div>
  );
}

/* ============ ICON HELPERS ============ */
export const Tick = ({ dark = false }: { dark?: boolean }) => (
  <span className={`grid h-5 w-5 flex-none place-items-center rounded-full mt-[1px] ${dark ? 'bg-white/10 text-white' : 'bg-[#ecfdf5] text-[#16a34a]'}`}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m20 6-11 11-5-5" /></svg>
  </span>
);

export const Cross = ({ dark = false }: { dark?: boolean }) => (
  <span className={`grid h-5 w-5 flex-none place-items-center rounded-full mt-[1px] ${dark ? 'bg-white/5 text-white/30' : 'bg-black/[0.04] text-black/25'}`}>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12" /></svg>
  </span>
);

export const ArrowChevron = ({ className = '' }: { className?: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 group-hover:translate-x-1 ${className}`}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const BrandMark = ({ size = 38 }: { size?: number }) => (
  <span
    className="grid flex-none place-items-center overflow-hidden rounded-[11px] border border-black/[0.08] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]"
    style={{ width: size, height: size }}
  >
    <Image src="/logo.png" alt="Kaamlee" width={size} height={size} className="h-full w-full object-cover" />
  </span>
);

/* ============ SHARED CLASS TOKENS ============ */
// Solid primary CTA (rounded-full, green gradient, shine sweep on hover via the
// `.km-shine` span inside — see PRIMARY_BTN_SHINE_CLS).
export const PRIMARY_BTN_CLS =
  'group relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-6 py-3 text-[14.5px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_10px_24px_-10px_rgba(22,163,74,.85)] transition-transform duration-300 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60';
export const PRIMARY_BTN_BG = { background: 'linear-gradient(180deg,#4ade80,#16a34a 55%,#15803d)' };

export const SECONDARY_BTN_CLS =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-black/[0.10] bg-white px-6 py-3 text-[14.5px] font-medium text-[#0b0b0c] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)] disabled:pointer-events-none disabled:opacity-60';

export const CARD_CLS = 'rounded-[22px] border border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]';
export const PANEL_CLS = 'rounded-[34px] border border-black/[0.08] bg-white';

export const TAG_CLS = 'inline-flex items-center gap-2.5 rounded-full border border-dashed border-[#16a34a]/35 bg-[#16a34a]/5 py-2 pl-3 pr-4 text-[13.5px] font-medium text-[#16a34a]';
