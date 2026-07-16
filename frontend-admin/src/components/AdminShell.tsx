'use client';

import { usePathname } from 'next/navigation';
import AdminSidebar from './AdminSidebar';

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';

  return (
    <>
      {!isLogin && <AdminSidebar />}
      <div className={isLogin ? '' : 'md:pl-56'}>{children}</div>
    </>
  );
}
