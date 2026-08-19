'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, ExternalLink, GripVertical, Trash2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import PricingModal from '@/components/PricingModal';
import { PRIMARY_BTN_BG } from '@/components/ui/landing-kit';

interface Job {
  id: number;
  title: string;
  company: string | null;
  location_name: string;
  job_url: string;
  company_logo?: string;
  is_remote: boolean;
}

interface Application {
  id: number;
  job: Job;
  status: string;
  status_updated_at: string;
}

const COLUMNS: { key: string; label: string; dot: string; accent: string; chip: string }[] = [
  { key: 'saved', label: 'Saved', dot: 'bg-slate-400', accent: 'text-slate-600', chip: 'bg-slate-100' },
  { key: 'applied', label: 'Applied', dot: 'bg-blue-500', accent: 'text-blue-600', chip: 'bg-blue-50' },
  { key: 'interviewing', label: 'Interviewing', dot: 'bg-amber-500', accent: 'text-amber-600', chip: 'bg-amber-50' },
  { key: 'offered', label: 'Offered', dot: 'bg-[#16a34a]', accent: 'text-[#16a34a]', chip: 'bg-[#16a34a]/10' },
  { key: 'rejected', label: 'Rejected', dot: 'bg-red-500', accent: 'text-red-600', chip: 'bg-red-50' },
];

function groupByStatus(applications: Application[]) {
  const grouped: Record<string, Application[]> = {};
  COLUMNS.forEach(col => { grouped[col.key] = []; });
  applications.forEach(app => {
    (grouped[app.status] ??= []).push(app);
  });
  return grouped;
}

