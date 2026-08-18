'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Map as MapIcon, List, Monitor, Bookmark } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { JobCard } from '@/components/JobCard';
import Map from '@/components/Map';
import { useAuth } from '@/context/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import PricingModal from '@/components/PricingModal';

const PRICING_MODAL_SEEN_KEY = 'explore_pricing_modal_seen';

const CACHE_TTL = 2 * 60 * 1000;
const _cache: Record<string, { data: any; ts: number }> = {};

function getCached(key: string) {
  const entry = _cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: any) {
  _cache[key] = { data, ts: Date.now() };
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const PANEL_WIDTH_KEY = 'explore_panel_width';
const MIN_PANEL_WIDTH = 480;
const MAX_PANEL_WIDTH = 720;

// Desktop-only drag-to-resize for the job list panel next to the map.
function useResizablePanel() {
  const asideRef = useRef<HTMLElement>(null);
  const widthRef = useRef(420);
  const [panelWidth, setPanelWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const stored = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    if (stored) {
      const clamped = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, stored));
      widthRef.current = clamped;
      setPanelWidth(clamped);
    }

    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    // Raw mousemove can fire far more often than the screen can repaint (some
    // mice poll at 1000Hz). Driving setState from every event re-renders the
    // whole page — including the map — faster than it can redraw, which is
    // what shows up as blinking. Coalescing to one update per animation
    // frame keeps it at a smooth, steady rate instead.
    let rafId: number | null = null;
    let pendingX: number | null = null;

    const applyPending = () => {
      rafId = null;
      if (pendingX === null || !asideRef.current) return;
      const left = asideRef.current.getBoundingClientRect().left;
      const next = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, pendingX - left));
      widthRef.current = next;
      setPanelWidth(next);
    };

    const handleMouseMove = (e: MouseEvent) => {
      pendingX = e.clientX;
      if (rafId === null) rafId = requestAnimationFrame(applyPending);
    };
    const handleMouseUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      setIsResizing(false);
      localStorage.setItem(PANEL_WIDTH_KEY, String(widthRef.current));
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return {
    asideRef,
    panelWidth,
    isDesktop,
    isResizing,
    startResizing: () => setIsResizing(true),
  };
}

