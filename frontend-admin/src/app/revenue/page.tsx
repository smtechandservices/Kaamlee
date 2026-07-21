'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  CreditCard,
  IndianRupee,
  ArrowLeft,
  RefreshCcw,
  Loader2,
  Calendar,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PRICING } from '@/lib/constants';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface Transaction {
  id: number;
  username: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
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

export default function RevenueDashboard() {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState('All Users');
  const [selectedStatus, setSelectedStatus] = useState('success');
  const router = useRouter();

  const fetchStats = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/admin/revenue-stats/`, {
        headers: { 'Authorization': `Token ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem('admin_token');
        router.push('/login');
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch stats');

      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch revenue stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const uniqueUsers = ['All Users', ...Array.from(new Set(stats?.recent_transactions.map(tx => tx.username) || []))];

  const filteredTransactions = stats?.recent_transactions.filter(tx => {
    const matchesSearch = (tx.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (tx.razorpay_payment_id?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (tx.razorpay_order_id?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesUser = selectedUser === 'All Users' || tx.username === selectedUser;
    const matchesStatus = selectedStatus === 'all' || tx.status === selectedStatus;
    
    return matchesSearch && matchesUser && matchesStatus;
  }) || [];

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold tracking-tight">Finance Control</h1>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">Live</span>
              </div>
              <p className="text-[#888] text-sm">Real-time revenue metrics and transaction oversight.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={fetchStats}
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all"
              title="Refresh Stats"
            >
              <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <Link
              href="/users"
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all text-[#888] hover:text-white flex items-center gap-2 px-4"
            >
              <Users size={20} />
              <span className="text-sm font-bold">Users</span>
            </Link>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard
            icon={<IndianRupee className="text-green-500" />}
            label="Total Revenue"
            value={`₹ ${stats?.total_revenue.toLocaleString()}`}
            sublabel="All time earnings"
            trend="+12% vs last month"
          />
          <StatCard
            icon={<TrendingUp className="text-blue-500" />}
            label="Monthly Revenue"
            value={`₹ ${stats?.monthly_revenue.toLocaleString()}`}
            sublabel="Current month"
            trend="Active billing period"
          />
          <StatCard
            icon={<ShieldCheck className="text-indigo-500" />}
            label="Active Subscriptions"
            value={stats?.active_subscriptions || 0}
            sublabel={`${((stats?.active_subscriptions || 0) / (stats?.total_users || 1) * 100).toFixed(1)}% Conversion`}
            trend="Paying customers"
          />
          <StatCard
            icon={<CreditCard className="text-purple-500" />}
            label="Avg. Order Value"
            value={PRICING.label}
            sublabel="Standard tier"
            trend="Fixed pricing model"
          />
        </div>

        {/* Transaction History */}
        <div className="bg-[#111] border border-[#222] rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-[#222] flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold mb-1">Transaction History</h2>
              <p className="text-xs text-[#555] font-mono uppercase tracking-widest">Latest successful payments via Razorpay</p>
            </div>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
              {/* Status Filter */}
              <div className="relative group/status">
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="appearance-none bg-[#0a0a0a] border border-[#222] rounded-xl py-2 pl-4 pr-10 text-xs font-bold text-[#888] focus:outline-none focus:border-blue-500 transition-all cursor-pointer min-w-[120px]"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none group-hover/status:text-white transition-colors" />
              </div>

              {/* User Filter Dropdown */}
              <div className="relative group/filter">
                <select 
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="appearance-none bg-[#0a0a0a] border border-[#222] rounded-xl py-2 pl-4 pr-10 text-xs font-bold text-[#888] focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                >
                  {uniqueUsers.map(user => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none group-hover/filter:text-white transition-colors" />
              </div>

              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" size={18} />
                <input
                  type="text"
                  placeholder="Search payment ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1a1a1a]/50 text-[#555] text-[10px] font-black uppercase tracking-[0.2em] border-b border-[#222]">
                  <th className="px-8 py-4">User</th>
                  <th className="px-8 py-4">Amount</th>
                  <th className="px-8 py-4">Order ID</th>
                  <th className="px-8 py-4">Payment ID</th>
                  <th className="px-8 py-4">Date & Time</th>
                  <th className="px-8 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold text-xs">
                          {tx.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-sm">{tx.username}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`font-mono font-bold ${tx.status === 'success' ? 'text-green-500' : 'text-[#888]'}`}>
                        ₹ {tx.amount / 100}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs text-[#555] font-mono group-hover:text-[#888] transition-colors">{tx.razorpay_order_id}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#555] font-mono group-hover:text-[#888] transition-colors">{tx.razorpay_payment_id}</span>
                        <ExternalLink size={12} className="text-[#333] group-hover:text-blue-500 transition-colors" />
                      </div>
                    </td>
                    <td className="px-8 py-6 text-xs text-[#888] font-mono">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${
                        tx.status === 'success' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                        tx.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                        'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-[#444] font-mono text-sm uppercase tracking-widest">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sublabel, trend }: { 
  icon: React.ReactNode, 
  label: string, 
  value: string | number,
  sublabel: string,
  trend: string
}) {
  return (
    <div className="bg-[#111] border border-[#222] p-8 rounded-3xl hover:border-blue-500/30 transition-all group relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 blur-2xl rounded-full group-hover:bg-blue-500/5 transition-all" />
      
      <div className="w-12 h-12 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="text-xs text-[#555] font-black uppercase tracking-[0.2em] mb-2">{label}</div>
      <div className="text-3xl font-black mb-2 tracking-tight">{value}</div>
      <div className="text-xs text-[#888] font-mono mb-4">{sublabel}</div>
      <div className="pt-4 border-t border-[#222] text-[10px] font-bold uppercase tracking-widest text-blue-500/60">
        {trend}
      </div>
    </div>
  );
}
