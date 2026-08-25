'use client';

import { Loader2 } from 'lucide-react';
import { useAmbassador } from '@/lib/useAmbassador';
import { AmbassadorProvider } from '@/context/AmbassadorContext';
import PortalShell from '@/components/PortalShell';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAmbassador();

  if (loading || !me) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6]">
        <Loader2 className="animate-spin text-[#16A34A]" size={28} />
      </main>
    );
  }

  return (
    <AmbassadorProvider value={me}>
      <PortalShell me={me}>{children}</PortalShell>
    </AmbassadorProvider>
  );
}
