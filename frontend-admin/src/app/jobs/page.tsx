'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  Search,
  Loader2,
  RefreshCcw,
  ExternalLink,
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;
const PAGE_SIZE = 20;

interface Job {
  id: number;
  title: string;
  company: string;
  location_name: string | null;
  city: string;
  state: string | null;
  country: string;
  is_remote: boolean;
  job_type: string | null;
  job_url: string;
  site: string;
  company_logo: string | null;
  date_posted: string | null;
  created_at: string;
  category: string;
  experience_required: string | null;
  salary: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface CompanyOption {
  id: number;
  name: string;
}

interface JobsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Job[];
}

interface MapPreviewState {
  job: Job;
  top: number;
  left: number;
}

const MAP_PREVIEW_WIDTH = 260;
const MAP_PREVIEW_HEIGHT = 220;

// A minimal, plain (non-satellite) preview: Leaflet + CartoDB Positron tiles,
// loaded via CDN inside the iframe's own document so no map library needs to
// be added to this app's bundle just for a one-off coordinate check.
function buildMapSrcDoc(lat: number, lon: number) {
  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #1a1a1a; }
  .leaflet-control-attribution { font-size: 8px; background: rgba(17,17,17,0.7); color: #888; }
  .leaflet-control-attribution a { color: #aaa; }
</style></head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([${lat}, ${lon}], 15);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);
  L.circleMarker([${lat}, ${lon}], { radius: 7, color: '#3b82f6', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.9 }).addTo(map);
</script>
</body></html>`;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [mapPreview, setMapPreview] = useState<MapPreviewState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const router = useRouter();

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const fetchJobs = useCallback(async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (selectedCompany) params.set('company', selectedCompany);
      if (search) params.set('search', search);

      const res = await fetch(`${API_BASE}/admin/jobs/?${params.toString()}`, {
        headers: { Authorization: `Token ${token}` },
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        const data: JobsResponse = await res.json();
        setJobs(data.results);
        setCount(data.count);
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  }, [page, selectedCompany, search, router]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    fetch(`${API_BASE}/admin/companies/?page_size=500`, { headers: { Authorization: `Token ${token}` } })
      .then(res => (res.ok ? res.json() : { results: [] }))
      .then((data: { results: CompanyOption[] }) => setCompanies(data.results.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, []);

  // Any filter change resets to page 1 — a stale page number past the new result count would 404.
  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleCompanyChange = (name: string) => {
    setPage(1);
    setSelectedCompany(name);
  };

  const openMapPreview = (job: Job, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - MAP_PREVIEW_WIDTH - 16);
    const top = Math.min(rect.bottom + 8, window.innerHeight - MAP_PREVIEW_HEIGHT - 16);
    setMapPreview({ job, top, left });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteJob = async (job: Job) => {
    if (!window.confirm(`Delete "${job.title}" at ${job.company}?`)) return;
    const token = localStorage.getItem('admin_token');
    setDeletingId(job.id);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${job.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      });
      if (res.ok) {
        setJobs(prev => prev.filter(j => j.id !== job.id));
        setCount(prev => prev - 1);
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(job.id);
          return next;
        });
      } else {
        alert('Failed to delete job');
      }
    } catch (error) {
      alert('Failed to delete job');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDeleteJobs = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} job${selectedIds.size !== 1 ? 's' : ''}?`)) return;
    const token = localStorage.getItem('admin_token');
    setBulkDeleting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/bulk-delete/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(prev => prev.filter(j => !selectedIds.has(j.id)));
        setCount(prev => prev - (data.deleted ?? selectedIds.size));
        setSelectedIds(new Set());
      } else {
        alert('Failed to delete jobs');
      }
    } catch (error) {
      alert('Failed to delete jobs');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              Jobs
            </h1>
            <p className="text-[#555] font-medium">
              {count.toLocaleString()} job{count !== 1 ? 's' : ''} scraped
              {selectedCompany && <> at <span className="text-white">{selectedCompany}</span></>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" size={18} />
              <input
                type="text"
                placeholder="Search title or company..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                className="w-64 bg-[#111] border border-[#222] rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:border-blue-500 transition-all text-sm"
              />
            </div>

            <select
              value={selectedCompany}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="bg-[#111] border border-[#222] rounded-2xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-all text-sm cursor-pointer max-w-[200px]"
            >
              <option value="">All companies</option>
              {companies.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            {selectedCompany && (
              <button
                onClick={() => handleCompanyChange('')}
                className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all text-[#888] hover:text-white"
                title="Clear company filter"
              >
                <X size={18} />
              </button>
            )}

            <button
              onClick={fetchJobs}
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all"
              title="Refresh"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDeleteJobs}
                disabled={bulkDeleting}
                className="cursor-pointer bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete Selected ({selectedIds.size})
              </button>
            )}
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-[#555] text-xs font-bold uppercase tracking-widest">Loading jobs</p>
          </div>
        ) : (
          <>
            <div className="bg-[#111] border border-[#222] rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#222] bg-[#161616]/50">
                      <th className="text-left px-6 py-5 w-10">
                        <input
                          type="checkbox"
                          checked={jobs.length > 0 && jobs.every(j => selectedIds.has(j.id))}
                          onChange={(e) => setSelectedIds(e.target.checked ? new Set(jobs.map(j => j.id)) : new Set())}
                          className="cursor-pointer w-4 h-4 accent-blue-600"
                        />
                      </th>
                      <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Job</th>
                      <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Company</th>
                      <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Location</th>
                      <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Coordinates</th>
                      <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Category</th>
                      <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Posted</th>
                      <th className="text-right px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#555]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222]/50">
                    <AnimatePresence mode="popLayout">
                      {jobs.map((job) => (
                        <motion.tr
                          key={job.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={`hover:bg-[#161616]/30 transition-colors ${selectedIds.has(job.id) ? 'bg-blue-500/5' : ''}`}
                        >
                          <td className="px-6 py-5">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(job.id)}
                              onChange={() => toggleSelect(job.id)}
                              className="cursor-pointer w-4 h-4 accent-blue-600"
                            />
                          </td>
                          <td className="px-6 py-5">
                            <div className="font-semibold text-white truncate max-w-[260px]">{job.title}</div>
                            {job.job_type && <div className="text-xs text-[#555] mt-0.5">{job.job_type}</div>}
                          </td>
                          <td className="px-6 py-5">
                            <button
                              onClick={() => handleCompanyChange(job.company)}
                              className="cursor-pointer text-[#888] hover:text-blue-400 transition-colors truncate max-w-[160px] text-left"
                              title={`Filter by ${job.company}`}
                            >
                              {job.company}
                            </button>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-1.5 text-sm text-[#888]">
                              <MapPin size={13} className="shrink-0" />
                              <span className="truncate max-w-[180px]">
                                {job.is_remote ? 'Remote' : (job.location_name || 'Unspecified')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-nowrap">
                            {job.latitude != null && job.longitude != null ? (
                              <button
                                onClick={(e) => openMapPreview(job, e)}
                                className="cursor-pointer font-mono text-xs text-[#888] hover:text-blue-400 transition-colors underline decoration-dotted underline-offset-2"
                                title="Preview on map"
                              >
                                {job.latitude.toFixed(4)}, {job.longitude.toFixed(4)}
                              </button>
                            ) : (
                              <span className="text-xs text-[#3a3a3a]">—</span>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            <span className="px-2.5 py-1 rounded-full bg-[#1a1a1a] text-[#888] text-[10px] font-bold uppercase tracking-wider">
                              {job.category}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-sm text-[#666]">
                            {job.date_posted
                              ? new Date(job.date_posted).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : new Date(job.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <a
                                href={job.job_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#888] hover:text-blue-400 transition-colors"
                                title="Open posting"
                              >
                                <ExternalLink size={16} />
                              </a>
                              <button
                                onClick={() => handleDeleteJob(job)}
                                disabled={deletingId === job.id}
                                className="cursor-pointer inline-flex items-center gap-1 text-[#888] hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete job"
                              >
                                {deletingId === job.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {jobs.length === 0 && (
                <div className="py-24 text-center">
                  <Briefcase className="w-12 h-12 text-[#222] mx-auto mb-4" />
                  <p className="text-[#555] font-medium">
                    {selectedCompany || search ? 'No jobs match your filters.' : 'No jobs scraped yet.'}
                  </p>
                </div>
              )}
            </div>

            {count > 0 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-xs text-[#555] font-medium">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="cursor-pointer p-2.5 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="cursor-pointer p-2.5 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {mapPreview && (
          <React.Fragment key="map-preview">
            <div className="fixed inset-0 z-40" onClick={() => setMapPreview(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{ top: mapPreview.top, left: mapPreview.left, width: MAP_PREVIEW_WIDTH }}
              className="fixed z-50 bg-[#111] border border-[#333] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a1a] border-b border-[#333]">
                <span className="text-[10px] font-mono text-[#888] truncate">
                  {mapPreview.job.latitude?.toFixed(5)}, {mapPreview.job.longitude?.toFixed(5)}
                </span>
                <button
                  onClick={() => setMapPreview(null)}
                  className="cursor-pointer text-[#666] hover:text-white transition-colors shrink-0 ml-2"
                >
                  <X size={14} />
                </button>
              </div>
              <iframe
                key={mapPreview.job.id}
                title={`Map preview for ${mapPreview.job.title}`}
                srcDoc={buildMapSrcDoc(mapPreview.job.latitude as number, mapPreview.job.longitude as number)}
                sandbox="allow-scripts"
                className="w-full border-0"
                style={{ height: MAP_PREVIEW_HEIGHT - 34 }}
                loading="lazy"
              />
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </div>
  );
}
