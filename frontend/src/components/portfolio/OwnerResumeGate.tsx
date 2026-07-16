'use client';

import { useEffect } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

// Rendered when the public portfolio API 404s for a reason that might just
// mean the owner hasn't finished setup yet (no resume, no portfolio row, or
// not public). If the visitor turns out to be that account's own owner,
// send them to /profile to fix it up instead of showing a generic 404.
export default function OwnerResumeGate({ username }: { username: string }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isOwner = !isLoading && user?.username === username;

  useEffect(() => {
    if (isOwner) router.replace('/profile');
  }, [isOwner, router]);

  if (!isLoading && !isOwner) {
    notFound();
  }

  return (
    <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
