'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Compass, FileText, Receipt, LogOut, X, Kanban, Globe } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';

const NAV_ITEMS = [
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/applications', label: 'Tracker', icon: Kanban },
  { href: '/custom-cv', label: 'Custom CV', icon: FileText },
  { href: '/portfolio', label: 'Portfolio', icon: Globe },
  { href: '/transactions', label: 'Billing', icon: Receipt },
];

// Full-width rail on both desktop (always visible) and mobile (an
// off-canvas drawer toggled via SidebarToggle + shared SidebarContext).
const itemCls = (active: boolean) =>
  `w-full flex flex-row items-center gap-3 px-3 py-3 rounded-xl transition-all ${
    active ? 'bg-green-500/10 text-green-400' : 'text-[#666] hover:text-white hover:bg-white/5'
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
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={close}
        />
      )}

      <aside
        className={`fixed md:static top-0 left-0 h-full md:h-auto w-52 shrink-0 flex flex-col border-r border-[#222] bg-[#0a0a0a] py-5 z-50 transition-transform duration-300 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={close}
          title="Close menu"
          className="md:hidden absolute top-3 right-3 text-[#666] hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <Link
          href="/"
          title="Home"
          onClick={close}
          className="mb-6 mx-4 flex items-center gap-2.5 shrink-0 bg-black/10"
        >
          <div className="w-9 h-9 overflow-hidden hover:scale-105 transition-transform shrink-0">
            <Image src="/logo.png" alt="Kaamlee" width={36} height={36} className="w-full h-full object-cover" />
          </div>
          <span className="text-lg font-black tracking-tighter text-white truncate">KAAMLEE</span>
        </Link>

        <nav className="flex-1 flex flex-col gap-1.5 w-full px-2 overflow-y-auto no-scrollbar">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} title={item.label} onClick={close} className={itemCls(active)}>
                <Icon size={18} className="shrink-0" />
                <span className="text-sm tracking-wider leading-none truncate">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-1.5 w-full px-2 shrink-0">
          <Link
            href="/profile"
            title={user ? `${user.first_name} ${user.last_name}` : 'Profile'}
            onClick={close}
            className={itemCls(isProfileActive)}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <span className="text-sm tracking-wider leading-none truncate">Profile</span>
          </Link>

          <button
            onClick={() => { logout(); close(); }}
            title="Logout"
            className={`cursor-pointer ${itemCls(false)}`}
          >
            <LogOut size={18} className="shrink-0" />
            <span className="text-sm font-bold uppercase tracking-wider leading-none truncate">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
