'use client';

import { Menu } from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';

export default function SidebarToggle() {
  const { toggle } = useSidebar();

  return (
    <button
      onClick={toggle}
      title="Open menu"
      className="md:hidden cursor-pointer text-black/45 hover:text-[#0b0b0c] transition-colors"
    >
      <Menu size={20} />
    </button>
  );
}
