'use client';

import React, { useState, useEffect } from 'react';
import { Search, Map as MapIcon, List, Filter, SlidersHorizontal, ChevronDown, Monitor, ArrowLeft, LogOut, User as UserIcon, Bookmark, CreditCard } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { JobCard } from '@/components/JobCard';
import Map from '@/components/Map';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import PricingModal from '@/components/PricingModal';


export default function ExplorePage() {
  const { user, token, logout, isLoading, refreshUser } = useAuth();

  const router = useRouter();
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [jobRoles, setJobRoles] = useState<string[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split');
  const [activeCountry, setActiveCountry] = useState<string>('All');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 20;

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login');
    }
  }, [token, isLoading, router]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, locationQuery, activeCountry, remoteOnly, bookmarkedOnly]);

  useEffect(() => {
    const fetchData = async () => {
      if (!token || !user?.is_subscribed) return;
      
      try {
        const [jobsRes, locsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/`, {
            headers: { 'Authorization': `Token ${token}` }
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/locations/`, {
            headers: { 'Authorization': `Token ${token}` }
          })
        ]);
        
        if (!jobsRes.ok || !locsRes.ok) {
           if (jobsRes.status === 401 || locsRes.status === 401) {
             logout();
           } else if (jobsRes.status === 403 || locsRes.status === 403) {
             // Backend says not subscribed, sync local state
             refreshUser?.();
             setIsPricingModalOpen(true);
           }
           return;
        }

        
        const jobsData = await jobsRes.json();
        const locsData = await locsRes.json();
        
        const processedJobs = jobsData.map((job: any) => ({
          ...job,
          location: job.location_name
        }));
        
        setJobs(processedJobs);
        setLocations(locsData);

        // Fetch roles
        const rolesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/roles/`);
        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          setJobRoles(rolesData);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };
    fetchData();
  }, [token, user?.is_subscribed, logout]);

  const countries = React.useMemo(() => ['All', ...Array.from(new Set(locations.map(loc => {
    if (loc.country === 'United States') return 'USA';
    if (loc.country === 'United Kingdom') return 'UK';
    return loc.country;
  })))], [locations]);

  const filteredJobs = React.useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           job.company.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLocation = job.location.toLowerCase().includes(locationQuery.toLowerCase());
      const matchesRemote = remoteOnly ? job.is_remote : true;
      
      // Country logic
      let matchesCountry = activeCountry === 'All';
      if (!matchesCountry) {
        if (activeCountry === 'India') matchesCountry = job.location.includes('India') || job.location.includes('IN');
        else if (activeCountry === 'USA') matchesCountry = job.location.includes('USA') || job.location.includes('US') || job.location.includes('United States');
        else if (activeCountry === 'UK') matchesCountry = job.location.includes('UK') || job.location.includes('GB') || job.location.includes('United Kingdom');
        else matchesCountry = job.location.includes(activeCountry);
      }
      
      const matchesBookmarked = bookmarkedOnly ? job.is_bookmarked : true;
      
      return matchesSearch && matchesLocation && matchesRemote && matchesCountry && matchesBookmarked;
    });
  }, [jobs, searchQuery, locationQuery, activeCountry, remoteOnly, bookmarkedOnly]);

  const handleMapJobClick = React.useCallback((jobId: string | null) => {
    if (jobId) {
      const jobIndex = filteredJobs.findIndex(j => j.id === jobId);
      if (jobIndex !== -1) {
        const page = Math.floor(jobIndex / jobsPerPage) + 1;
        setCurrentPage(page);
      }
      setSelectedJobId(jobId);
      if (viewMode === 'map') {
        setViewMode('split');
      }
    } else {
      setSelectedJobId(null);
    }
  }, [filteredJobs, viewMode]);

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

  if (isLoading || !token) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalPages = Math.ceil(filteredJobs.length / jobsPerPage);
  const currentJobs = filteredJobs.slice((currentPage - 1) * jobsPerPage, currentPage * jobsPerPage);

  
  
  const handleToggleBookmark = async (e: React.MouseEvent, jobId: string) => {
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
        // Update local state
        setJobs(prevJobs => prevJobs.map(j => 
          j.id === jobId ? { ...j, is_bookmarked: data.is_bookmarked } : j
        ));
      } else if (response.status === 403) {
        alert("Only subscribed users can bookmark jobs.");
      }
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
    }
  };

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
    <main className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden relative">
      {/* Header - Always visible for navigation/logout */}
      <header className="h-16 border-b border-[#222] px-4 sm:px-6 flex items-center justify-between glass z-20 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 flex-1 overflow-hidden">
          <Link href="/" className="group flex items-center gap-1.5 sm:gap-2 text-[#555] hover:text-white transition-colors mr-1 sm:mr-2 shrink-0">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] hidden sm:inline">Back</span>
          </Link>
          <div className="w-px h-4 bg-[#222] mr-1 sm:mr-2 shrink-0" />
          <h1 className="hidden sm:inline text-lg sm:text-xl font-black tracking-tighter text-white mr-2 sm:mr-4 cursor-default truncate">KAAMLEE</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Subscription Status - Hidden on small mobile */}

          {user?.is_subscribed && (
            <Link 
              href="/transactions"
              className="flex items-center gap-2 text-[#888] hover:text-white transition-colors group mr-2"
              title="Billing History"
            >
                <CreditCard size={20} />
            </Link>
          )}

          <div className="w-px h-6 bg-[#222] mx-1 sm:mx-2" />
          {/* View Toggles - Always visible */}
          <div className="flex items-center gap-1 sm:gap-2 bg-[#161616] rounded-full p-1 border border-[#222]">
            <button 
              onClick={() => setViewMode('split')}
              className={`cursor-pointer p-1 sm:p-1.5 rounded-full transition-all hidden md:block ${viewMode === 'split' ? 'bg-[#22c55e] text-white' : 'text-[#555] hover:text-[#888]'}`}
              title="Split View"
            >
              <List size={14} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`cursor-pointer p-1 sm:p-1.5 rounded-full transition-all md:hidden ${viewMode === 'list' ? 'bg-[#22c55e] text-white' : 'text-[#555] hover:text-[#888]'}`}
              title="List View"
            >
              <List size={14} />
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`cursor-pointer p-1 sm:p-1.5 rounded-full transition-all ${viewMode === 'map' ? 'bg-[#22c55e] text-white' : 'text-[#555] hover:text-[#888]'}`}
              title="Map View"
            >
              <MapIcon size={14} />
            </button>
          </div>

          <div className="w-px h-6 bg-[#222] mx-1 sm:mx-2" />

          <button 
            onClick={logout}
            className="cursor-pointer flex items-center gap-2 text-[#888] hover:text-white transition-colors text-sm font-medium group"
          >
            <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
            <span className="hidden lg:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area - Blurred if not subscribed */}
      <div className={`flex-1 flex overflow-hidden transition-all duration-700 ${!user?.is_subscribed ? 'blur-3xl grayscale pointer-events-none select-none' : ''}`}>
        {/* Sidebar */}
        <aside className={`${viewMode === 'map' ? 'hidden' : 'flex'} w-full md:w-[450px] flex-col border-r border-[#222] bg-[#0a0a0a] z-10 shrink-0`}>
          
          {/* Search Area */}
          <div className="p-3 sm:p-4 border-b border-[#222] bg-[#0a0a0a]">
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <div className="bg-[#161616] border border-[#222] rounded-2xl flex-1 shadow-inner flex flex-col overflow-hidden focus-within:border-[#22c55e]/50 transition-all">
                <div className="h-10 sm:h-12 flex items-center px-3">
                  <Search className="text-[#555] shrink-0 ml-1 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <input 
                    type="text" 
                    placeholder="Job title, keywords, or company"
                    className="bg-transparent border-none outline-none ring-0 focus:ring-0 text-[10px] sm:text-xs text-white placeholder-[#555] flex-1 ml-2 sm:ml-3"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="w-full h-px bg-[#222]" />
                <div className="h-10 sm:h-12 flex items-center px-3">
                  <MapIcon className="text-[#555] shrink-0 ml-1 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <input 
                    type="text" 
                    placeholder="City, state, zip code, or remote"
                    className="bg-transparent border-none outline-none ring-0 focus:ring-0 text-[10px] sm:text-xs text-white placeholder-[#555] w-full ml-2 sm:ml-3"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick Roles Vertical Scrollable List - Fixed height */}
              <div className="h-10 sm:h-[100px] w-full sm:w-[130px] flex flex-row sm:flex-col border border-[#222] rounded-2xl bg-[#080808] overflow-hidden">
                <div className="flex-1 flex flex-row sm:flex-col overflow-x-auto sm:overflow-y-auto no-scrollbar p-1 gap-1 sm:space-y-0.5 bg-black/40">
                  <button
                    onClick={() => setSearchQuery('')}
                    className={`shrink-0 sm:w-full text-left px-2 py-1 rounded-lg text-[8px] sm:text-[9px] font-bold transition-all border ${
                      searchQuery === '' 
                        ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                        : 'bg-transparent text-[#555] border-transparent hover:bg-[#111] hover:text-[#888]'
                    }`}
                  >
                    All Roles
                  </button>
                  {jobRoles.map((role) => (
                    <button
                      key={role}
                      onClick={() => setSearchQuery(role)}
                      className={`shrink-0 sm:w-full text-left px-2 py-1 rounded-lg text-[8px] sm:text-[9px] font-bold transition-all border truncate ${
                        searchQuery === role 
                          ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                          : 'bg-transparent text-[#555] border-transparent hover:bg-[#111] hover:text-[#888]'
                      }`}
                      title={role}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Category Filters */}
          <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-[#222] bg-[#0a0a0a] flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
              {countries.map((country) => (
                <button
                  key={country}
                  onClick={() => setActiveCountry(country)}
                  className={`cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all duration-300 border whitespace-nowrap ${
                    activeCountry === country 
                      ? 'bg-white text-black border-white' 
                      : 'bg-[#161616] text-[#888] border-[#222] hover:border-[#333] hover:text-white'
                  }`}
                >
                  {country}
                </button>
              ))}
            </div>
            
            <div className="w-px h-4 bg-[#222] shrink-0" />
            
            <button
              onClick={() => setRemoteOnly(!remoteOnly)}
              className={`cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1.5 sm:gap-2 transition-all duration-300 border whitespace-nowrap shrink-0 ${
                remoteOnly 
                  ? 'bg-[#22c55e] text-white border-[#22c55e]' 
                  : 'bg-[#161616] text-[#888] border-[#222] hover:border-[#333] hover:text-white'
              }`}
            >
              <Monitor className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              Remote
            </button>

            <button
              onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
              className={`cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1.5 sm:gap-2 transition-all duration-300 border whitespace-nowrap shrink-0 ${
                bookmarkedOnly 
                  ? 'bg-green-600 text-white border-green-600' 
                  : 'bg-[#161616] text-[#888] border-[#222] hover:border-[#333] hover:text-white'
              }`}
            >
              <Bookmark className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill={bookmarkedOnly ? "currentColor" : "none"} />
              <span className="hidden sm:inline">Bookmarks</span>
            </button>
          </div>
          
          <AnimatePresence mode="wait">
            <motion.div 
              key={`${currentPage}-${searchQuery}-${locationQuery}-${activeCountry}-${remoteOnly}-${bookmarkedOnly}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
            >
              {currentJobs.map(job => (
                <motion.div 
                  key={job.id} 
                  variants={itemVariants}
                  id={`job-card-${job.id}`}
                  className="w-full"
                >
                  <JobCard 
                    job={job} 
                    isSelected={selectedJobId === job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    onToggleBookmark={(e) => handleToggleBookmark(e, job.id)}
                  />
                </motion.div>
              ))}
              
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-6 pb-2 px-2 border-t border-[#222]/50 mt-4">
                  <button 
                    onClick={() => {
                      setCurrentPage(p => Math.max(1, p - 1));
                      document.querySelector('.flex-1.overflow-y-auto')?.scrollTo(0, 0);
                    }}
                    disabled={currentPage === 1}
                    className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold bg-[#161616] text-[#888] border border-[#222] hover:text-white hover:border-[#333] hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    Previous
                  </button>
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-white font-bold">
                      Page {currentPage} of {totalPages}
                    </span>
                    <span className="text-[10px] text-[#555] font-medium mt-0.5">
                      {filteredJobs.length} total jobs
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setCurrentPage(p => Math.min(totalPages, p + 1));
                      document.querySelector('.flex-1.overflow-y-auto')?.scrollTo(0, 0);
                    }}
                    disabled={currentPage === totalPages}
                    className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold bg-[#161616] text-[#888] border border-[#222] hover:text-white hover:border-[#333] hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </aside>

        {/* Map Area */}
        <section className={`${viewMode === 'list' ? 'hidden' : 'flex'} flex-1 bg-[#0a0a0a]`}>
          <Map 
            jobs={filteredJobs} 
            selectedJobId={selectedJobId || undefined} 
            onJobClick={handleMapJobClick} 
          />
        </section>
      </div>

      {/* Gating / Renewal Modal */}
      <PricingModal 
        isOpen={!user?.is_subscribed || isPricingModalOpen} 
        onClose={() => setIsPricingModalOpen(false)}
        showCloseButton={user?.is_subscribed} 
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
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
