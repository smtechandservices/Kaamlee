'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Loader2, TrendingUp, Users, CreditCard, IndianRupee, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { CARD_CLS } from '@/components/ui/landing-kit';

interface Transaction {
  id: number;
  user: number;
  username: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount: number;
  status: string;
  created_at: string;
}

interface RevenueStats {
  total_revenue: number;
  monthly_revenue: number;
  active_subscriptions: number;
  total_users: number;
  recent_transactions: Transaction[];
}

export default function RevenuePage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login');
    }
  }, [token, isLoading, router]);

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/admin/revenue-stats/`, {
        headers: { 'Authorization': `Token ${token}` }
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`Revenue stats failed: HTTP ${res.status}`, body);
        if (res.status === 403) {
          setError('Access denied. Admin privileges required.');
        } else {
          setError(`Failed to load revenue data (HTTP ${res.status}).`);
        }
        return;
      }

      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch revenue stats:', err);
      setError('Network error — could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#16a34a] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-[#f2f3f5] flex items-center justify-center flex-col gap-4">
        <p className="text-red-600 text-sm" style={{ fontFamily: 'var(--font-outfit)' }}>{error}</p>
        <Link href="/" className="text-black/45 hover:text-[#0b0b0c] text-xs transition-colors" style={{ fontFamily: 'var(--font-outfit)' }}>← Go home</Link>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Revenue',
      value: `₹${stats?.total_revenue?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) ?? '0'}`,
      icon: IndianRupee,
      color: 'text-[#16a34a]',
      bg: 'bg-[#16a34a]/10',
    },
    {
      label: 'This Month',
      value: `₹${stats?.monthly_revenue?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) ?? '0'}`,
      icon: TrendingUp,
      color: 'text-[#16a34a]',
      bg: 'bg-[#16a34a]/5',
    },
    {
      label: 'Active Subscriptions',
      value: stats?.active_subscriptions?.toLocaleString() ?? '0',
      icon: CreditCard,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Total Users',
      value: stats?.total_users?.toLocaleString() ?? '0',
      icon: Users,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <main className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-6">
      <div className="max-w-7xl mx-auto pt-8 sm:pt-12">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-black/45 hover:text-[#0b0b0c] transition-colors mb-8 text-sm"
          style={{ fontFamily: 'var(--font-outfit)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Profile
        </Link>

        <header className="mb-12">
          <h1
            className="text-4xl font-semibold tracking-[-0.02em] mb-2 text-[#0b0b0c]"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            Revenue Dashboard
          </h1>
          <p className="text-black/45 text-xs uppercase tracking-widest" style={{ fontFamily: 'var(--font-outfit)' }}>
            Admin view &middot; financial overview
          </p>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {statCards.map((card) => (
            <div key={card.label} className={`${CARD_CLS} p-6`}>
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-4`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className="text-2xl font-semibold tracking-tight mb-1 text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>
                {card.value}
              </div>
              <div className="text-[10px] text-black/45 uppercase tracking-widest" style={{ fontFamily: 'var(--font-outfit)' }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px w-12 bg-black/10" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45" style={{ fontFamily: 'var(--font-outfit)' }}>
              Recent Transactions
            </span>
          </div>

          <div className={`${CARD_CLS} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.08]">
                    {['Status', 'User', 'Amount', 'Order ID', 'Payment ID', 'Date'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45"
                        style={{ fontFamily: 'var(--font-outfit)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(stats?.recent_transactions ?? []).map((tx) => (
                    <tr key={tx.id} className="border-b border-black/[0.06] last:border-b-0 hover:bg-black/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${
                            tx.status === 'success' ? 'bg-[#16a34a]/10 text-[#16a34a]' :
                            tx.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                          }`}
                          style={{ fontFamily: 'var(--font-outfit)' }}
                        >
                          {tx.status === 'success' ? <CheckCircle2 size={12} /> :
                           tx.status === 'failed' ? <XCircle size={12} /> : <Clock size={12} />}
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-[rgba(61,61,61,0.72)]">{tx.username}</td>
                      <td className="px-6 py-4 font-semibold text-[#0b0b0c]" style={{ fontFamily: 'var(--font-outfit)' }}>₹{tx.amount / 100}</td>
                      <td className="px-6 py-4 font-mono text-[10px] text-black/45 max-w-[160px] truncate">{tx.razorpay_order_id}</td>
                      <td className="px-6 py-4 font-mono text-[10px] text-black/45 max-w-[160px] truncate">
                        {tx.razorpay_payment_id ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-[10px] text-black/45 whitespace-nowrap" style={{ fontFamily: 'var(--font-outfit)' }}>
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {(stats?.recent_transactions?.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-black/45 text-xs" style={{ fontFamily: 'var(--font-outfit)' }}>
                        No transactions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
