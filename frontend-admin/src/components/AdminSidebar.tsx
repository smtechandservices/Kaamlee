'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Building2, CreditCard, Users, MessageSquare, LogOut, Briefcase, GraduationCap } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/revenue', label: 'Finance', icon: CreditCard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/feedback', label: 'Feedback', icon: MessageSquare },
];

const AMBASSADOR_NAV_ITEMS = [
  { href: '/ambassadors', label: 'Ambassadors', icon: GraduationCap },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/login') return null;

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/login');
  };

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-56 flex-col border-r border-[#222] bg-[#0a0a0a] z-30">
      <Link href="/" className="flex items-center gap-2.5 px-5 h-16 border-b border-[#222] shrink-0">
        <img src="/logo.png" alt="Kaamlee Logo" className="h-7 w-auto" />
        <span className="text-sm font-black tracking-tight">Admin</span>
      </Link>

      <nav className="flex flex-col gap-1 mx-3 mt-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                active
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                  : 'text-[#888] border border-transparent hover:bg-[#111] hover:text-white'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mt-5 border-t border-[#222] pt-4">
        <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#555]">
          Ambassador Program
        </span>
        <nav className="flex flex-col gap-1 mt-2">
          {AMBASSADOR_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-[#888] border border-transparent hover:bg-[#111] hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-3 border-t border-[#222]">
        <button
          onClick={handleLogout}
          className="cursor-pointer w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#888] hover:bg-red-500/10 hover:text-red-500 transition-all"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
