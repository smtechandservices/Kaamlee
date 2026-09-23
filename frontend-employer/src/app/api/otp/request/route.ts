import { NextRequest, NextResponse } from 'next/server';
import { sendOtpEmail } from '@/lib/mailer';

export async function POST(request: NextRequest) {
  const { email, purpose } = await request.json().catch(() => ({ email: null, purpose: null }));
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/otp/request/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OTP_INTERNAL_SECRET}`,
    },
    body: JSON.stringify({ email, purpose }),
  });

  const data = await backendResponse.json().catch(() => ({}));
  if (!backendResponse.ok) {
    return NextResponse.json({ error: data.error || 'Could not send code.' }, { status: backendResponse.status });
  }

  try {
    await sendOtpEmail(email, data.code);
  } catch (err) {
    console.error('Failed to send OTP email:', err);
    return NextResponse.json({ error: 'Could not send the email. Please try again.' }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
