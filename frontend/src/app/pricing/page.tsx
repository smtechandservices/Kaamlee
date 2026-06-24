'use client';

import PricingModal from '@/components/PricingModal';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#050505]">
      <PricingModal isOpen={true} showCloseButton={false} />
    </div>
  );
}
