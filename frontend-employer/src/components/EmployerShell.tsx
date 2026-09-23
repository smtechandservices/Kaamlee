'use client';

import { usePathname } from 'next/navigation';
import EmployerSidebar from './EmployerSidebar';

export default function EmployerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login';

  return (
    <>
      {!isAuthPage && <EmployerSidebar />}
      <div className={isAuthPage ? '' : 'md:pl-56'}>{children}</div>
    </>
  );
}
