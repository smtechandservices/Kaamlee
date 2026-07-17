'use client';

import { useEffect, useState } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { PortfolioData } from './types';
import PortfolioTemplate from './PortfolioTemplate';

type Status = 'loading' | 'ready' | 'failed';

// Rendered when the public portfolio API 404s specifically because the
// portfolio exists but isn't public yet ("Portfolio not public."). Our SSR
// fetch never carries an auth token, so the backend's own owner bypass never
// triggers there. This re-fetches client-side with the logged-in user's
// token — if they really are the owner, the backend's bypass kicks in and we
// render their real (private) portfolio with edit affordances. Anyone else
// still gets a normal 404, and an owner whose re-fetch still fails falls
// back to /portfolio.
export default function OwnerPreviewGate({ username }: { username: string }) {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<PortfolioData | null>(null);

  const isOwner = !isLoading && !!token && user?.username === username;

  useEffect(() => {
    if (isLoading) return;
    if (!isOwner) {
      setStatus('failed');
      return;
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${apiUrl}/api/portfolio/${username}/`, { headers: { Authorization: `Token ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) { setData(d); setStatus('ready'); } else { setStatus('failed'); }
      })
      .catch(() => setStatus('failed'));
  }, [isLoading, isOwner, token, username]);

  useEffect(() => {
    if (status === 'failed' && isOwner) router.replace('/portfolio');
  }, [status, isOwner, router]);

  if (status === 'ready' && data) {
    return <PortfolioTemplate data={data} forceOwner />;
  }

  if (status === 'failed' && !isOwner) {
    notFound();
  }

  return (
    <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
