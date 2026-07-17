'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, ExternalLink, GripVertical, Trash2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

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

const COLUMNS: { key: string; label: string; dot: string; accent: string }[] = [
  { key: 'saved', label: 'Saved', dot: 'bg-[#666]', accent: 'text-[#888]' },
  { key: 'applied', label: 'Applied', dot: 'bg-blue-400', accent: 'text-blue-400' },
  { key: 'interviewing', label: 'Interviewing', dot: 'bg-amber-400', accent: 'text-amber-400' },
  { key: 'offered', label: 'Offered', dot: 'bg-green-400', accent: 'text-green-400' },
  { key: 'rejected', label: 'Rejected', dot: 'bg-red-400', accent: 'text-red-400' },
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
  const { token, logout, isLoading } = useAuth();
  const router = useRouter();

  const [columns, setColumns] = useState<Record<string, Application[]>>(() => groupByStatus([]));
  const [isFetching, setIsFetching] = useState(true);
  const [draggingFrom, setDraggingFrom] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login');
    }
  }, [token, isLoading, router]);

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

  const totalCount = COLUMNS.reduce((sum, col) => sum + (columns[col.key]?.length || 0), 0);

  if (isLoading || !token) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="h-screen flex bg-[#0a0a0a] overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          backHref="/explore"
          title="Application Tracker"
          badge={!isFetching && (
            <span className="text-[10px] sm:text-xs text-[#555] font-semibold shrink-0">{totalCount} tracked</span>
          )}
        />

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
                  className={`w-[280px] sm:w-[300px] shrink-0 h-full flex flex-col rounded-2xl border bg-[#0d0d0d] transition-colors ${
                    isOver ? 'border-green-500/50 bg-[#111]' : 'border-[#1c1c1c]'
                  }`}
                >
                  <div className="px-4 py-3 border-b border-[#1c1c1c] flex items-center gap-2 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <h2 className={`text-xs font-bold uppercase tracking-widest ${col.accent}`}>{col.label}</h2>
                    <span className="text-[10px] text-[#555] font-semibold ml-auto bg-[#161616] px-2 py-0.5 rounded-full border border-[#222]">
                      {cards.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 custom-scrollbar">
                    {isFetching ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-24 rounded-xl bg-[#141414] animate-pulse border border-[#1c1c1c]" />
                      ))
                    ) : cards.length === 0 ? (
                      <div className="h-24 flex items-center justify-center text-[11px] text-[#444] text-center px-4">
                        {col.key === 'saved' ? 'Bookmark a job to see it here' : 'Drag a card here'}
                      </div>
                    ) : (
                      cards.map(app => (
                        <div
                          key={app.job.id}
                          draggable
                          onDragStart={() => { setDraggingId(app.job.id); setDraggingFrom(col.key); }}
                          onDragEnd={() => { setDraggingId(null); setDraggingFrom(null); setDragOverColumn(null); }}
                          className={`group p-3 rounded-xl border border-[#222] bg-[#141414] hover:border-[#333] transition-all cursor-grab active:cursor-grabbing ${
                            draggingId === app.job.id ? 'opacity-40' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical size={13} className="text-[#333] mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <h3 className="text-xs font-semibold text-white truncate">{app.job.title}</h3>
                              <p className="text-[11px] text-[#777] truncate mt-0.5">{app.job.company || 'Confidential'}</p>
                              {app.job.location_name && (
                                <div className="flex items-center gap-1 text-[10px] text-[#555] mt-1.5 truncate">
                                  <MapPin size={10} className="shrink-0" />
                                  <span className="truncate">{app.job.location_name}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-2.5">
                                <select
                                  value={col.key}
                                  onChange={(e) => updateStatus(app.job.id, col.key, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] bg-[#1a1a1a] border border-[#262626] rounded-lg px-1.5 py-1 text-[#888] cursor-pointer focus:outline-none focus:border-[#333]"
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
                                    className="text-[#444] hover:text-green-400 transition-colors p-1"
                                    title="Open job posting"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeCard(app.job.id, col.key); }}
                                    className="cursor-pointer text-[#444] hover:text-red-400 transition-colors p-1"
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
          background: #222;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #333;
        }
      `}</style>
    </main>
  );
}
