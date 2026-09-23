'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Building2, ShieldCheck, CreditCard, Users, MessageSquare, LogOut, Briefcase, GraduationCap, Radio, FileText } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/scraper', label: 'Scraper', icon: Radio },
  { href: '/revenue', label: 'Finance', icon: CreditCard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/feedback', label: 'Feedback', icon: MessageSquare },
];

const EMPLOYER_ITEM = { href: '/employers', label: 'Employers', icon: ShieldCheck };
const POSTINGS_ITEM = { href: '/postings', label: 'Postings', icon: FileText };
const AMBASSADOR_ITEM = { href: '/ambassadors', label: 'Ambassadors', icon: GraduationCap };

const itemCls = (active: boolean) =>
  `w-full flex flex-row items-center gap-3 px-3 py-2.5 rounded-full transition-all text-[13.5px] font-medium ${
    active ? 'bg-[#16a34a]/10 text-[#16a34a]' : 'text-black/60 hover:text-[#0b0b0c] hover:bg-black/[0.04]'
  }`;

interface StoredAdminUser {
  username?: string;
  first_name?: string;
  last_name?: string;
}

// Saved at login (and refreshed by the Profile page) — read here for the
// Profile item's initials, same as the candidate app's sidebar.
function readStoredUser(): StoredAdminUser | null {
  try {
    return JSON.parse(localStorage.getItem('admin_user') || 'null');
  } catch {
    return null;
  }
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<StoredAdminUser | null>(null);

  useEffect(() => {
    const sync = () => setAdminUser(readStoredUser());
    sync();
    window.addEventListener('admin-user-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('admin-user-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, [pathname]);

  if (pathname === '/login') return null;

  const initials =
    `${adminUser?.first_name?.[0] ?? ''}${adminUser?.last_name?.[0] ?? ''}`.toUpperCase()
    || adminUser?.username?.[0]?.toUpperCase()
    || 'A';
  const profileTitle = [adminUser?.first_name, adminUser?.last_name].filter(Boolean).join(' ') || adminUser?.username || 'Profile';

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
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
        <span className="text-[15px] font-bold uppercase tracking-[0.1em] text-[#0b0b0c] truncate">Admin</span>
      </Link>

      <nav className="flex-1 flex flex-col gap-1 w-full px-3 overflow-y-auto no-scrollbar">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} title={label} className={itemCls(active)}>
              <Icon size={17} className="shrink-0" strokeWidth={1.8} />
              <span className="leading-none truncate">{label}</span>
            </Link>
          );
        })}

        <div className="my-2 border-t border-black/[0.08]" />

        <Link
          href={EMPLOYER_ITEM.href}
          title={EMPLOYER_ITEM.label}
          className={itemCls(pathname === EMPLOYER_ITEM.href)}
        >
          <EMPLOYER_ITEM.icon size={17} className="shrink-0" strokeWidth={1.8} />
          <span className="leading-none truncate">{EMPLOYER_ITEM.label}</span>
        </Link>

        <Link
          href={POSTINGS_ITEM.href}
          title={POSTINGS_ITEM.label}
          className={itemCls(pathname === POSTINGS_ITEM.href)}
        >
          <POSTINGS_ITEM.icon size={17} className="shrink-0" strokeWidth={1.8} />
          <span className="leading-none truncate">{POSTINGS_ITEM.label}</span>
        </Link>

        <div className="my-2 border-t border-black/[0.08]" />

        <Link
          href={AMBASSADOR_ITEM.href}
          title={AMBASSADOR_ITEM.label}
          className={itemCls(pathname === AMBASSADOR_ITEM.href)}
        >
          <AMBASSADOR_ITEM.icon size={17} className="shrink-0" strokeWidth={1.8} />
          <span className="leading-none truncate">{AMBASSADOR_ITEM.label}</span>
        </Link>
      </nav>

      <div className="w-full px-3 pt-3 mt-2 shrink-0 border-t border-black/[0.08] flex flex-col gap-1.5">
        <Link
          href="/profile"
          title={profileTitle}
          className={`border border-black/[0.08] ${itemCls(pathname === '/profile')}`}
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4ade80] to-[#16a34a] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {initials}
          </div>
          <span className="leading-none truncate">Profile</span>
        </Link>

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
