'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Compass, FileText, Receipt, LogOut, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';

const NAV_ITEMS = [
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/custom-cv', label: 'Custom CV', icon: FileText },
  { href: '/transactions', label: 'Billing', icon: Receipt },
];

// Narrow icon rail on desktop (always visible); an off-canvas drawer on
// mobile, toggled via SidebarToggle + shared SidebarContext.
const itemCls = (active: boolean) =>
  `w-full flex flex-row md:flex-col items-center gap-3 md:gap-1 px-3 md:px-0 py-3 md:py-2.5 rounded-xl transition-all ${
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
        className={`fixed md:static top-0 left-0 h-full md:h-auto w-64 md:w-20 shrink-0 flex flex-col items-center border-r border-[#222] bg-[#0a0a0a] py-5 z-50 transition-transform duration-300 md:translate-x-0 ${
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
          className="mb-6 ml-4 self-start md:ml-0 md:self-center w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-green-500/10 hover:scale-105 transition-transform shrink-0"
        >
          <Image src="/logo.png" alt="Kaamlee" width={36} height={36} className="w-full h-full object-cover" />
        </Link>

        <nav className="flex-1 flex flex-col items-center gap-1.5 w-full px-2 overflow-y-auto no-scrollbar">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} title={item.label} onClick={close} className={itemCls(active)}>
                <Icon size={18} />
                <span className="text-sm md:text-[8px] font-bold uppercase tracking-wider leading-none text-center px-0.5">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-1.5 w-full px-2 shrink-0">
          <Link
            href="/profile"
            title={user ? `${user.first_name} ${user.last_name}` : 'Profile'}
            onClick={close}
            className={itemCls(isProfileActive)}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <span className="text-sm md:text-[8px] font-bold uppercase tracking-wider leading-none">Profile</span>
          </Link>

          <button
            onClick={() => { logout(); close(); }}
            title="Logout"
            className={`cursor-pointer ${itemCls(false)}`}
          >
            <LogOut size={18} />
            <span className="text-sm md:text-[8px] font-bold uppercase tracking-wider leading-none">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
