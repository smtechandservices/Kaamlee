'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Compass, FileText, Receipt, LogOut, X, Kanban, Globe, LayoutDashboard, CalendarDays } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/applications', label: 'Tracker', icon: Kanban },
  { href: '/custom-cv', label: 'Custom CV', icon: FileText },
  { href: '/portfolio', label: 'Portfolio', icon: Globe },
  { href: '/transactions', label: 'Billing', icon: Receipt },
];

// Full-width rail on both desktop (always visible) and mobile (an
// off-canvas drawer toggled via SidebarToggle + shared SidebarContext).
const itemCls = (active: boolean) =>
  `w-full flex flex-row items-center gap-3 px-3 py-2.5 rounded-full transition-all ${
    active ? 'bg-[#16a34a]/10 text-[#16a34a]' : 'text-[rgba(61,61,61,0.72)] hover:text-[#0b0b0c] hover:bg-black/[0.04]'
  }`;

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isOpen, close } = useSidebar();

  const isProfileActive = pathname === '/profile';

  return (
    <>
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={close}
        />
      )}

      <aside
        className={`fixed md:static top-0 left-0 h-full md:h-auto w-56 shrink-0 flex flex-col border-r border-black/[0.08] bg-white py-5 z-50 transition-transform duration-300 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ fontFamily: 'var(--font-outfit)' }}
      >
        <button
          onClick={close}
          title="Close menu"
          className="md:hidden absolute top-3 right-3 text-black/40 hover:text-[#0b0b0c] transition-colors"
        >
          <X size={18} />
        </button>

        <Link
          href="/"
          title="Home"
          onClick={close}
          className="mb-6 mx-4 flex items-center gap-2.5 shrink-0"
        >
          <span className="grid h-9 w-9 flex-none place-items-center overflow-hidden rounded-[10px] border border-black/[0.08] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
            <Image src="/logo.png" alt="Kaamlee" width={36} height={36} className="w-full h-full object-cover" />
          </span>
          <span className="text-[15px] font-bold uppercase tracking-[0.1em] text-[#0b0b0c] truncate">Kaamlee</span>
        </Link>

        <nav className="flex-1 flex flex-col gap-1 w-full px-3 overflow-y-auto no-scrollbar">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} title={item.label} onClick={close} className={itemCls(active)}>
                <Icon size={17} className="shrink-0" strokeWidth={1.8} />
                <span className="text-[13.5px] font-medium leading-none truncate">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2 w-full px-3 pt-3 mt-2 shrink-0 border-t border-black/[0.08]">
          <Link
            href="/profile"
            title={user ? `${user.first_name} ${user.last_name}` : 'Profile'}
            onClick={close}
            className={`border border-black/[0.08] ${itemCls(isProfileActive)}`}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4ade80] to-[#16a34a] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <span className="text-[13.5px] font-medium leading-none truncate">Profile</span>
          </Link>

          <button
            onClick={() => { logout(); close(); }}
            title="Logout"
            className={`cursor-pointer border border-black/[0.08] ${itemCls(false)}`}
          >
            <LogOut size={17} className="shrink-0" strokeWidth={1.8} />
            <span className="text-[13.5px] font-medium leading-none truncate">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
