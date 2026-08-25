'use client';

import { CalendarDays, Wallet, Users } from 'lucide-react';
import ComingSoonPage from '@/components/ComingSoonPage';

export default function EventsPage() {
  return (
    <ComingSoonPage
      tag="on your campus"
      title="Events"
      description="Submit events, track RSVPs, and claim your per-event budget — all from here soon."
      icon={CalendarDays}
      items={[
        { icon: CalendarDays, title: 'Submit an event', body: 'Propose a resume clinic, alumni AMA, or mock interview night for your campus.' },
        { icon: Wallet, title: 'Claim your budget', body: 'Request reimbursement for your per-event budget, right from the portal.' },
        { icon: Users, title: 'Track RSVPs', body: "See who signed up and how many showed, once submissions open." },
      ]}
    />
  );
}
