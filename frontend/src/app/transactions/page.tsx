'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import React, { useState, useEffect } from 'react';
import PricingModal from '@/components/PricingModal';
import FeedbackModal from '@/components/FeedbackModal';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { Loader2, CreditCard, CheckCircle2, XCircle, Clock, Shield, Calendar, Zap, RotateCcw, MessageSquare } from 'lucide-react';
import { PRIMARY_BTN_CLS, PRIMARY_BTN_BG, SECONDARY_BTN_CLS, CARD_CLS, ArrowChevron } from '@/components/ui/landing-kit';

interface Transaction {
  id: number;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount: number;
  status: string;
  created_at: string;
}

export default function TransactionsPage() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login');
    }
  }, [token, isLoading, router]);

  useEffect(() => {
    if (token) {
      fetchTransactions();
    }
  }, [token]);

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/transactions/`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (orderId: string) => {
    setCheckingStatus(orderId);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/check-status/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ razorpay_order_id: orderId })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setStatusMessage({ text: "Payment verified successfully!", type: 'info' });
        fetchTransactions();
      } else {
        setStatusMessage({ text: data.message || "Payment still pending or not found on Razorpay.", type: 'error' });
      }
    } catch (error) {
      console.error("Error checking status:", error);
    } finally {
      setCheckingStatus(null);
    }
  };

  const getDaysLeft = (expiry: string | null | undefined) => {
    if (!expiry) return 0;
    const now = new Date();
    const expiryDate = new Date(expiry);
    const diff = expiryDate.getTime() - now.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  if (isLoading || loading) {
    return (
      <div className="h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#16a34a] animate-spin" />
      </div>
    );
  }

  const daysLeft = getDaysLeft(user?.subscription_expires_at);

  return (
    <main className="h-screen flex bg-[#f2f3f5] text-[#0b0b0c] overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/profile" title="Billing" wordmark />

        <div className="flex-1 overflow-y-auto p-6 relative bg-[#f2f3f5]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#16a34a]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="mx-auto z-10 relative">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Subscription Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`${CARD_CLS} p-8 relative overflow-hidden group`}
            >
              <div className="relative z-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-black/45">
                      <Shield size={16} />
                      <span className="text-sm">Status</span>
                    </div>
                    <span
                      className={`text-xs font-semibold uppercase tracking-widest ${user?.is_subscribed ? 'text-[#16a34a]' : 'text-red-600'}`}
                      style={{ fontFamily: 'var(--font-outfit)' }}
                    >
                      {user?.is_subscribed ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-black/45">
                      <Calendar size={16} />
                      <span className="text-sm">Expires On</span>
                    </div>
                    <span className="text-xs text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>
                      {user?.subscription_expires_at ? new Date(user.subscription_expires_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-black/45">
                      <Clock size={16} />
                      <span className="text-sm">Time Remaining</span>
                    </div>
                    <span className="text-xs font-semibold text-[#16a34a]" style={{ fontFamily: 'var(--font-outfit)' }}>
                      {daysLeft} Days
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setIsPricingModalOpen(true)}
                  className={`cursor-pointer ${PRIMARY_BTN_CLS} mt-8 w-full py-4 text-xs uppercase tracking-widest`}
                  style={PRIMARY_BTN_BG}
                >
                  {user?.is_subscribed ? 'Renew Plan' : 'Upgrade Now'}
                  <ArrowChevron />
                </button>
              </div>
            </motion.div>

            <div className="rounded-[22px] border border-[#16a34a]/15 bg-[#16a34a]/5 p-6 space-y-4">
              <p className="text-[14px] leading-relaxed font-medium text-[rgba(61,61,61,0.85)]">
                Payments are powered by Razorpay and handled by Commhawk.
              </p>
              <div className="pt-4 border-t border-[#16a34a]/15">
                <p
                  className="text-[10px] uppercase tracking-[0.2em] text-[#16a34a]/70 italic"
                  style={{ fontFamily: 'var(--font-outfit)' }}
                >
                  Note : Official payment receipts are sent directly to your registered email address.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className={`${SECONDARY_BTN_CLS} w-full py-4 text-xs uppercase tracking-widest text-black/55 hover:text-[#0b0b0c]`}
            >
              <MessageSquare size={16} />
              Give Feedback
            </button>
          </div>

          {/* Transaction History List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-4 mb-4">
               <div className="h-px w-12 bg-black/10" />
               <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45" style={{ fontFamily: 'var(--font-outfit)' }}>Payment Records</span>
            </div>

            {transactions.length === 0 ? (
              <div className={`${CARD_CLS} p-12 text-center`}>
                <CreditCard className="w-12 h-12 text-black/20 mx-auto mb-4" />
                <p className="text-black/45 font-medium">No transactions found</p>
              </div>
            ) : (
              transactions.map((tx) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${CARD_CLS} p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      tx.status === 'success' ? 'bg-[#16a34a]/10 text-[#16a34a]' :
                      tx.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-[#16a34a]/10 text-[#16a34a]'
                    }`}>
                      {tx.status === 'success' ? <CheckCircle2 size={20} /> :
                       tx.status === 'failed' ? <XCircle size={20} /> : <Clock size={20} />}
                    </div>
                    <div>
                      <div className="font-semibold text-lg leading-tight text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>₹{tx.amount / 100}</div>
                      <div className="text-[10px] text-black/45 uppercase tracking-wider mt-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                        {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-1 w-full sm:w-auto">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45" style={{ fontFamily: 'var(--font-outfit)' }}>Order ID</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs font-mono text-[rgba(61,61,61,0.72)]">{tx.razorpay_order_id}</div>
                      {tx.status === 'pending' && (
                        <button
                          onClick={() => checkStatus(tx.razorpay_order_id)}
                          disabled={checkingStatus === tx.razorpay_order_id}
                          className="cursor-pointer p-1.5 rounded-lg bg-[#16a34a]/10 text-[#16a34a] hover:bg-[#16a34a]/20 transition-all group/btn"
                          title="Refresh Status"
                        >
                          <RotateCcw size={12} className={`${checkingStatus === tx.razorpay_order_id ? 'animate-spin' : 'group-hover/btn:rotate-180 transition-transform duration-500'}`} />
                        </button>
                      )}
                    </div>
                    {tx.razorpay_payment_id && (
                      <>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45 mt-2" style={{ fontFamily: 'var(--font-outfit)' }}>Payment ID</div>
                        <div className="text-xs font-mono text-[rgba(61,61,61,0.72)]">{tx.razorpay_payment_id}</div>
                      </>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
        </div>
      </div>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        showCloseButton={true}
      />

      {/* Status Message Modal */}
      <AnimatePresence>
        {statusMessage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStatusMessage(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white border border-black/[0.08] p-8 rounded-[30px] max-w-sm w-full text-center shadow-[0_30px_80px_-30px_rgba(16,18,26,.35)]"
            >
              <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center ${statusMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-[#16a34a]/10 text-[#16a34a]'}`}>
                {statusMessage.type === 'error' ? <XCircle size={32} /> : <CheckCircle2 size={32} />}
              </div>
              <h3 className="text-xl font-semibold tracking-tight mb-2 text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>
                {statusMessage.type === 'error' ? 'Payment Status' : 'Success'}
              </h3>
              <p className="text-[rgba(61,61,61,0.72)] text-sm leading-relaxed mb-8">
                {statusMessage.text}
              </p>
              <button
                onClick={() => setStatusMessage(null)}
                className={`${PRIMARY_BTN_CLS} w-full py-4 text-xs uppercase tracking-widest`}
                style={PRIMARY_BTN_BG}
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
