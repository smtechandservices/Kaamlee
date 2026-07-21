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
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  const daysLeft = getDaysLeft(user?.subscription_expires_at);

  return (
    <main className="h-screen flex bg-[#0a0a0a] text-white overflow-hidden relative font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader backHref="/profile" title="Billing" wordmark />

        <div className="flex-1 overflow-y-auto p-6 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="mx-auto z-10 relative">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Subscription Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#111] border border-[#222] rounded-3xl p-8 relative overflow-hidden group"
            >
              {/* <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                <Shield size={120} />
              </div> */}
              
              <div className="relative z-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[#888]">
                      <Shield size={16} />
                      <span className="text-sm">Status</span>
                    </div>
                    <span className={`text-xs font-black uppercase tracking-widest ${user?.is_subscribed ? 'text-green-500' : 'text-red-500'}`}>
                      {user?.is_subscribed ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[#888]">
                      <Calendar size={16} />
                      <span className="text-sm">Expires On</span>
                    </div>
                    <span className="text-xs font-mono text-white">
                      {user?.subscription_expires_at ? new Date(user.subscription_expires_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[#888]">
                      <Clock size={16} />
                      <span className="text-sm">Time Remaining</span>
                    </div>
                    <span className="text-xs font-bold text-green-500">
                      {daysLeft} Days
                    </span>
                  </div>
                </div>

                {user?.is_subscribed ? (
                  <button 
                    onClick={() => setIsPricingModalOpen(true)}
                    className="mt-8 cursor-pointer w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
                  >
                    Renew Plan
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsPricingModalOpen(true)}
                    className="mt-8 cursor-pointer w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center hover:bg-[#ededed] transition-all"
                  >
                    Upgrade Now
                  </button>
                )}
              </div>
            </motion.div>

            <div className="bg-green-500/5 border border-green-500/10 rounded-3xl p-6 space-y-4">
              <p className="text-[14px] leading-relaxed font-medium">
                Payments are powered by Razorpay and handled by Commhawk.
              </p>
              <div className="pt-4 border-t border-green-500/10">
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-green-500/60 italic">
                  Note : Official payment receipts are sent directly to your registered email address.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className="cursor-pointer w-full flex items-center justify-center gap-2 bg-[#111] border border-[#222] hover:border-[#333] text-[#888] hover:text-white py-4 rounded-3xl font-black uppercase tracking-widest text-xs transition-all"
            >
              <MessageSquare size={16} />
              Give Feedback
            </button>
          </div>

          {/* Transaction History List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-4 mb-4">
               <div className="h-px w-12 bg-[#222]" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#333]">Payment Records</span>
            </div>

            {transactions.length === 0 ? (
              <div className="bg-[#111] border border-[#222] rounded-3xl p-12 text-center">
                <CreditCard className="w-12 h-12 text-[#222] mx-auto mb-4" />
                <p className="text-[#555] font-medium">No transactions found</p>
              </div>
            ) : (
              transactions.map((tx) => (
                <motion.div 
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#111] border border-[#222] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      tx.status === 'success' ? 'bg-green-500/10 text-green-500' : 
                      tx.status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                    }`}>
                      {tx.status === 'success' ? <CheckCircle2 size={20} /> : 
                       tx.status === 'failed' ? <XCircle size={20} /> : <Clock size={20} />}
                    </div>
                    <div>
                      <div className="font-bold text-lg leading-tight">₹{tx.amount / 100}</div>
                      <div className="text-[10px] font-mono text-[#555] uppercase tracking-wider mt-1">
                        {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-1 w-full sm:w-auto">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#333]">Order ID</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs font-mono text-[#888]">{tx.razorpay_order_id}</div>
                      {tx.status === 'pending' && (
                        <button 
                          onClick={() => checkStatus(tx.razorpay_order_id)}
                          disabled={checkingStatus === tx.razorpay_order_id}
                          className="cursor-pointer p-1.5 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-all group/btn"
                          title="Refresh Status"
                        >
                          <RotateCcw size={12} className={`${checkingStatus === tx.razorpay_order_id ? 'animate-spin' : 'group-hover/btn:rotate-180 transition-transform duration-500'}`} />
                        </button>
                      )}
                    </div>
                    {tx.razorpay_payment_id && (
                      <>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#333] mt-2">Payment ID</div>
                        <div className="text-xs font-mono text-[#888]">{tx.razorpay_payment_id}</div>
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
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-[#111] border border-[#222] p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl shadow-green-500/10"
            >
              <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center ${statusMessage.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                {statusMessage.type === 'error' ? <XCircle size={32} /> : <CheckCircle2 size={32} />}
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight mb-2">
                {statusMessage.type === 'error' ? 'Payment Status' : 'Success'}
              </h3>
              <p className="text-[#888] text-sm leading-relaxed mb-8">
                {statusMessage.text}
              </p>
              <button 
                onClick={() => setStatusMessage(null)}
                className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#ededed] transition-all cursor-pointer"
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
