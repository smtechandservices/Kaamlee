'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, RotateCcw, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { PRICING } from '@/lib/constants';

interface PricingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export default function PricingModal({ isOpen, onClose, showCloseButton = true }: PricingModalProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [showConfirmation, setShowConfirmation] = React.useState(false);
  const [orderInfo, setOrderInfo] = React.useState<any>(null);
  const [statusMessage, setStatusMessage] = React.useState<{ text: string, type: 'error' | 'info' } | null>(null);
  const { user, token, refreshUser } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setIsSuccess(false);
        setIsProcessing(false);
        setShowConfirmation(false);
        setOrderInfo(null);
        setStatusMessage(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleInitialize = async () => {
    if (!token) {
      router.push('/login');
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    try {
      // 1. Create Order only AFTER user confirms
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/create-order/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: PRICING.amount_paise })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create order');
      }

      const orderData = await response.json();
      
      // 2. Open Razorpay Modal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Kaamlee",
        description: "Unlimited Job Access - Handled by Commhawk",
        order_id: orderData.order_id,
        notes: {
          portal: `kaamlee | ${user?.username}`
        },
      handler: async function (response: any) {
        try {
          setIsProcessing(true);
          const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/verify-payment/`, {
            method: 'POST',
            headers: {
              'Authorization': `Token ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            })
          });

          if (verifyRes.ok) {
            await refreshUser();
            setIsSuccess(true);
            setTimeout(() => {
              if (window.location.pathname === '/explore') {
                onClose?.();
              } else {
                router.push('/explore');
              }
            }, 2000);
          } else {
            const errorData = await verifyRes.json();
            setStatusMessage({ text: errorData.error || 'Payment verification failed', type: 'error' });
          }
        } catch (err) {
          console.error('Verification error:', err);
          setStatusMessage({ text: 'Error verifying payment', type: 'error' });
        } finally {
          setIsProcessing(false);
        }
      },
      prefill: {
        name: user?.username || "",
        email: user?.email || "",
        contact: (user as any)?.profile?.phone || ""
      },
      theme: {
        color: "#3B82F6"
      },
      modal: {
        ondismiss: function() {
          setIsProcessing(false);
        }
      }
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.on('payment.failed', function (response: any) {
      setStatusMessage({ text: response.error.description, type: 'error' });
      setIsProcessing(false);
    });
    rzp.open();
    } catch (error: any) {
      console.error('Order creation error:', error);
      setStatusMessage({ text: error.message || 'Error creating order', type: 'error' });
      setIsProcessing(false);
    }
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
            className="relative w-full max-w-[600px] border border-green-500/20 bg-[#050505] rounded-sm p-8 sm:p-12 md:p-16 overflow-hidden shadow-[0_0_100px_-12px_rgba(34,197,94,0.2)]"
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
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div
                    key="success-content"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center py-8"
                  >
                    <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mb-8 border border-green-500/50">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 12 }}
                      >
                        <ArrowRight size={32} className="text-green-500 -rotate-45" />
                      </motion.div>
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter mb-4 uppercase">Access Granted</h2>
                    <p className="text-[#888] font-mono text-xs tracking-widest uppercase mb-2">Transaction Encrypted</p>
                    <p className="text-sm text-white/60 mb-8">Redirecting to Job Market...</p>
                    <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 2 }}
                        className="h-full bg-green-600"
                      />
                    </div>
                  </motion.div>
                ) : showConfirmation ? (
                  <motion.div
                    key="confirmation-content"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col items-center w-full"
                  >
                    <div className="mb-6 text-green-500">
                      <RotateCcw size={40} className="animate-pulse" />
                    </div>

                    <h2 className="text-2xl font-black uppercase tracking-tight mb-6">Confirm Selection</h2>

                    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left space-y-5">
                      <div className='flex flex-col md:flex-row gap-4 justify-between items-start'>
                        <div className="flex flex-col gap-1">
                          <span className="text-[#444] text-[10px] font-mono uppercase tracking-widest">Amount</span>
                          <span className="text-2xl font-bold">{PRICING.label}</span>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                          <span className="text-[#444] text-[10px] font-mono uppercase tracking-widest">Date & Time</span>
                          <span className="text-md md:text-2xl font-mono text-white/80">
                            {new Date().toLocaleString('en-IN', { 
                              day: 'numeric', 
                              month: 'numeric', 
                              year: 'numeric',
                              hour: 'numeric',
                              minute: 'numeric',
                              second: 'numeric',
                              hour12: true 
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-white/5 space-y-2">
                        <p className="text-[12px] text-[#666] leading-relaxed uppercase tracking-widest text-center font-mono">
                          Payment Handled by Commhawk <br />
                          Powered by Razorpay
                        </p>
                        <p className="text-[10px] text-green-500/60 leading-relaxed uppercase tracking-widest text-center font-mono italic">
                          A official receipt will be sent to your email
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 w-full">
                      <button
                        onClick={handleConfirmPayment}
                        disabled={isProcessing}
                        className="relative w-full flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-sm font-black uppercase tracking-[0.3em] text-xs hover:bg-[#ededed] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isProcessing ? (
                          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span>Pay Now</span>
                        )}
                      </button>
                      <button
                        onClick={() => setShowConfirmation(false)}
                        className="text-[#444] hover:text-white transition-colors text-[10px] font-bold uppercase tracking-[0.2em] py-2"
                      >
                        Back
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="pricing-content"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col items-center w-full"
                  >
                    <div className="flex items-center justify-center mb-5 sm:mb-6">
                      <span className="text-[9px] font-mono text-green-500 bg-green-500/10 border border-green-500/30 px-3 py-1 tracking-[0.25em] uppercase">Early Access · Beta</span>
                    </div>

                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter mb-6 sm:mb-8 leading-[1.1]">
                      One Price.<br />
                      One Portal.<br />
                      <span className="text-serif font-normal italic lowercase text-green-500">unlimited</span> Jobs.
                    </h2>

                    <div className="flex items-baseline gap-2 sm:gap-3 mb-3 sm:mb-4">
                      <span className="text-xl sm:text-2xl font-mono text-green-500/50">{PRICING.currency === 'INR' ? '₹' : PRICING.currency}</span>
                      <span className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tighter text-white">{PRICING.amount_inr}</span>
                      <span className="font-mono text-base sm:text-lg text-[#444] uppercase tracking-widest">/ {PRICING.interval}</span>
                    </div>

                    <p className="text-[10px] sm:text-xs text-green-500/60 font-mono uppercase tracking-widest mb-6 sm:mb-8">
                      Beta pricing · Will update as premium features launch
                    </p>

                    <p className="text-xs sm:text-sm text-[#888] leading-relaxed max-w-xl mb-8 sm:mb-10">
                      You&apos;re in early. Get every role and every map filter at our beta rate. <br className="hidden sm:block" /> Price will increase when premium features go live — <span className="text-white font-bold italic">early access users get in first.</span>
                    </p>

                    <div className="relative group/btn w-full">
                      <div className="absolute -inset-1 bg-gradient-to-r from-green-600 to-green-400 rounded-sm blur opacity-25 group-hover/btn:opacity-50 transition duration-1000 group-hover/btn:duration-200" />
                      <button
                        onClick={handleInitialize}
                        disabled={isProcessing}
                        className="relative w-full flex items-center justify-center gap-3 sm:gap-4 bg-white text-black px-6 sm:px-8 py-3.5 sm:py-4 rounded-sm font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-xs sm:text-sm hover:bg-[#ededed] transition-all overflow-hidden disabled:opacity-50 cursor-pointer"
                      >
                        {isProcessing ? (
                          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>{!user ? 'Log in to Subscribe' : (user?.is_subscribed ? 'Renew Plan' : 'Initialize Access')}</span>
                            <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>
                    </div>

                    <div className="mt-8 sm:mt-10 pt-8 sm:pt-10 border-t border-white/5 w-full flex justify-center">
                      <div className="font-mono text-[#333] text-[10px] sm:text-[14px] uppercase tracking-widest text-center">
                        Powered by Razorpay · Handled by Commhawk
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Status Message Overlays */}
            <AnimatePresence>
              {statusMessage && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[60] bg-[#050505]/95 backdrop-blur-sm flex items-center justify-center p-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-xs w-full"
                  >
                    <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center ${statusMessage.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                      {statusMessage.type === 'error' ? <XCircle size={32} /> : <CheckCircle2 size={32} />}
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight mb-2">
                      {statusMessage.type === 'error' ? 'Notification' : 'Success'}
                    </h3>
                    <p className="text-[#888] text-sm leading-relaxed mb-8">
                      {statusMessage.text}
                    </p>
                    <button 
                      onClick={() => setStatusMessage(null)}
                      className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#ededed] transition-all cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
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
