'use client';

import { useEffect } from 'react';
import { captureReferralCode } from '@/lib/referral';

// Mounted once in the root layout so a `?ref=CODE` on any landing page
// (not just /signup) gets captured before the user starts the signup flow.
export default function ReferralCapture() {
  useEffect(() => {
    captureReferralCode();
  }, []);

  return null;
}
