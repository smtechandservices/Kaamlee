'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Download, Info, Monitor, Smartphone, Zap } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { IosInstallSheet } from '@/components/InstallAppButton';
import InstallPhonePreview from '@/components/InstallPhonePreview';

const PERKS = [
  { icon: Zap, text: 'One-tap install' },
  { icon: Smartphone, text: 'Android & iPhone' },
  { icon: Monitor, text: 'Desktop too' },
];

// Landing page banner announcing the installable web app: phone showcase on
// the left (styled like the login page's), copy + install button on the right.
export default function InstallBanner() {
  const { status, install } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showUnsupported, setShowUnsupported] = useState(false);

  const handleInstall = () => {
    if (status === 'available') install();
    else if (status === 'ios') setShowIosHelp(true);
    else setShowUnsupported(true);
  };

  return (
    // One gradient across the whole card (top→bottom when stacked, left→right side by side)
    // so the showcase fades into the copy with no seam.
    // No overflow clipping on the card itself, so the phone can pop out above its top edge.
    <div className="grid rounded-[34px] border border-black/[0.08] bg-white bg-[linear-gradient(180deg,rgba(22,163,74,.09),rgba(22,163,74,.03)_35%,rgba(255,255,255,0)_55%)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:bg-[linear-gradient(90deg,rgba(22,163,74,.09),rgba(22,163,74,.04)_35%,rgba(255,255,255,0)_62%)]">
      {/* ============ PHONE SHOWCASE ============ */}
      <div className="relative h-[320px] sm:h-[380px] lg:h-auto lg:min-h-[380px]">
        {/* glow + rings: clipped to the card's rounded corners, and masked to fade out before the panel edge */}
        <div className="pointer-events-none absolute inset-0 overflow-clip rounded-t-[34px] lg:rounded-l-[34px] lg:rounded-tr-none">
          <div className="absolute inset-0 [mask-image:linear-gradient(180deg,#000_55%,transparent)] lg:[mask-image:linear-gradient(90deg,#000_50%,transparent)]">
            <div className="absolute left-1/2 top-[45%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#4ade80]/25 blur-[100px]" />
            {[280, 420, 560].map((size) => (
              <div
                key={size}
                className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#16a34a]/[0.12]"
                style={{ width: size, height: size }}
              />
            ))}
          </div>
        </div>

        {/* Lifted above the card's top edge. The phone is always laid out at 240px and scaled
            down on smaller screens, so its tiny UI keeps its proportions. */}
        <div className="absolute left-[42%] top-[-26px] w-[240px] -translate-x-1/2 origin-top scale-[0.75] sm:top-[-28px] sm:scale-[0.8] lg:left-[45%] lg:top-[-32px] lg:scale-100">
          <motion.div
            initial={{ opacity: 0, y: 80, rotate: -4 }}
            whileInView={{ opacity: 1, y: 0, rotate: -10 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            className="[mask-image:linear-gradient(180deg,#000_90%,transparent)] sm:[mask-image:none]"
          >
            <InstallPhonePreview />
          </motion.div>
        </div>
      </div>

      {/* ============ COPY ============ */}
      <div className="flex flex-col justify-center px-6 py-10 sm:py-12 lg:-ml-12">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-dashed border-[#16a34a]/35 bg-[#16a34a]/5 py-2 pl-3 pr-4 text-[13.5px] font-medium text-[#16a34a]">
          <i className="h-[7px] w-[7px] rounded-full bg-[#16a34a] animate-pulse" />Now live as a web app
        </span>
        <h2 className="mt-5 text-[30px] leading-[1.1] tracking-[-0.035em] sm:text-[38px]">
          Kaamlee, right on your <span className="italic">home screen.</span>
        </h2>
        <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-[rgba(61,61,61,0.72)]">
          Install it in one tap. No app store, no download. It opens full-screen like any other app and is always up to date.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {PERKS.map(({ icon: Icon, text }) => (
            <span key={text} className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3.5 py-2 text-[13px] text-[#3d3d3d]">
              <Icon size={14} className="text-[#16a34a]" strokeWidth={2} />{text}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-start gap-3">
          {status === 'installed' ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#16a34a]/10 px-5 py-3 text-[15px] font-medium text-[#16a34a]">
              <CheckCircle2 size={17} strokeWidth={2} /> Installed on this device
            </span>
          ) : (
            <button
              onClick={handleInstall}
              className="cursor-pointer inline-flex items-center gap-2.5 whitespace-nowrap rounded-full px-[26px] py-[15px] text-[15.5px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_10px_24px_-10px_rgba(22,163,74,.85)] transition-transform duration-300 hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(180deg,#4ade80,#16a34a 55%,#15803d)' }}
            >
              <Download size={17} strokeWidth={2} /> Install the app
            </button>
          )}

          {showUnsupported && status === 'unavailable' && (
            <div className="flex max-w-[420px] gap-2.5 rounded-[14px] border border-amber-200/70 bg-amber-50 px-3 py-2.5 text-amber-900">
              <Info size={15} strokeWidth={2} className="mt-[2px] shrink-0" />
              <p className="text-[12.5px] leading-snug">
                <b>One-tap install isn&apos;t supported in this browser.</b>{' '}
                Open Kaamlee in Chrome, Edge or Safari, or use your browser menu&apos;s &ldquo;Install&rdquo; / &ldquo;Add to Home screen&rdquo; option.
              </p>
            </div>
          )}
        </div>
      </div>

      {showIosHelp && createPortal(<IosInstallSheet onClose={() => setShowIosHelp(false)} />, document.body)}
    </div>
  );
}
