'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Star,
  Search,
  Loader2,
  MessageSquare,
  RefreshCcw,
  User as UserIcon,
  Mail,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface FeedbackEntry {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  rating: number;
  message: string;
  created_at: string;
  updated_at: string;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          className={s <= rating ? 'fill-yellow-400 text-yellow-600' : 'text-[#0b0b0c]/75'}
        />
      ))}
    </div>
  );
}

const ratingLabels = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Excellent'];

type SortKey = 'created_at' | 'rating' | 'username';

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const router = useRouter();

  const fetchFeedbacks = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/feedback/`, {
        headers: { Authorization: `Token ${token}` },
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data);
      }
    } catch (error) {
      console.error('Failed to fetch feedbacks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const filtered = feedbacks
    .filter((f) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        f.username.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        `${f.first_name} ${f.last_name}`.toLowerCase().includes(q) ||
        f.message.toLowerCase().includes(q);
      const matchesRating = ratingFilter === null || f.rating === ratingFilter;
      return matchesSearch && matchesRating;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'rating') cmp = a.rating - b.rating;
      else if (sortKey === 'username') cmp = a.username.localeCompare(b.username);
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortAsc ? cmp : -cmp;
    });

  const avgRating =
    feedbacks.length > 0
      ? (feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(1)
      : '—';

  const ratingCounts = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    count: feedbacks.filter((f) => f.rating === r).length,
  }));

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown size={14} className="text-[#0b0b0c]/75" />;
    return sortAsc ? (
      <ChevronUp size={14} className="text-green-600" />
    ) : (
      <ChevronDown size={14} className="text-green-600" />
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
                {/* <MessageSquare size={28} className="text-green-600" /> */}
                User Feedback
              </h1>
              <p className="text-[#0b0b0c]/60 font-medium">
                {feedbacks.length} review{feedbacks.length !== 1 ? 's' : ''} submitted
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0b0b0c]/60" size={18} />
              <input
                type="text"
                placeholder="Search by user or message..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-72 bg-white border border-black/[0.08] rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:border-green-600 transition-all text-sm"
              />
            </div>
            <button
              onClick={fetchFeedbacks}
              className="cursor-pointer p-3 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.03] transition-all"
              title="Refresh"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-black/[0.08] rounded-2xl p-5">
            <div className="text-[10px] text-[#0b0b0c]/60 font-bold uppercase tracking-widest mb-1">Total Reviews</div>
            <div className="text-3xl font-black">{feedbacks.length}</div>
          </div>
          <div className="bg-white border border-black/[0.08] rounded-2xl p-5">
            <div className="text-[10px] text-[#0b0b0c]/60 font-bold uppercase tracking-widest mb-1">Avg Rating</div>
            <div className="text-3xl font-black flex items-center gap-2">
              {avgRating}
              <Star size={20} className="fill-yellow-400 text-yellow-600" />
            </div>
          </div>
          {/* Rating breakdown */}
          <div className="bg-white border border-black/[0.08] rounded-2xl p-5 col-span-2">
            <div className="text-[10px] text-[#0b0b0c]/60 font-bold uppercase tracking-widest mb-3">Rating Breakdown</div>
            <div className="flex items-end gap-2 h-8">
              {ratingCounts.map(({ rating, count }) => {
                const pct = feedbacks.length ? (count / feedbacks.length) * 100 : 0;
                return (
                  <button
                    key={rating}
                    onClick={() => setRatingFilter(ratingFilter === rating ? null : rating)}
                    title={`${ratingLabels[rating]} (${count})`}
                    className={`flex-1 rounded-sm transition-all cursor-pointer relative group ${
                      ratingFilter === rating ? 'ring-2 ring-green-600' : ''
                    }`}
                    style={{ height: `${Math.max(pct, 8)}%` }}
                  >
                    <div
                      className={`w-full h-full rounded-sm ${
                        rating >= 4
                          ? 'bg-green-500/70 hover:bg-green-600'
                          : rating === 3
                          ? 'bg-yellow-500/70 hover:bg-yellow-600'
                          : 'bg-red-500/70 hover:bg-red-600'
                      }`}
                    />
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-[#0b0b0c]/60">{rating}★</span>
                  </button>
                );
              })}
            </div>
            <div className="h-5" />
            {ratingFilter !== null && (
              <button
                onClick={() => setRatingFilter(null)}
                className="text-[10px] text-green-600 hover:text-green-500 mt-1 cursor-pointer"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-4" />
            <p className="text-[#0b0b0c]/60 text-xs font-bold uppercase tracking-widest">Loading reviews</p>
          </div>
        ) : (
          <div className="bg-white border border-black/[0.08] rounded-3xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] bg-black/[0.02]">
                  <th className="text-left px-6 py-5">
                    <button
                      onClick={() => handleSort('username')}
                      className="cursor-pointer flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60 hover:text-[#0b0b0c] transition-colors"
                    >
                      User <SortIcon col="username" />
                    </button>
                  </th>
                  <th className="text-left px-6 py-5">
                    <button
                      onClick={() => handleSort('rating')}
                      className="cursor-pointer flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60 hover:text-[#0b0b0c] transition-colors"
                    >
                      Rating <SortIcon col="rating" />
                    </button>
                  </th>
                  <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">
                    Message
                  </th>
                  <th className="text-left px-6 py-5">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="cursor-pointer flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60 hover:text-[#0b0b0c] transition-colors"
                    >
                      Submitted <SortIcon col="created_at" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                <AnimatePresence mode="popLayout">
                  {filtered.map((fb) => (
                    <motion.tr
                      key={fb.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-black/[0.02] transition-colors"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-green-600/10 flex items-center justify-center text-green-600 font-bold text-sm shrink-0">
                            {fb.first_name ? fb.first_name[0].toUpperCase() : fb.username[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[#0b0b0c] text-sm leading-tight">
                              {fb.first_name || fb.last_name
                                ? `${fb.first_name} ${fb.last_name}`.trim()
                                : fb.username}
                            </div>
                            <div className="text-xs text-[#0b0b0c]/60 flex items-center gap-1 mt-0.5">
                              <UserIcon size={11} />
                              @{fb.username}
                            </div>
                            <div className="text-xs text-[#0b0b0c]/60 flex items-center gap-1">
                              <Mail size={11} />
                              {fb.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <StarDisplay rating={fb.rating} />
                          <span className="text-[10px] text-[#0b0b0c]/60 font-bold uppercase tracking-wider">
                            {ratingLabels[fb.rating]}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 max-w-xs">
                        <p className="text-sm text-[#0b0b0c]/40 leading-relaxed line-clamp-3">{fb.message}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-[#0b0b0c]/55 font-mono whitespace-nowrap">
                          {new Date(fb.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        {fb.updated_at !== fb.created_at && (
                          <div className="text-[10px] text-[#0b0b0c]/70 mt-0.5">edited</div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="py-24 text-center">
                <MessageSquare className="w-12 h-12 text-[#0b0b0c]/80 mx-auto mb-4" />
                <p className="text-[#0b0b0c]/60 font-medium">
                  {feedbacks.length === 0 ? 'No feedback submitted yet.' : 'No results match your search.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
