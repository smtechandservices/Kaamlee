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
  Calendar,
  History,
  Crosshair,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getCached, setCache, invalidatePrefix } from '@/lib/cache';
import Checkbox from '@/components/Checkbox';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;
const PAGE_SIZE = 20;

interface Job {
  id: number;
  id_from_site: string;
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
  description: string | null;
}

interface CompanyOption {
  id: number;
  name: string;
}

interface JobStats {
  with_coordinates: number;
  most_recent_posted: string | null;
  oldest_posted: string | null;
}

interface JobsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Job[];
  stats: JobStats;
}

interface MissingCoordsCompany {
  company: string;
  missing: number;
  total: number;
}

interface GeocodeResult {
  ok: boolean;
  geocoded?: number;
  borrowed?: number;
  remaining?: number;
  rate_limited?: boolean;
  error?: string;
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

function JobStatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-[#555] font-black uppercase tracking-[0.2em] mb-0.5">{label}</div>
        <div className="text-lg font-bold truncate">{value}</div>
        {sub && <div className="text-xs text-[#666] truncate">{sub}</div>}
      </div>
    </div>
  );
}

function DetailField({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#555] mb-1">{label}</div>
      <div className={`text-sm text-white break-words ${mono ? 'font-mono text-xs' : ''}`}>
        {value ?? <span className="text-[#3a3a3a]">—</span>}
      </div>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysAgo(value: string | null) {
  if (!value) return null;
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [count, setCount] = useState(0);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [mapPreview, setMapPreview] = useState<MapPreviewState | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeLogs, setGeocodeLogs] = useState<string[]>([]);
  const [geocodeResult, setGeocodeResult] = useState<GeocodeResult | null>(null);
  const [geocodeTarget, setGeocodeTarget] = useState<string | null>(null);
  const [geocodeMenuOpen, setGeocodeMenuOpen] = useState(false);
  const [missingCoordsCompanies, setMissingCoordsCompanies] = useState<MissingCoordsCompany[] | null>(null);
  const [loadingMissingCoords, setLoadingMissingCoords] = useState(false);
  const router = useRouter();

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const fetchJobs = useCallback(async (force = false) => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }
    const params = new URLSearchParams({ page: String(page) });
    if (selectedCompany) params.set('company', selectedCompany);
    if (search) params.set('search', search);
    const cacheKey = `job-data:list:${params.toString()}`;

    if (!force) {
      const cached = getCached<JobsResponse>(cacheKey);
      if (cached) {
        setJobs(cached.results);
        setCount(cached.count);
        setStats(cached.stats ?? null);
        setSelectedIds(new Set());
        return;
      }
    }

    setLoading(true);
    try {
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
        setStats(data.stats ?? null);
        setSelectedIds(new Set());
        setCache(cacheKey, data);
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
    const cacheKey = 'company-data:dropdown';
    const cached = getCached<CompanyOption[]>(cacheKey);
    if (cached) {
      setCompanies(cached);
      return;
    }
    fetch(`${API_BASE}/admin/companies/?page_size=500`, { headers: { Authorization: `Token ${token}` } })
      .then(res => (res.ok ? res.json() : { results: [] }))
      .then((data: { results: CompanyOption[] }) => {
        const sorted = data.results.sort((a, b) => a.name.localeCompare(b.name));
        setCompanies(sorted);
        setCache(cacheKey, sorted);
      })
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
        invalidatePrefix('job-data:');
        invalidatePrefix('company-data:'); // job_count per company changed
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
        invalidatePrefix('job-data:');
        invalidatePrefix('company-data:');
      } else {
        alert('Failed to delete jobs');
      }
    } catch (error) {
      alert('Failed to delete jobs');
    } finally {
      setBulkDeleting(false);
    }
  };

  const openGeocodeMenu = () => {
    setGeocodeMenuOpen(prev => !prev);
    if (missingCoordsCompanies !== null || loadingMissingCoords) return;
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setLoadingMissingCoords(true);
    fetch(`${API_BASE}/admin/jobs/missing-coordinates/`, { headers: { Authorization: `Token ${token}` } })
      .then(res => (res.ok ? res.json() : []))
      .then((data: MissingCoordsCompany[]) => setMissingCoordsCompanies(data))
      .catch(() => setMissingCoordsCompanies([]))
      .finally(() => setLoadingMissingCoords(false));
  };

  const runGeocode = async (company: string | null) => {
    if (geocoding) return;
    if (!company && !window.confirm(
      'Running with no company selected will geocode every company with missing coordinates. ' +
      'This can take a long time and may get rate-limited by Nominatim. Continue?'
    )) return;

    setGeocodeMenuOpen(false);
    const token = localStorage.getItem('admin_token');
    setGeocodeTarget(company);
    setGeocoding(true);
    setGeocodeLogs([]);
    setGeocodeResult(null);

    try {
      const res = await fetch(`${API_BASE}/admin/run-geocode/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ company }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGeocodeResult({ ok: false, error: data.error || 'Failed to start geocoding.' });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setGeocodeResult({ ok: false, error: 'Streaming is not supported by this browser.' });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      const logs: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === 'log') {
            logs.push(event.message);
            setGeocodeLogs([...logs]);
          } else if (event.type === 'result') {
            const { type: _type, ...result } = event;
            setGeocodeResult(result as GeocodeResult);
          }
        }
      }

      invalidatePrefix('job-data:');
      fetchJobs(true);
      setMissingCoordsCompanies(null); // stale after a run — refetched next time the menu opens
    } catch (error) {
      setGeocodeResult({ ok: false, error: 'Failed to reach the server.' });
    } finally {
      setGeocoding(false);
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
              {count.toLocaleString()} job{count !== 1 ? 's' : ''}
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
              onClick={() => fetchJobs(true)}
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all"
              title="Refresh"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            <div className="relative">
              <button
                onClick={openGeocodeMenu}
                disabled={geocoding}
                className="cursor-pointer bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 transition-all"
              >
                {geocoding ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />}
                Run Geocode
              </button>

              {geocodeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setGeocodeMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 z-50 bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#2a2a2a] text-[10px] font-black uppercase tracking-[0.2em] text-[#666]">
                      Companies missing coordinates
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {loadingMissingCoords ? (
                        <div className="px-4 py-6 flex justify-center">
                          <Loader2 size={18} className="animate-spin text-[#555]" />
                        </div>
                      ) : !missingCoordsCompanies || missingCoordsCompanies.length === 0 ? (
                        <p className="px-4 py-6 text-xs text-[#555] text-center">Every company is fully geocoded.</p>
                      ) : (
                        missingCoordsCompanies.map(c => (
                          <button
                            key={c.company}
                            onClick={() => runGeocode(c.company)}
                            className="cursor-pointer w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#1f1f1f] transition-colors border-b border-[#222] last:border-0"
                          >
                            <span className="text-sm font-semibold truncate">{c.company}</span>
                            <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-orange-500/10 text-orange-400">
                              {c.missing.toLocaleString()} / {c.total.toLocaleString()} missing
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      onClick={() => runGeocode(null)}
                      className="cursor-pointer w-full px-4 py-3 text-left text-sm font-semibold text-purple-400 hover:bg-[#1f1f1f] transition-colors border-t border-[#2a2a2a]"
                    >
                      Run on all companies
                    </button>
                  </div>
                </>
              )}
            </div>

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

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <JobStatTile
              icon={<Briefcase size={16} className="text-blue-500" />}
              label="Total Jobs"
              value={count.toLocaleString()}
            />
            <JobStatTile
              icon={<MapPin size={16} className="text-purple-500" />}
              label="With Coordinates"
              value={stats.with_coordinates.toLocaleString()}
              sub={count > 0 ? `${Math.round((stats.with_coordinates / count) * 100)}% of total` : undefined}
            />
            <JobStatTile
              icon={<Calendar size={16} className="text-green-500" />}
              label="Last Posted"
              value={formatDate(stats.most_recent_posted)}
              sub={daysAgo(stats.most_recent_posted) ?? undefined}
            />
            <JobStatTile
              icon={<History size={16} className="text-orange-500" />}
              label="Oldest Job Found"
              value={formatDate(stats.oldest_posted)}
              sub={daysAgo(stats.oldest_posted) ?? undefined}
            />
          </div>
        )}

        {(geocoding || geocodeLogs.length > 0 || geocodeResult) && (
          <div className="bg-[#111] border border-[#222] rounded-3xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Crosshair size={16} className="text-purple-500" />
                Geocode Run{geocodeTarget ? ` — ${geocodeTarget}` : ' — All Companies'}
              </h2>
              {!geocoding && (
                <button
                  onClick={() => { setGeocodeLogs([]); setGeocodeResult(null); }}
                  className="cursor-pointer text-[#666] hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {geocodeLogs.length > 0 && (
              <div className="h-48 overflow-y-auto rounded-xl border border-[#222] bg-[#0a0a0a] p-4 font-mono text-xs text-[#888] space-y-1">
                {geocodeLogs.map((line, i) => <div key={i}>{line}</div>)}
              </div>
            )}

            {geocodeResult && (
              <div className={`mt-4 rounded-xl border p-4 text-sm ${geocodeResult.ok ? 'border-[#222] bg-[#0a0a0a]' : 'border-red-500/30 bg-red-500/5'}`}>
                {geocodeResult.ok ? (
                  <div className="text-[#ccc] space-y-1">
                    <div>{geocodeResult.geocoded} geocoded · {geocodeResult.borrowed} borrowed from a company sibling · {geocodeResult.remaining} still missing</div>
                    {geocodeResult.rate_limited && (
                      <div className="text-orange-400">Nominatim started rate-limiting requests — stopped early. Retry later to pick up where this left off.</div>
                    )}
                  </div>
                ) : (
                  <div className="text-red-400">{geocodeResult.error}</div>
                )}
              </div>
            )}
          </div>
        )}

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
                        <Checkbox
                          checked={jobs.length > 0 && jobs.every(j => selectedIds.has(j.id))}
                          indeterminate={selectedIds.size > 0 && !jobs.every(j => selectedIds.has(j.id))}
                          onChange={(checked) => setSelectedIds(checked ? new Set(jobs.map(j => j.id)) : new Set())}
                          accent="blue"
                          title={selectedIds.size > 0 ? 'Deselect all' : 'Select all'}
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
                          onClick={() => setSelectedJob(job)}
                          className={`cursor-pointer hover:bg-[#161616]/30 transition-colors ${selectedIds.has(job.id) ? 'bg-blue-500/5' : ''}`}
                        >
                          <td className="px-6 py-5" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(job.id)}
                              onChange={() => toggleSelect(job.id)}
                              accent="blue"
                              title={selectedIds.has(job.id) ? 'Deselect' : 'Select'}
                            />
                          </td>
                          <td className="px-6 py-5">
                            <div className="font-semibold text-white truncate max-w-[260px]">{job.title}</div>
                            {job.job_type && <div className="text-xs text-[#555] mt-0.5">{job.job_type}</div>}
                          </td>
                          <td className="px-6 py-5" onClick={(e) => e.stopPropagation()}>
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
                          <td className="px-6 py-5 text-nowrap" onClick={(e) => e.stopPropagation()}>
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
                            <span className="px-2.5 py-1 rounded-full bg-[#1a1a1a] text-[#888] text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                              {job.category}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-sm text-[#666]">
                            {job.date_posted
                              ? new Date(job.date_posted).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : new Date(job.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
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
                    {selectedCompany || search ? 'No jobs match your filters.' : 'No jobs yet.'}
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

      <AnimatePresence>
        {selectedJob && (
          <React.Fragment key="job-detail">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedJob(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.15 }}
              className="fixed z-50 inset-0 m-auto h-fit max-h-[85vh] w-full max-w-2xl overflow-y-auto bg-[#111] border border-[#222] rounded-3xl shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 px-8 py-6 border-b border-[#222] sticky top-0 bg-[#111]/95 backdrop-blur">
                <div className="flex items-center gap-4 min-w-0">
                  {selectedJob.company_logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedJob.company_logo}
                      alt={selectedJob.company}
                      className="w-12 h-12 rounded-xl object-cover bg-[#1a1a1a] shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] flex items-center justify-center shrink-0">
                      <Briefcase size={20} className="text-[#555]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-white truncate">{selectedJob.title}</h2>
                    <p className="text-sm text-[#888] truncate">{selectedJob.company}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="cursor-pointer p-2 rounded-xl bg-[#1a1a1a] hover:bg-[#222] transition-all text-[#888] hover:text-white shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-8 py-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
                  <DetailField label="ID" value={selectedJob.id} mono />
                  <DetailField label="ID from site" value={selectedJob.id_from_site} mono />
                  <DetailField label="Category" value={selectedJob.category} />
                  <DetailField label="Job type" value={selectedJob.job_type} />
                  <DetailField label="Remote" value={selectedJob.is_remote ? 'Yes' : 'No'} />
                  <DetailField label="Experience required" value={selectedJob.experience_required} />
                  <DetailField label="Salary" value={selectedJob.salary} />
                  <DetailField label="Location" value={selectedJob.location_name} />
                  <DetailField label="City" value={selectedJob.city} />
                  <DetailField label="State" value={selectedJob.state} />
                  <DetailField label="Country" value={selectedJob.country} />
                  <DetailField
                    label="Coordinates"
                    value={selectedJob.latitude != null && selectedJob.longitude != null
                      ? `${selectedJob.latitude.toFixed(5)}, ${selectedJob.longitude.toFixed(5)}`
                      : null}
                    mono
                  />
                  <DetailField
                    label="Date posted"
                    value={selectedJob.date_posted
                      ? new Date(selectedJob.date_posted).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : null}
                  />
                  <DetailField label="Created at" value={formatDateTime(selectedJob.created_at)} />
                  <DetailField
                    label="Site"
                    value={selectedJob.site && (
                      <a href={selectedJob.site} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline break-all">
                        {selectedJob.site}
                      </a>
                    )}
                  />
                  <DetailField
                    label="Job URL"
                    value={selectedJob.job_url && (
                      <a href={selectedJob.job_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:underline break-all">
                        Open posting <ExternalLink size={12} className="shrink-0" />
                      </a>
                    )}
                  />
                </div>

                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#555] mb-2">Description</div>
                  <div className="text-sm text-[#ccc] whitespace-pre-wrap leading-relaxed bg-[#161616] border border-[#222] rounded-2xl p-4 max-h-72 overflow-y-auto">
                    {selectedJob.description || <span className="text-[#3a3a3a]">No description saved.</span>}
                  </div>
                </div>
              </div>
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </div>
  );
}
