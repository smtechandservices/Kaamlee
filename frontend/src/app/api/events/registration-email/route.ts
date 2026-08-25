import { NextRequest, NextResponse } from 'next/server';
import { sendEventRegistrationEmail } from '@/lib/mailer';

interface MyRegistration {
  event: number;
  status: string;
  amount_paise: number;
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization');
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { eventId } = await request.json().catch(() => ({ eventId: null }));
  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required.' }, { status: 400 });
  }

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Never trust the client for who/what to email — re-fetch the authenticated
  // user, the event, and confirm a real *confirmed* registration exists, all
  // server-side against Django using the caller's own token.
  const [userRes, regsRes, eventRes] = await Promise.all([
    fetch(`${API_URL}/api/user/`, { headers: { Authorization: token } }),
    fetch(`${API_URL}/events/registrations/mine/`, { headers: { Authorization: token } }),
    fetch(`${API_URL}/events/${eventId}/`, { headers: { Authorization: token } }),
  ]);

  if (!userRes.ok || !regsRes.ok || !eventRes.ok) {
    return NextResponse.json({ error: 'Could not verify registration.' }, { status: 400 });
  }

  const user = await userRes.json();
  const registrations: MyRegistration[] = await regsRes.json();
  const event = await eventRes.json();

  const registration = registrations.find((r) => String(r.event) === String(eventId) && r.status === 'confirmed');
  if (!registration) {
    return NextResponse.json({ error: 'No confirmed registration found for this event.' }, { status: 404 });
  }

  try {
    await sendEventRegistrationEmail({
      to: user.email,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username,
      eventTitle: event.title,
      eventDate: event.event_date,
      location: event.location,
      amountPaise: registration.amount_paise,
    });
  } catch (err) {
    console.error('Failed to send event registration email:', err);
    return NextResponse.json({ error: 'Could not send the email.' }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
