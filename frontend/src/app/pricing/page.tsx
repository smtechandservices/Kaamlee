'use client';

import PricingModal from '@/components/PricingModal';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#f2f3f5]">
      <PricingModal isOpen={true} showCloseButton={false} />
    </div>
  );
}
