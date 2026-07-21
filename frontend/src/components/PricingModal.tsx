'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, RotateCcw, ArrowLeft, Check, Clock, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { PRICING } from '@/lib/constants';
import { loadRazorpayScript } from '@/lib/razorpay';

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
        description: 'Kaamlee Subscription',
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
            router.push('/explore');
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
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-[600px] lg:max-w-4xl border border-green-500/20 bg-[#050505] rounded-sm p-8 sm:p-10 md:p-12 overflow-y-auto max-h-[90vh] shadow-[0_0_100px_-12px_rgba(34,197,94,0.2)]"
          >
            {/* Top Right Actions */}
            <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-50 flex items-center gap-4 sm:gap-6">
              {!showCloseButton && (
                <Link
                  href="/"
                  className="cursor-pointer flex items-center gap-2 text-[#444] hover:text-white transition-colors text-[10px] font-bold uppercase tracking-[0.2em] group/home"
                >
                  <ArrowLeft size={14} className="group/home:-translate-x-1 transition-transform" />
                  Home
                </Link>
              )}

              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="cursor-pointer text-[#444] hover:text-white transition-colors"
                >
                  <RotateCcw className="rotate-45 w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </button>
              )}
            </div>

            {/* Static Glows */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-green-600/10 rounded-full blur-[60px]" />

            <div className="text-white relative z-10 flex flex-col items-center text-center">
              <motion.div
                key="pricing-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center w-full"
              >
                <div className="flex items-center justify-center mb-5 sm:mb-6">
                  <span className="text-[9px] font-mono text-green-500 bg-green-500/10 border border-green-500/30 px-3 py-1 tracking-[0.25em] uppercase">Early Access · Beta</span>
                </div>

                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter mb-6 sm:mb-8 leading-[1.1]">
                  One Portal.<br />
                  <span className="text-serif font-normal italic lowercase text-green-500">unlimited</span> Jobs.<br />
                  One Flat Price.
                </h2>

                <div className="flex items-baseline gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <span className="text-xl sm:text-2xl font-mono text-green-500/50">₹</span>
                  <span className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tighter text-white">99</span>
                  <span className="font-mono text-base sm:text-lg text-[#444] uppercase tracking-widest">/ mo</span>
                </div>

                <p className="text-[10px] sm:text-xs text-green-500/60 font-mono uppercase tracking-widest mb-6 sm:mb-8">
                  Beta pricing · Lock in ₹99/mo before plans start from ₹299
                </p>

                {/* Feature comparison — stacked on mobile, side-by-side on lg+ */}
                <div className="w-full mb-8 sm:mb-10">
                  <div className="border border-green-500/20 rounded-sm p-4 sm:p-5 bg-[#060a06] shadow-[0_0_40px_-10px_rgba(34,197,94,0.1)]">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-green-500/70">All Users · Beta</span>
                      <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-0.5">₹99/mo</span>
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
                        <div key={feat} className="flex items-center gap-2 text-[11px] text-[#888]">
                          <Check size={11} className="text-green-500 shrink-0" />
                          {feat}
                        </div>
                      ))}
                      <div className="pt-3 mt-3 border-t border-[#111]">
                        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#333] mb-2.5">Coming soon</div>
                        {[
                          'Auto-apply',
                          'AI enhancements',
                        ].map((feat) => (
                          <div key={feat} className="flex items-center gap-2 text-[11px] text-[#444] mb-2">
                            <Clock size={11} className="text-yellow-700/50 shrink-0" />
                            <span className="italic">{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative group/btn w-full">
                  <div className="absolute -inset-1 bg-gradient-to-r from-green-600 to-green-400 rounded-sm blur opacity-25 group-hover/btn:opacity-50 transition duration-1000 group-hover/btn:duration-200" />
                  <button
                    onClick={handleCTA}
                    disabled={isProcessing}
                    className="relative w-full flex items-center justify-center gap-3 sm:gap-4 bg-white text-black px-6 sm:px-8 py-3.5 sm:py-4 rounded-sm font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-xs sm:text-sm hover:bg-[#ededed] transition-all overflow-hidden cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {!user ? (
                      <>
                        <span>Log in to Access</span>
                        <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                      </>
                    ) : isProcessing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Processing…</span>
                      </>
                    ) : (
                      <>
                        <CreditCard size={18} />
                        <span>Pay ₹{PRICING.amount_inr} with Razorpay</span>
                      </>
                    )}
                  </button>
                </div>

                {paymentError && (
                  <p className="mt-3 text-[11px] text-red-400 font-mono text-center">{paymentError}</p>
                )}

                {user && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-[9px] font-mono uppercase tracking-[0.2em] text-[#444]">
                    <ShieldCheck size={11} className="text-green-600/60 shrink-0" />
                    Secured by Razorpay · Powered by Commhawk
                  </div>
                )}

                <div className="mt-8 sm:mt-10 pt-8 sm:pt-10 border-t border-white/5 w-full flex justify-center">
                  <div className="font-mono text-[#333] text-[10px] sm:text-[14px] uppercase tracking-widest text-center">
                    Future plans start from ₹299 · Beta users keep ₹99
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          <style jsx>{`
            .text-serif {
              font-family: 'Playfair Display', serif;
            }
          `}</style>
        </div>
      )}
    </AnimatePresence>
  );
}
