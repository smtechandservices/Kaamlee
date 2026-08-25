'use client';

import { Award, Gift, Sparkles, FileBadge } from 'lucide-react';
import ComingSoonPage from '@/components/ComingSoonPage';

export default function RewardsPage() {
  return (
    <ComingSoonPage
      tag="what you earn"
      title="Rewards"
      description="Track your referral bonus, your Kaamlee Pro access, and your certificate & LOR eligibility, all in one place, soon."
      icon={Award}
      items={[
        { icon: Gift, title: 'Referral bonus', body: 'See what you have earned from referrals and when your next payout lands.' },
        { icon: Sparkles, title: 'Kaamlee Pro', body: 'Track your free Kaamlee Pro access, for you and the five friends you shared it with.' },
        { icon: FileBadge, title: 'Certificate & LOR', body: 'Check your progress toward the completion certificate and the top-100 signed LOR.' },
      ]}
    />
  );
}
