import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function pickThreeRandom(roles: string[]): string[] {
  const shuffled = [...roles].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_API_URL not set' }, { status: 500 });
  }

  // Check if scraping is already running
  const statsRes = await fetch(`${backendUrl}/api/stats/`);
  if (!statsRes.ok) {
    return NextResponse.json({ skipped: true, reason: 'Could not reach stats endpoint' }, { status: 200 });
  }

  const stats = await statsRes.json();
  if (stats.active_sessions > 0) {
    return NextResponse.json({ skipped: true, reason: 'Scraper already running' }, { status: 200 });
  }

  const rolesRes = await fetch(`${backendUrl}/api/roles/`);
  if (!rolesRes.ok) {
    return NextResponse.json({ skipped: true, reason: 'Could not fetch roles' }, { status: 200 });
  }
  const allRoles: string[] = await rolesRes.json();

  const selectedRoles = pickThreeRandom(allRoles);

  const triggerRes = await fetch(`${backendUrl}/api/trigger-scrape/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({ search_terms: selectedRoles, results_wanted: 5 }),
  });

  const data = await triggerRes.json();
  return NextResponse.json({ triggered: true, roles: selectedRoles, status: triggerRes.status, data });
}
