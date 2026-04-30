'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, RotateCcw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface PricingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export default function PricingModal({ isOpen, onClose, showCloseButton = true }: PricingModalProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const { user, token, refreshUser } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isOpen) {
      // Small delay to allow exit animation to complete
      const timer = setTimeout(() => {
        setIsSuccess(false);
        setIsProcessing(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleInitialize = async () => {
    if (!token) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subscribe/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        await refreshUser();
        setIsProcessing(false);
        setIsSuccess(true);
        
        setTimeout(() => {
          if (window.location.pathname === '/explore') {
            onClose?.();
            // We'll reset success state after the modal is fully closed/unmounted
          } else {
            router.push('/explore');
          }
        }, 2000);
      } else {
        setIsProcessing(false);
        console.error('Failed to renew subscription');
      }
    } catch (error) {
      console.error('Subscription error:', error);
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
            className="relative w-full max-w-[600px] border border-blue-500/20 bg-[#050505] rounded-sm p-8 sm:p-12 md:p-16 overflow-hidden shadow-[0_0_100px_-12px_rgba(59,130,246,0.2)]"
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
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-[60px]" />
            
            <div className="text-white relative z-10 flex flex-col items-center text-center">
              <AnimatePresence mode="wait">
                {!isSuccess ? (
                  <motion.div
                    key="pricing-content"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col items-center w-full"
                  >
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter mb-6 sm:mb-8 leading-[1.1]">
                      One Price.<br />
                      One Portal.<br />
                      <span className="text-serif font-normal italic lowercase text-blue-500">unlimited</span> Jobs.
                    </h2>

                    <div className="flex items-baseline gap-2 sm:gap-3 mb-6 sm:mb-8">
                      <span className="text-xl sm:text-2xl font-mono text-blue-500/50">$</span>
                      <span className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tighter text-white">2.99</span>
                      <span className="font-mono text-base sm:text-lg text-[#444] uppercase tracking-widest">/ mo</span>
                    </div>

                    <p className="text-xs sm:text-sm text-[#888] leading-relaxed max-w-xl mb-8 sm:mb-10">
                      Stop overthinking it. <br className="hidden sm:block" /> Get every role, and every map filter for the price of a coffee. <br /> <span className="text-white font-bold italic">We just do jobs.</span>
                    </p>

                    <div className="relative group/btn w-full">
                      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-blue-400 rounded-sm blur opacity-25 group-hover/btn:opacity-50 transition duration-1000 group-hover/btn:duration-200" />
                      <button
                        onClick={handleInitialize}
                        disabled={isProcessing}
                        className="relative w-full flex items-center justify-center gap-3 sm:gap-4 bg-white text-black px-6 sm:px-8 py-3.5 sm:py-4 rounded-sm font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-xs sm:text-sm hover:bg-[#ededed] transition-all overflow-hidden disabled:opacity-50 cursor-pointer"
                      >
                        {isProcessing ? (
                          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>{user?.is_subscribed ? 'Renew Plan' : 'Initialize Access'}</span>
                            <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>
                    </div>

                    <div className="mt-8 sm:mt-10 pt-8 sm:pt-10 border-t border-white/5 w-full flex justify-center">
                      <div className="font-mono text-[#333] text-[10px] sm:text-[14px] uppercase tracking-widest text-center">
                        Secure Checkout · Stripe Encryption
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success-content"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center py-8"
                  >
                    <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mb-8 border border-blue-500/50">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 12 }}
                      >
                        <ArrowRight size={32} className="text-blue-500 -rotate-45" />
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
                        className="h-full bg-blue-600"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
