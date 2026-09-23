'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShieldCheck, Users, Briefcase, LogOut } from 'lucide-react';
import { clearToken } from '@/lib/auth';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/jobs', label: 'Job Postings', icon: Briefcase },
  { href: '/kyc', label: 'Employer & KYC', icon: ShieldCheck },
  { href: '/team', label: 'Team', icon: Users },
];

const itemCls = (active: boolean) =>
  `w-full flex flex-row items-center gap-3 px-3 py-2.5 rounded-full transition-all text-[13.5px] font-medium ${
    active ? 'bg-purple-600/10 text-purple-600' : 'text-black/60 hover:text-[#0b0b0c] hover:bg-black/[0.04]'
  }`;

export default function EmployerSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/login') return null;

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 h-screen w-56 flex-col border-r border-black/[0.08] bg-white py-5 z-30"
      style={{ fontFamily: 'var(--font-outfit)' }}
    >
      <Link href="/" className="mb-6 mx-4 flex items-center gap-2.5 shrink-0">
        <span className="grid h-9 w-9 flex-none place-items-center overflow-hidden rounded-[10px] border border-black/[0.08] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
          <Image src="/logo.png" alt="Kaamlee" width={36} height={36} className="w-full h-full object-cover" />
        </span>
        <span className="text-[15px] font-bold uppercase tracking-[0.1em] text-[#0b0b0c] truncate">Business</span>
      </Link>

      <nav className="flex-1 flex flex-col gap-1 w-full px-3 overflow-y-auto no-scrollbar">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link key={href} href={href} title={label} className={itemCls(active)}>
              <Icon size={17} className="shrink-0" strokeWidth={1.8} />
              <span className="leading-none truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="w-full px-3 pt-3 mt-2 shrink-0 border-t border-black/[0.08]">
        <button
          onClick={handleLogout}
          className={`cursor-pointer border border-black/[0.08] ${itemCls(false)} hover:!bg-red-500/10 hover:!text-red-600`}
        >
          <LogOut size={17} className="shrink-0" strokeWidth={1.8} />
          <span className="leading-none truncate">Logout</span>
        </button>
      </div>
    </aside>
  );
}