export default function ExplorePage() {
  const { token, logout } = useAuth();
  const { isReady, isSubscribed } = useSubscriptionGate({ allowUnsubscribed: true });
  const { asideRef, panelWidth, isDesktop, isResizing, startResizing } = useResizablePanel();

  // Non-subscribers get a capped, recent-jobs preview (server-enforced) instead
  // of being redirected away — but they see the pricing pitch once per browser.
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  useEffect(() => {
    if (!isReady || isSubscribed) return;
    if (localStorage.getItem(PRICING_MODAL_SEEN_KEY)) return;
    setIsPricingOpen(true);
  }, [isReady, isSubscribed]);

  const handleClosePricingModal = () => {
    localStorage.setItem(PRICING_MODAL_SEEN_KEY, '1');
    setIsPricingOpen(false);
  };

  const [jobs, setJobs] = useState<any[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [mapPins, setMapPins] = useState<any[]>([]);
  const [pinnedJob, setPinnedJob] = useState<any | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [jobCategories, setJobCategories] = useState<string[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split');
  const [activeCountry, setActiveCountry] = useState<string>('All');

  const [remoteOnly, setRemoteOnly] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFetchingJobs, setIsFetchingJobs] = useState(false);
  const jobsPerPage = 20;

  const debouncedSearch = useDebounce(searchQuery, 300);
  const debouncedLocation = useDebounce(locationQuery, 300);

  const mapJobFields = (job: any) => ({
    ...job,
    location: job.location_name,
  });

  const filterParams = React.useMemo(() => {
    const params = new URLSearchParams();
    if (activeCountry !== 'All') params.set('country', activeCountry);
    if (selectedCategory !== 'All') params.set('category', selectedCategory);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (debouncedLocation) params.set('location', debouncedLocation);
    if (remoteOnly) params.set('is_remote', 'true');
    if (bookmarkedOnly) params.set('bookmarked_only', 'true');
    return params;
  }, [activeCountry, selectedCategory, debouncedSearch, debouncedLocation, remoteOnly, bookmarkedOnly]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, debouncedLocation, activeCountry, selectedCategory, remoteOnly, bookmarkedOnly]);

  // Fetch countries + categories once on mount
  useEffect(() => {
    const fetchMeta = async () => {
      if (!token) return;
      try {
        const cachedCountries = getCached('countries');
        if (cachedCountries) {
          setCountries(cachedCountries);
        } else {
          const countriesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/countries/`);
          if (countriesRes.ok) {
            const data = await countriesRes.json();
            setCache('countries', data);
            setCountries(data);
          }
        }

        const cachedCategories = getCached('categories');
        if (cachedCategories) {
          setJobCategories(cachedCategories);
        } else {
          const categoriesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories/`);
          if (categoriesRes.ok) {
            const data = await categoriesRes.json();
            setCache('categories', data);
            setJobCategories(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch meta:', error);
      }
    };
    fetchMeta();
  }, [token]);

  // Re-fetch the current page whenever filters or the page change — backend
  // paginates and filters at the DB level, so only ~20 jobs cross the wire.
  useEffect(() => {
    const fetchJobs = async () => {
      if (!token) return;
      const params = new URLSearchParams(filterParams);
      params.set('page', String(currentPage));
      const cacheKey = `jobs-${params.toString()}`;
      const cached = getCached(cacheKey);
      if (cached) {
        setJobs(cached.results);
        setTotalJobs(cached.count);
        return;
      }
      setIsFetchingJobs(true);
      try {
        const jobsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/jobs/?${params}`,
          { headers: { 'Authorization': `Token ${token}` } }
        );
        if (jobsRes.status === 401) { logout(); return; }
        if (!jobsRes.ok) return;
        const jobsData = await jobsRes.json();
        const jobsList = Array.isArray(jobsData) ? jobsData : (jobsData.results || []);
        const mapped = jobsList.map(mapJobFields);
        const payload = { results: mapped, count: jobsData.count ?? mapped.length };
        setCache(cacheKey, payload);
        setJobs(payload.results);
        setTotalJobs(payload.count);
      } catch (error) {
        console.error('Failed to fetch jobs:', error);
      } finally {
        setIsFetchingJobs(false);
      }
    };
    fetchJobs();
  }, [token, currentPage, filterParams]);

  // Map pins: independent of the list's page — the map needs every matching
  // job's coordinates at once to render, so it hits its own lightweight endpoint.
  useEffect(() => {
    const fetchMapPins = async () => {
      if (!token) return;
      const cacheKey = `map-pins-${filterParams.toString()}`;
      const cached = getCached(cacheKey);
      if (cached) {
        setMapPins(cached);
        return;
      }
      try {
        const pinsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/jobs/map_pins/?${filterParams}`,
          { headers: { 'Authorization': `Token ${token}` } }
        );
        if (pinsRes.status === 401) { logout(); return; }
        if (!pinsRes.ok) return;
        const pinsData = await pinsRes.json();
        const mapped = (pinsData || []).map(mapJobFields);
        setCache(cacheKey, mapped);
        setMapPins(mapped);
      } catch (error) {
        console.error('Failed to fetch map pins:', error);
      }
    };
    fetchMapPins();
  }, [token, filterParams]);

  const countryOptions = React.useMemo(() => ['All', ...Array.from(new Set(countries.map(country => {
    if (country === 'United States') return 'USA';
    if (country === 'United Kingdom') return 'UK';
    return country;
  })))], [countries]);

  // Jobs/pins are already filtered server-side (country, search, location,
  // remote, bookmarked) — no client-side re-filtering needed here anymore.

  const handleMapJobClick = React.useCallback(async (jobId: string | null) => {
    if (!jobId) {
      setSelectedJobId(null);
      setPinnedJob(null);
      return;
    }
    setSelectedJobId(jobId);
    if (viewMode === 'map') {
      setViewMode('split');
    }
    // Map pins and the paginated list are separate datasets, so a clicked pin
    // may not be on the currently loaded page — fetch it directly if so.
    if (jobs.some(j => j.id === jobId)) {
      setPinnedJob(null);
      return;
    }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}/`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) return;
      const data = await res.json();
      setPinnedJob(mapJobFields(data));
    } catch (error) {
      console.error('Failed to fetch job:', error);
    }
  }, [jobs, viewMode, token]);

  useEffect(() => {
    if (selectedJobId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`job-card-${selectedJobId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedJobId, currentPage, viewMode]);

  const handleJobClick = React.useCallback((jobId: string) => {
    setSelectedJobId(jobId);
  }, []);

  const handleToggleBookmark = React.useCallback(async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    if (!token) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}/toggle_bookmark/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setJobs(prevJobs => prevJobs.map(j =>
          j.id === jobId ? { ...j, is_bookmarked: data.is_bookmarked } : j
        ));
        setPinnedJob((prev: any) => (prev && prev.id === jobId ? { ...prev, is_bookmarked: data.is_bookmarked } : prev));
      }
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
    }
  }, [token]);

  if (!isReady) {
    return (
      <div className="h-screen bg-[#f2f3f5] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#16a34a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalJobs / jobsPerPage));
  // Pinned job (from a map-pin click not on the current page) shown first, deduped.
  const displayJobs = pinnedJob ? [pinnedJob, ...jobs.filter(j => j.id !== pinnedJob.id)] : jobs;

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { 
      y: 20, 
      opacity: 0,
      scale: 0.98
    },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20
      }
    }
  };

  return (
    <main className="h-screen flex bg-[#f2f3f5] overflow-hidden relative">
      {/* Desktop nav rail - replaces the old header nav links (Custom CV, Billing, Profile, Logout) */}
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header - Always visible for navigation/logout */}
      <PageHeader backHref="/dashboard" title="Explore" wordmark>
        <div className="w-px h-6 bg-black/[0.08] mx-1 sm:mx-2" />
        {/* View Toggles - Always visible */}
        <div className="flex items-center gap-1 sm:gap-2 bg-white rounded-full p-1 border border-black/[0.08] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
          <button
            onClick={() => setViewMode('split')}
            className={`cursor-pointer p-1 sm:p-1.5 rounded-full transition-all hidden md:block ${viewMode === 'split' ? 'bg-[#16a34a] text-white' : 'text-black/40 hover:text-black/70'}`}
            title="Split View"
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`cursor-pointer p-1 sm:p-1.5 rounded-full transition-all md:hidden ${viewMode === 'list' ? 'bg-[#16a34a] text-white' : 'text-black/40 hover:text-black/70'}`}
            title="List View"
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`cursor-pointer p-1 sm:p-1.5 rounded-full transition-all ${viewMode === 'map' ? 'bg-[#16a34a] text-white' : 'text-black/40 hover:text-black/70'}`}
            title="Map View"
          >
            <MapIcon size={14} />
          </button>
        </div>

        {/* Mobile sidebar toggle - desktop uses the always-visible left sidebar instead */}
        <div className="w-px h-6 bg-black/[0.08] mx-1 sm:mx-2 md:hidden" />
      </PageHeader>

      {isReady && !isSubscribed && (
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2 bg-[#16a34a]/10 border-b border-[#16a34a]/20">
          <span className="text-[10px] sm:text-[11px] text-[#15803d] font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            You're viewing a preview of recent jobs. Subscribe to unlock the full map and job list.
          </span>
          <button
            onClick={() => setIsPricingOpen(true)}
            className="cursor-pointer shrink-0 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold text-white transition-transform hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(180deg,#4ade80,#16a34a 55%,#15803d)', fontFamily: 'var(--font-outfit)' }}
          >
            Unlock
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Job list sidebar */}
        <aside
          ref={asideRef}
          style={isDesktop ? { width: panelWidth } : undefined}
          className={`${viewMode === 'map' ? 'hidden' : 'flex'} w-full md:w-auto flex-col border-r border-black/[0.08] bg-white z-10 shrink-0 ${isResizing ? '' : 'transition-[width] duration-150'}`}
        >

          {/* Search Area */}
          <div className="p-4 sm:p-5 border-b border-black/[0.08] bg-white">
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <div className="bg-[#fafafa] border border-black/[0.08] rounded-2xl flex-1 flex flex-col overflow-hidden focus-within:border-[#16a34a]/40 transition-all">
                <div className="h-12 sm:h-14 flex items-center px-4">
                  <Search className="text-black/35 shrink-0 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Job title, keywords, or company"
                    className="bg-transparent border-none outline-none ring-0 focus:ring-0 text-xs sm:text-sm text-[#0b0b0c] placeholder-black/35 flex-1 ml-3"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="w-full h-px bg-black/[0.08]" />
                <div className="h-12 sm:h-14 flex items-center px-4">
                  <MapIcon className="text-black/35 shrink-0 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="City, state, zip code, or remote"
                    className="bg-transparent border-none outline-none ring-0 focus:ring-0 text-xs sm:text-sm text-[#0b0b0c] placeholder-black/35 w-full ml-3"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick Categories Vertical Scrollable List - Fixed height */}
              <div className="h-12 sm:h-[116px] w-full sm:w-[140px] flex flex-row sm:flex-col border border-black/[0.08] rounded-2xl bg-[#fafafa] overflow-hidden">
                <div className="flex-1 flex flex-row sm:flex-col overflow-x-auto sm:overflow-y-auto no-scrollbar p-1.5 gap-1 sm:space-y-0.5">
                  <button
                    onClick={() => setSelectedCategory('All')}
                    className={`shrink-0 sm:w-full text-left px-2.5 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-semibold transition-all border ${
                      selectedCategory === 'All'
                        ? 'bg-[#16a34a]/10 text-[#16a34a] border-[#16a34a]/25'
                        : 'bg-transparent text-black/45 border-transparent hover:bg-white hover:text-black/70'
                    }`}
                    style={{ fontFamily: 'var(--font-outfit)' }}
                  >
                    All Categories
                  </button>
                  {jobCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`shrink-0 sm:w-full text-left px-2.5 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-semibold transition-all border truncate ${
                        selectedCategory === category
                          ? 'bg-[#16a34a]/10 text-[#16a34a] border-[#16a34a]/25'
                          : 'bg-transparent text-black/45 border-transparent hover:bg-white hover:text-black/70'
                      }`}
                      style={{ fontFamily: 'var(--font-outfit)' }}
                      title={category}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Category Filters */}
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-black/[0.08] bg-white flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
              {countryOptions.map((country) => (
                <button
                  key={country}
                  onClick={() => setActiveCountry(country)}
                  className={`cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-[11px] font-semibold transition-all duration-300 border whitespace-nowrap ${
                    activeCountry === country
                      ? 'bg-[#0b0b0c] text-white border-[#0b0b0c]'
                      : 'bg-black/[0.03] text-black/50 border-black/[0.08] hover:border-black/20 hover:text-black/80'
                  }`}
                  style={{ fontFamily: 'var(--font-outfit)' }}
                >
                  {country}
                </button>
              ))}

            </div>

            <div className="w-px h-4 bg-black/[0.08] shrink-0" />

            <button
              onClick={() => setRemoteOnly(!remoteOnly)}
              className={`cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-[11px] font-semibold flex items-center gap-1.5 sm:gap-2 transition-all duration-300 border whitespace-nowrap shrink-0 ${
                remoteOnly
                  ? 'bg-[#16a34a] text-white border-[#16a34a]'
                  : 'bg-black/[0.03] text-black/50 border-black/[0.08] hover:border-black/20 hover:text-black/80'
              }`}
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              <Monitor className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              Remote
            </button>

            <button
              onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
              className={`cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-[11px] font-semibold flex items-center gap-1.5 sm:gap-2 transition-all duration-300 border whitespace-nowrap shrink-0 ${
                bookmarkedOnly
                  ? 'bg-[#16a34a] text-white border-[#16a34a]'
                  : 'bg-black/[0.03] text-black/50 border-black/[0.08] hover:border-black/20 hover:text-black/80'
              }`}
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              <Bookmark className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill={bookmarkedOnly ? "currentColor" : "none"} />
              <span className="hidden sm:inline">Bookmarks</span>
            </button>
          </div>
          
          <AnimatePresence mode="wait">
            {isFetchingJobs ? (
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-6 rounded-[20px] border border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]">
                    <div className="flex gap-5 items-start">
                      <div className="flex flex-col items-center shrink-0 gap-3">
                        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-black/[0.05] animate-pulse" />
                        <div className="w-full h-8 rounded-xl bg-black/[0.05] animate-pulse" />
                        <div className="w-full h-8 rounded-xl bg-black/[0.05] animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="h-4 bg-black/[0.05] rounded-lg animate-pulse w-3/4" />
                        <div className="h-3 bg-black/[0.05] rounded-lg animate-pulse w-1/2" />
                        <div className="flex gap-2">
                          <div className="h-5 w-24 bg-black/[0.05] rounded-full animate-pulse" />
                          <div className="h-5 w-16 bg-black/[0.05] rounded-full animate-pulse" />
                          <div className="h-5 w-20 bg-black/[0.05] rounded-full animate-pulse" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-3 bg-black/[0.05] rounded animate-pulse w-full" />
                          <div className="h-3 bg-black/[0.05] rounded animate-pulse w-5/6" />
                        </div>
                        <div className="flex justify-between pt-2">
                          <div className="h-3 w-28 bg-black/[0.05] rounded animate-pulse" />
                          <div className="h-3 w-16 bg-black/[0.05] rounded animate-pulse" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <motion.div
              key={`${currentPage}-${debouncedSearch}-${debouncedLocation}-${activeCountry}-${selectedCategory}-${remoteOnly}-${bookmarkedOnly}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className={`flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar ${isFetchingJobs ? 'hidden' : ''}`}
            >
              {displayJobs.map(job => (
                <motion.div 
                  key={job.id} 
                  variants={itemVariants}
                  id={`job-card-${job.id}`}
                  className="w-full"
                >
                  <JobCard 
                    job={job} 
                    isSelected={selectedJobId === job.id}
                    onClick={handleJobClick}
                    onToggleBookmark={handleToggleBookmark}
                  />
                </motion.div>
              ))}
              
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-6 pb-2 px-2 border-t border-black/[0.08] mt-4">
                  <button
                    onClick={() => {
                      setCurrentPage(p => Math.max(1, p - 1));
                      document.querySelector('.flex-1.overflow-y-auto')?.scrollTo(0, 0);
                    }}
                    disabled={currentPage === 1}
                    className="cursor-pointer px-4 py-2 rounded-full text-xs font-semibold bg-white text-black/50 border border-black/[0.10] hover:text-[#0b0b0c] hover:border-black/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]"
                    style={{ fontFamily: 'var(--font-outfit)' }}
                  >
                    Previous
                  </button>
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-[#0b0b0c] font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <span className="text-[10px] text-black/40 font-medium mt-0.5" style={{ fontFamily: 'var(--font-outfit)' }}>
                      {totalJobs} total jobs
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setCurrentPage(p => Math.min(totalPages, p + 1));
                      document.querySelector('.flex-1.overflow-y-auto')?.scrollTo(0, 0);
                    }}
                    disabled={currentPage === totalPages}
                    className="cursor-pointer px-4 py-2 rounded-full text-xs font-semibold bg-white text-black/50 border border-black/[0.10] hover:text-[#0b0b0c] hover:border-black/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)]"
                    style={{ fontFamily: 'var(--font-outfit)' }}
                  >
                    Next
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </aside>

        {/* Drag handle — desktop split view only */}
        {viewMode === 'split' && (
          <div
            onMouseDown={startResizing}
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize"
            className="hidden md:flex w-1.5 shrink-0 cursor-col-resize items-center justify-center group relative z-20"
          >
            <div className={`w-px h-full transition-colors ${isResizing ? 'bg-[#16a34a]' : 'bg-black/[0.08] group-hover:bg-[#16a34a]/50'}`} />
          </div>
        )}

        {/* Map Area */}
        <section className={`${viewMode === 'list' ? 'hidden' : 'flex'} flex-1 bg-[#f2f3f5]`}>
          <Map
            jobs={mapPins}
            selectedJobId={selectedJobId || undefined}
            onJobClick={handleMapJobClick}
          />
        </section>
      </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.25);
        }
      `}</style>

      <PricingModal isOpen={isPricingOpen} onClose={handleClosePricingModal} />
    </main>
  );
}
