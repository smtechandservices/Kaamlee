import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Enforce CRON_SECRET check if defined
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'fallback_cron_secret';
  
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const djangoUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/trigger-scrape/`;

  try {
    const response = await fetch(djangoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`
      },
      body: JSON.stringify({
        search_term: 'frontend developer',
        results_wanted: 5
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `Django backend responded with ${response.status}: ${text}` }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
