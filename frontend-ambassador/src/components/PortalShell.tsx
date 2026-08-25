'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, UserRound, LogOut, Menu, X, CalendarDays, Award } from 'lucide-react';
import { clearToken } from '@/lib/api';
import type { Me } from '@/lib/useAmbassador';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, soon: false },
  { href: '/events', label: 'Events', icon: CalendarDays, soon: false },
  { href: '/rewards', label: 'Rewards', icon: Award, soon: true },
  { href: '/profile', label: 'Profile', icon: UserRound, soon: false },
] as const;

function initials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

function ProfileCard({ me }: { me: Me }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#E7E5E0] bg-[#FAF9F6] p-3">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[#16A34A] text-[13px] font-bold text-white" style={{ fontFamily: 'var(--font-outfit)' }}>
        {initials(me.full_name)}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-outfit)' }}>{me.full_name}</div>
        <div className="truncate text-[12px] text-[#6B7280]">{me.college_name}</div>
      </div>
    </div>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, soon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-[14px] font-semibold transition-colors ${
              active ? 'bg-[#16A34A] text-white' : 'text-[#57534E] hover:bg-black/[0.04] hover:text-[#0A0A0A]'
            }`}
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            <Icon size={17} />
            <span className="flex-1">{label}</span>
            {soon && (
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${active ? 'bg-white/20 text-white' : 'bg-[#FDE68A] text-[#3B2A03]'}`}>
                Soon
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default function PortalShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#0A0A0A]" style={{ fontFamily: 'var(--font-jakarta), ui-sans-serif, system-ui, sans-serif' }}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#E7E5E0] bg-white px-5 py-6 md:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 flex-none place-items-center overflow-hidden rounded-lg border border-black/10">
            <Image src="/logo.png" alt="Kaamlee" width={36} height={36} className="h-full w-full object-cover" />
          </span>
          <span className="text-[15px] font-semibold uppercase tracking-[0.15em]" style={{ fontFamily: 'var(--font-jakarta), ui-sans-serif, system-ui, sans-serif' }}>Kaamlee</span>
        </Link>
        <span className={`-mt-1 ml-1 block text-[13px] font-bold text-[#16A34A] -rotate-2`} style={{ fontFamily: 'var(--font-caveat)' }}>
          campus ambassador
        </span>

        <div className="mt-7">
          <NavLinks pathname={pathname} />
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <ProfileCard me={me} />
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 rounded-full border border-black/10 px-4 py-2.5 text-[13px] font-semibold text-[#57534E] transition-colors hover:border-black/25 hover:text-[#0A0A0A]"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E7E5E0] bg-[#FAF9F6]/90 backdrop-blur-md px-5 py-3.5 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-lg border border-black/10">
            <Image src="/logo.png" alt="Kaamlee" width={32} height={32} className="h-full w-full object-cover" />
          </span>
          <span className="text-[13px] font-semibold uppercase tracking-[0.15em]" style={{ fontFamily: 'var(--font-jakarta), ui-sans-serif, system-ui, sans-serif' }}>Kaamlee</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="grid h-9 w-9 place-items-center rounded-full border border-black/10 text-[#57534E]"
        >
          {mobileOpen ? <X size={17} /> : <Menu size={17} />}
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-x-0 top-[57px] z-20 border-b border-[#E7E5E0] bg-white px-5 py-5 md:hidden">
          <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          <div className="mt-5 flex flex-col gap-3">
            <ProfileCard me={me} />
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 rounded-full border border-black/10 px-4 py-2.5 text-[13px] font-semibold text-[#57534E]"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="px-5 py-8 sm:px-8 sm:py-10 md:ml-64">
        <div className="mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}