export default function ApplicationsPage() {
  const { token, logout } = useAuth();
  const { isReady, isSubscribed } = useSubscriptionGate({ allowUnsubscribed: true });

  const [columns, setColumns] = useState<Record<string, Application[]>>(() => groupByStatus([]));
  const [isFetching, setIsFetching] = useState(true);
  const [draggingFrom, setDraggingFrom] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [isPricingOpen, setIsPricingOpen] = useState(false);

  useEffect(() => {
    const fetchApplications = async () => {
      if (!token) return;
      setIsFetching(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/applications/`, {
          headers: { 'Authorization': `Token ${token}` },
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) return;
        const data: Application[] = await res.json();
        setColumns(groupByStatus(data));
      } catch (error) {
        console.error('Failed to fetch applications:', error);
      } finally {
        setIsFetching(false);
      }
    };
    fetchApplications();
  }, [token]);

  const moveCard = useCallback((jobId: number, fromStatus: string, toStatus: string) => {
    setColumns(prev => {
      const card = prev[fromStatus]?.find(a => a.job.id === jobId);
      if (!card) return prev;
      return {
        ...prev,
        [fromStatus]: prev[fromStatus].filter(a => a.job.id !== jobId),
        [toStatus]: [{ ...card, status: toStatus }, ...prev[toStatus]],
      };
    });
  }, []);

  const updateStatus = useCallback(async (jobId: number, fromStatus: string, toStatus: string) => {
    if (fromStatus === toStatus || !token) return;
    moveCard(jobId, fromStatus, toStatus);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}/update_status/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: toStatus }),
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) {
        moveCard(jobId, toStatus, fromStatus); // revert
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      moveCard(jobId, toStatus, fromStatus); // revert
    }
  }, [token, moveCard, logout]);

  const removeCard = useCallback(async (jobId: number, fromStatus: string) => {
    if (!token) return;
    if (!confirm('Stop tracking this job? This removes it from the board and your bookmarks too.')) return;

    const removed = columns[fromStatus]?.find(a => a.job.id === jobId) || null;
    setColumns(prev => ({
      ...prev,
      [fromStatus]: prev[fromStatus].filter(a => a.job.id !== jobId),
    }));
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}/toggle_bookmark/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` },
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok && removed) {
        setColumns(prev => ({ ...prev, [fromStatus]: [removed, ...prev[fromStatus]] })); // revert
      }
    } catch (error) {
      console.error('Failed to remove application:', error);
      if (removed) {
        setColumns(prev => ({ ...prev, [fromStatus]: [removed, ...prev[fromStatus]] })); // revert
      }
    }
  }, [token, columns, logout]);

  const handleDrop = (e: React.DragEvent, toStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (draggingId == null || draggingFrom == null) return;
    updateStatus(draggingId, draggingFrom, toStatus);
    setDraggingId(null);
    setDraggingFrom(null);
  };

  const handleDragStart = (e: React.DragEvent, jobId: number, fromStatus: string) => {
    if (!isSubscribed) {
      e.preventDefault();
      setIsPricingOpen(true);
      return;
    }
    setDraggingId(jobId);
    setDraggingFrom(fromStatus);
  };

  const handleStatusSelect = (jobId: number, fromStatus: string, toStatus: string) => {
    if (!isSubscribed) {
      setIsPricingOpen(true);
      return;
    }
    updateStatus(jobId, fromStatus, toStatus);
  };

  const handleRemove = (jobId: number, fromStatus: string) => {
    if (!isSubscribed) {
      setIsPricingOpen(true);
      return;
    }
    removeCard(jobId, fromStatus);
  };

  const totalCount = COLUMNS.reduce((sum, col) => sum + (columns[col.key]?.length || 0), 0);

  if (!isReady) {
    return (
      <div className="h-screen bg-[#f2f3f5] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#16a34a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="h-screen flex bg-[#f2f3f5] overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          backHref="/dashboard"
          title="Application Tracker"
          badge={!isFetching && (
            <span
              className="text-[10px] sm:text-xs text-black/45 font-semibold shrink-0"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              {totalCount} tracked
            </span>
          )}
        />

        {!isSubscribed && (
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2 bg-[#16a34a]/10 border-b border-[#16a34a]/20 shrink-0">
            <span
              className="text-[10px] sm:text-[11px] text-[#15803d] font-semibold"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              View only, subscribe to drag cards, change status, or stop tracking a job.
            </span>
            <button
              onClick={() => setIsPricingOpen(true)}
              style={{ ...PRIMARY_BTN_BG, fontFamily: 'var(--font-outfit)' }}
              className="cursor-pointer shrink-0 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold text-white shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_6px_16px_-8px_rgba(22,163,74,.85)] transition-transform duration-300 hover:-translate-y-0.5"
            >
              Unlock
            </button>
          </div>
        )}

        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div className="h-full flex gap-4 p-4 sm:p-6 min-w-max">
            {COLUMNS.map(col => {
              const cards = columns[col.key] || [];
              const isOver = dragOverColumn === col.key;
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.key); }}
                  onDragLeave={() => setDragOverColumn(prev => (prev === col.key ? null : prev))}
                  onDrop={(e) => handleDrop(e, col.key)}
                  className={`w-[280px] sm:w-[300px] shrink-0 h-full flex flex-col rounded-[20px] border bg-white transition-colors duration-200 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] ${
                    isOver ? 'border-[#16a34a]/50 bg-[#16a34a]/5' : 'border-black/[0.08]'
                  }`}
                >
                  <div className="px-4 py-3 border-b border-black/[0.08] flex items-center gap-2 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <h2
                      className={`text-xs font-semibold uppercase tracking-widest ${col.accent}`}
                      style={{ fontFamily: 'var(--font-outfit)' }}
                    >
                      {col.label}
                    </h2>
                    <span
                      className={`text-[10px] font-semibold ml-auto ${col.chip} ${col.accent} px-2 py-0.5 rounded-full border border-black/[0.06]`}
                      style={{ fontFamily: 'var(--font-outfit)' }}
                    >
                      {cards.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 custom-scrollbar">
                    {isFetching ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-24 rounded-[16px] bg-black/[0.03] animate-pulse border border-black/[0.06]" />
                      ))
                    ) : cards.length === 0 ? (
                      <div
                        className="h-24 flex items-center justify-center text-[11px] text-black/40 text-center px-4"
                        style={{ fontFamily: 'var(--font-outfit)' }}
                      >
                        {col.key === 'saved' ? 'Bookmark a job to see it here' : 'Drag a card here'}
                      </div>
                    ) : (
                      cards.map(app => (
                        <div
                          key={app.job.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, app.job.id, col.key)}
                          onDragEnd={() => { setDraggingId(null); setDraggingFrom(null); setDragOverColumn(null); }}
                          className={`group p-3 rounded-[16px] border border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)] transition-all duration-300 ${
                            isSubscribed ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                          } ${draggingId === app.job.id ? 'opacity-40' : ''}`}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical size={13} className="text-black/25 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <h3
                                className="text-xs font-semibold text-[#0b0b0c] truncate"
                                style={{ fontFamily: 'var(--font-outfit)' }}
                              >
                                {app.job.title}
                              </h3>
                              <p className="text-[11px] text-[rgba(61,61,61,0.72)] truncate mt-0.5">{app.job.company || 'Confidential'}</p>
                              {app.job.location_name && (
                                <div className="flex items-center gap-1 text-[10px] text-black/45 mt-1.5 truncate">
                                  <MapPin size={10} className="shrink-0" />
                                  <span className="truncate">{app.job.location_name}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-2.5">
                                <select
                                  value={col.key}
                                  onChange={(e) => handleStatusSelect(app.job.id, col.key, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ fontFamily: 'var(--font-outfit)' }}
                                  className="text-[10px] bg-white border border-black/[0.10] rounded-lg px-1.5 py-1 text-black/60 cursor-pointer focus:outline-none focus:border-[#16a34a]/40"
                                >
                                  {COLUMNS.map(c => (
                                    <option key={c.key} value={c.key}>{c.label}</option>
                                  ))}
                                </select>
                                <div className="flex items-center">
                                  <a
                                    href={app.job.job_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-black/35 hover:text-[#16a34a] transition-colors p-1"
                                    title="Open job posting"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleRemove(app.job.id, col.key); }}
                                    className="cursor-pointer text-black/35 hover:text-red-600 transition-colors p-1"
                                    title="Stop tracking"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 4px;
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.12);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.22);
        }
      `}</style>

      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
    </main>
  );
}
