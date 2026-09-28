'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { IosInstallSheet } from '@/components/InstallAppButton';

/**
 * Small inline "Install the web app now" prompt. Installs directly where the browser
 * allows it, shows the iOS steps on iPhone, and otherwise scrolls to the install banner
 * (#install-app), which explains why one-tap install isn't available.
 */
export default function InstallAppLink({ align = 'center', className = '' }: { align?: 'center' | 'start'; className?: string }) {
  const { status, install } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (status === 'installed') return null;

  const handleClick = () => {
    if (status === 'available') install();
    else if (status === 'ios') setShowIosHelp(true);
    else document.getElementById('install-app')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <>
      <p className={`flex flex-wrap items-center ${align === 'center' ? 'justify-center' : 'justify-start'} gap-x-1.5 gap-y-1 text-[14px] text-[rgba(61,61,61,0.72)] ${className}`}>
        <Smartphone size={15} className="text-[#16a34a]" strokeWidth={2} />
        Prefer an app?
        <button
          onClick={handleClick}
          className="group cursor-pointer font-medium text-[#16a34a] underline decoration-[#16a34a]/30 underline-offset-4 transition-colors hover:text-[#15803d] hover:decoration-[#16a34a]"
        >
          Install the web app now
          <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">→</span>
        </button>
      </p>

      {showIosHelp && createPortal(<IosInstallSheet onClose={() => setShowIosHelp(false)} />, document.body)}
    </>
  );
}
