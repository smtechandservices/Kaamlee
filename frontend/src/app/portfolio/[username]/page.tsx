import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { PortfolioData } from '@/components/portfolio/types';
import PortfolioTemplate from '@/components/portfolio/PortfolioTemplate';
import OwnerResumeGate from '@/components/portfolio/OwnerResumeGate';
import OwnerPreviewGate from '@/components/portfolio/OwnerPreviewGate';

interface PortfolioResult {
  data: PortfolioData | null;
  reason?: string;
}

// Backend 404 reasons (see PublicPortfolioView) that mean the account exists
// but its portfolio isn't viewable *yet* — the owner just hasn't finished
// setting it up. Our SSR fetch never carries an auth token, so the backend's
// own owner bypass never triggers here; these gates re-check ownership
// client-side instead of showing everyone a hard 404.
// 'Not found.' (username doesn't exist) is deliberately excluded — always a
// hard 404 for everyone.
const NOTHING_TO_SHOW_REASONS = new Set([
  'Portfolio not available.', // no resume uploaded yet
  'Portfolio not found.',     // resume exists, but no Portfolio row yet
]);
const NOT_PUBLIC_REASON = 'Portfolio not public.'; // resume + portfolio exist, but is_public is off — the owner can still preview it

async function getPortfolio(username: string): Promise<PortfolioResult> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const url = `${apiUrl}/api/portfolio/${username}/`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[portfolio] ${url} → ${res.status}`);
      const reason = await res.json().then((body) => body?.error).catch(() => undefined);
      return { data: null, reason };
    }
    return { data: await res.json() };
  } catch (e) {
    console.error(`[portfolio] fetch failed for ${url}:`, e);
    return { data: null };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const { data } = await getPortfolio(username);
  if (!data) return { title: 'Portfolio not found' };
  const name = data.resume_parsed?.name || data.username;
  const role = data.resume_parsed?.role || '';
  const desc = role ? `${name} — ${role}. Portfolio powered by Kaamlee.` : `${name}'s professional portfolio powered by Kaamlee.`;
  return {
    title: `${name} — Portfolio`,
    description: desc,
    openGraph: { title: `${name} — Portfolio`, description: desc, type: 'profile' },
  };
}

export default async function PortfolioPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { data, reason } = await getPortfolio(username);
  if (!data) {
    if (reason === NOT_PUBLIC_REASON) {
      return <OwnerPreviewGate username={username} />;
    }
    if (reason && NOTHING_TO_SHOW_REASONS.has(reason)) {
      return <OwnerResumeGate username={username} />;
    }
    notFound();
  }
  return <PortfolioTemplate data={data} />;
}
