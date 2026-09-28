'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Info, Share, SquarePlus, X } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useSidebar } from '@/context/SidebarContext';

type Variant = 'sidebar' | 'header' | 'nav' | 'menu';

interface InstallAppButtonProps {
  /**
   * - `sidebar`: full-width CTA in the app sidebar
   * - `header`: compact pill in the app PageHeader, mobile-only
   * - `nav`: pill in the landing page nav bar, desktop-only
   * - `menu`: full-width row in the landing page mobile menu
   */
  variant: Variant;
  /** Called before installing, e.g. to close a menu. */
  onClick?: () => void;
}

const VARIANTS: Record<Variant, { button: string; icon: number; label: string; text: string }> = {
  sidebar: {
    button: 'flex mx-3 mt-3 shrink-0 gap-2.5 rounded-full border border-[#16a34a]/25 bg-[#16a34a]/[0.06] px-3 py-2.5 hover:bg-[#16a34a]/10',
    icon: 16,
    label: 'text-[13px] font-semibold truncate',
    text: 'Install app',
  },
  header: {
    button: 'flex md:hidden shrink-0 gap-1.5 rounded-full bg-[#16a34a]/10 px-2.5 py-1.5 hover:bg-[#16a34a]/15',
    icon: 14,
    label: 'text-[11.5px] font-semibold',
    text: 'Install',
  },
  nav: {
    button: 'hidden md:inline-flex whitespace-nowrap gap-2 rounded-full border border-[#16a34a]/25 bg-[#16a34a]/[0.06] px-4 py-[10px] hover:bg-[#16a34a]/10',
    icon: 15,
    label: 'text-[14px] font-medium',
    text: 'Install app',
  },
  menu: {
    button: 'flex mt-2 w-full justify-center gap-2 rounded-full border border-[#16a34a]/25 bg-[#16a34a]/[0.06] py-[14px] hover:bg-[#16a34a]/10',
    icon: 17,
    label: 'text-[15.5px] font-medium',
    text: 'Install the app',
  },
};

// Renders nothing unless the app can actually be installed on this device.
export default function InstallAppButton({ variant, onClick }: InstallAppButtonProps) {
  const { status, install } = useInstallPrompt();
  const { close } = useSidebar();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (status !== 'available' && status !== 'ios') return null;

  const handleClick = () => {
    close();
    onClick?.();
    if (status === 'ios') setShowIosHelp(true);
    else install();
  };

  const v = VARIANTS[variant];

  return (
    <>
      <button
        onClick={handleClick}
        title="Install the Kaamlee app"
        className={`cursor-pointer items-center text-[#16a34a] transition-colors ${v.button}`}
      >
        <Download size={v.icon} className="shrink-0" strokeWidth={2} />
        <span className={`leading-none ${v.label}`}>{v.text}</span>
      </button>

      {showIosHelp && createPortal(<IosInstallSheet onClose={() => setShowIosHelp(false)} />, document.body)}
    </>
  );
}

// iOS has no install prompt API, so walk the user through Safari's Share menu.
export function IosInstallSheet({ onClose }: { onClose: () => void }) {
  const steps = [
    { icon: Share, text: <>Tap the <b>Share</b> button in Safari&apos;s toolbar</> },
    { icon: SquarePlus, text: <>Scroll down and tap <b>Add to Home Screen</b></> },
    { icon: Download, text: <>Tap <b>Add</b>. Kaamlee will appear on your home screen</> },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      style={{ fontFamily: 'var(--font-outfit)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-title"
        className="relative w-full sm:max-w-sm rounded-t-[24px] sm:rounded-[24px] bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          title="Close"
          className="absolute top-4 right-4 cursor-pointer text-black/40 hover:text-[#0b0b0c] transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="h-11 w-11 rounded-[12px]" />
          <div>
            <h2 id="ios-install-title" className="text-[17px] font-semibold tracking-[-0.01em] text-[#0b0b0c]">
              Install Kaamlee
            </h2>
            <p className="text-[12.5px] text-black/55">Add it to your home screen for quick access.</p>
          </div>
        </div>

        <div className="mt-5 flex gap-2.5 rounded-[14px] border border-amber-200/70 bg-amber-50 px-3 py-2.5 text-amber-900">
          <Info size={15} strokeWidth={2} className="mt-[1px] shrink-0" />
          <p className="text-[12.5px] leading-snug">
            <b>One-tap install isn&apos;t supported on your device.</b>
          </p>
        </div>

        <ol className="mt-3 flex flex-col gap-3">
          {steps.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-center gap-3 rounded-[14px] border border-black/[0.08] px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#16a34a]/10 text-[#16a34a]">
                <Icon size={15} strokeWidth={2} />
              </span>
              <span className="text-[13px] leading-snug text-black/75">{text}</span>
            </li>
          ))}
        </ol>

        <button
          onClick={onClose}
          className="mt-5 w-full cursor-pointer rounded-full bg-[#0b0b0c] py-3 text-[14px] font-semibold text-white hover:bg-black/85 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
