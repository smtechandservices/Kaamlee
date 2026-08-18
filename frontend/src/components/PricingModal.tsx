'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, RotateCcw, ArrowLeft, Check, Clock, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { PLANS, DEFAULT_PLAN, PlanId } from '@/lib/constants';
import { loadRazorpayScript } from '@/lib/razorpay';
import { PRIMARY_BTN_CLS, PRIMARY_BTN_BG } from '@/components/ui/landing-kit';

interface PricingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export default function PricingModal({ isOpen, onClose, showCloseButton = true }: PricingModalProps) {
  const { user, token, refreshUser } = useAuth();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(DEFAULT_PLAN);
  const plan = PLANS.find((p) => p.id === selectedPlan) ?? PLANS[0];

  const handlePayment = async () => {
    if (!token) return;
    setPaymentError(null);
    setIsProcessing(true);
    try {
      const orderRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/create-order/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      if (!orderRes.ok) throw new Error('Could not start payment. Please try again.');
      const order = await orderRes.json();

      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error('Payment gateway failed to load. Please refresh and try again.');
      }

      const razorpay = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
        amount: order.amount,
        currency: order.currency,
        name: 'Kaamlee',
        description: `Kaamlee Subscription — ${plan.label}`,
        order_id: order.order_id,
        prefill: {
          name: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || undefined,
          email: user?.email,
        },
        theme: { color: '#22c55e' },
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/verify-payment/`, {
              method: 'POST',
              headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(response),
            });
            if (!verifyRes.ok) throw new Error();
            await refreshUser();
            if (onClose) onClose();
            router.push('/dashboard');
          } catch {
            setPaymentError('Payment received but activation failed. Check the Billing page or contact support.');
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: () => setIsProcessing(false),
        },
      });
      razorpay.on('payment.failed', () => {
        setPaymentError('Payment failed. Please try again.');
        setIsProcessing(false);
      });
      razorpay.open();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleCTA = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    handlePayment();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 md:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-[600px] lg:max-w-4xl border border-black/[0.08] bg-white rounded-[34px] p-8 sm:p-10 md:p-12 overflow-y-auto max-h-[90vh] shadow-[0_30px_80px_-30px_rgba(16,18,26,.45)]"
          >
            {/* Top Right Actions */}
            <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-50 flex items-center gap-4 sm:gap-6" style={{ fontFamily: 'var(--font-outfit)' }}>
              {!showCloseButton && (
                <Link
                  href="/dashboard"
                  className="cursor-pointer flex items-center gap-2 text-black/40 hover:text-[#0b0b0c] transition-colors text-[11px] font-bold uppercase tracking-[0.15em] group/home"
                >
                  <ArrowLeft size={14} className="group/home:-translate-x-1 transition-transform" />
                  Dashboard
                </Link>
              )}

              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="cursor-pointer grid h-9 w-9 place-items-center rounded-full border border-black/[0.08] bg-white text-black/45 hover:text-[#0b0b0c] transition-colors"
                >
                  <RotateCcw className="rotate-45 w-4 h-4" />
                </button>
              )}
            </div>

            {/* Static glow */}
            <div className="pointer-events-none absolute -top-24 -left-24 w-48 h-48 rounded-full opacity-60 blur-[70px]" style={{ background: 'radial-gradient(circle, rgba(22,163,74,.20), transparent 65%)' }} />

            <div className="text-[#0b0b0c] relative z-10 flex flex-col items-center text-center">
              <motion.div
                key="pricing-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center w-full"
              >
                <div className="flex items-center justify-center mb-5 sm:mb-6">
                  <span className="inline-flex items-center gap-2.5 rounded-full border border-dashed border-[#16a34a]/35 bg-[#16a34a]/5 py-2 pl-3 pr-4 text-[13px] font-medium text-[#16a34a]" style={{ fontFamily: 'var(--font-outfit)' }}>
                    <i className="h-[7px] w-[7px] rounded-full bg-[#16a34a] animate-pulse" />Kaamlee Subscription
                  </span>
                </div>

                <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-[-0.03em] mb-6 sm:mb-8 leading-[1.1]">
                  One portal.<br />
                  <span className="italic font-normal text-[#16a34a]">Unlimited</span> jobs.<br />
                  Pick your plan.
                </h2>

                {/* Plan picker */}
                <div className="w-full grid grid-cols-2 gap-3 mb-6 sm:mb-8">
                  {PLANS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlan(p.id)}
                      className={`cursor-pointer relative rounded-[18px] p-4 sm:p-5 text-left border transition-all ${
                        selectedPlan === p.id
                          ? 'border-[#16a34a]/40 bg-[#16a34a]/5 shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]'
                          : 'border-black/[0.08] bg-white hover:border-black/[0.16]'
                      }`}
                      style={{ fontFamily: 'var(--font-outfit)' }}
                    >
                      {p.badge && (
                        <span className="absolute -top-2.5 right-3 text-[10px] font-bold uppercase tracking-[0.1em] text-white bg-[#16a34a] px-2.5 py-0.5 rounded-full">
                          {p.badge}
                        </span>
                      )}
                      <p className="text-[11px] font-bold uppercase tracking-widest text-black/45 mb-2">{p.label}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm text-[#16a34a]">₹</span>
                        <span className="text-3xl sm:text-4xl tracking-[-0.03em] text-[#0b0b0c]">{p.amount_inr}</span>
                        <span className="text-[11px] text-black/45 uppercase tracking-widest">{p.durationLabel}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <p className="text-[12px] sm:text-[13px] text-[rgba(61,61,61,0.72)] mb-6 sm:mb-8">
                  Pay monthly or save time with the 3-month plan
                </p>

                {/* Feature comparison — stacked on mobile, side-by-side on lg+ */}
                <div className="w-full mb-8 sm:mb-10">
                  <div className="rounded-[22px] border border-black/[0.08] bg-[#fafafa] p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#16a34a]">Included for all users</span>
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#16a34a] bg-[#16a34a]/10 border border-[#16a34a]/20 px-2.5 py-1 rounded-full">₹{plan.amount_inr}{plan.durationLabel}</span>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        'Unlimited job listings',
                        'Location & country filters',
                        'Job role filters',
                        'Map view',
                        'Bookmark jobs',
                        'Billing history',
                        'Resume & CV builder',
                        'Personalised Portfolio builder',
                      ].map((feat) => (
                        <div key={feat} className="flex items-center gap-2 text-[13px] text-[#3d3d3d]">
                          <Check size={13} className="text-[#16a34a] shrink-0" />
                          {feat}
                        </div>
                      ))}
                      <div className="pt-3 mt-3 border-t border-black/[0.08]" style={{ fontFamily: 'var(--font-outfit)' }}>
                        <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-black/35 mb-2.5">Coming soon</div>
                        {[
                          'Auto-apply',
                          'AI enhancements',
                          'Mock AI interview feedback',
                          'Aptitude prep and tests',
                        ].map((feat) => (
                          <div key={feat} className="flex items-center gap-2 text-[13px] text-black/40 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                            <Clock size={13} className="text-[#c08a12]/60 shrink-0" />
                            <span className="italic">{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCTA}
                  disabled={isProcessing}
                  className={`${PRIMARY_BTN_CLS} w-full py-4 text-[15px]`}
                  style={{ ...PRIMARY_BTN_BG, fontFamily: 'var(--font-outfit)' }}
                >
                  {!user ? (
                    <>
                      <span>Log in to access</span>
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  ) : isProcessing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Processing…</span>
                    </>
                  ) : (
                    <>
                      <CreditCard size={18} />
                      <span>Pay ₹{plan.amount_inr} with Razorpay</span>
                    </>
                  )}
                </button>

                {paymentError && (
                  <p className="mt-3 text-[12px] text-red-500 text-center">{paymentError}</p>
                )}

                {user && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-black/40" style={{ fontFamily: 'var(--font-outfit)' }}>
                    <ShieldCheck size={13} className="text-[#16a34a]/70 shrink-0" />
                    Secured by Razorpay · Powered by Commhawk
                  </div>
                )}

                <div className="mt-8 sm:mt-10 pt-8 sm:pt-10 border-t border-black/[0.08] w-full flex justify-center">
                  <div className="text-black/35 text-[12px] sm:text-[13px] uppercase tracking-[0.1em] text-center" style={{ fontFamily: 'var(--font-outfit)' }}>
                    Cancel anytime · No hidden fees
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
