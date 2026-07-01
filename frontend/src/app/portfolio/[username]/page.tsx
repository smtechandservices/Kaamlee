import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { PortfolioData } from '@/components/portfolio/types';
import PortfolioTemplate from '@/components/portfolio/PortfolioTemplate';

async function getPortfolio(username: string): Promise<PortfolioData | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const url = `${apiUrl}/api/portfolio/${username}/`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[portfolio] ${url} → ${res.status}`);
      return null;
    }
    return res.json();
  } catch (e) {
    console.error(`[portfolio] fetch failed for ${url}:`, e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const data = await getPortfolio(username);
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
  const data = await getPortfolio(username);
  if (!data) notFound();
  return <PortfolioTemplate data={data} />;
}
