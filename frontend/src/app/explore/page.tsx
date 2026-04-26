'use client';

import React, { useState, useEffect } from 'react';
import { Search, Map as MapIcon, List, Filter, SlidersHorizontal, ChevronDown, Monitor } from 'lucide-react';
import { JobCard } from '@/components/JobCard';
import dynamic from 'next/dynamic';
import { fetchWithAuth } from '@/lib/api';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export default function ExplorePage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split');
  const [activeCategory, setActiveCategory] = useState<string>('Engineering');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInitial = async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuth("/jobs/search/");
        const data = await res.json();
        setJobs(data.results || []);
      } catch (err) {
        console.error("Failed to load initial jobs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, []);

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const q = encodeURIComponent(`${searchQuery} ${locationQuery}`);
      const res = await fetchWithAuth(`/jobs/search/?q=${q}`);
      const data = await res.json();
      setJobs(data.results || []);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedJobId) {
      const element = document.getElementById(`job-card-${selectedJobId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedJobId]);

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = job.location ? job.location.toLowerCase().includes(locationQuery.toLowerCase()) : true;
    const matchesRemote = remoteOnly ? job.is_remote : true;

    // Categorization logic
    const matchesCategory = activeCategory === 'All' ||
      (activeCategory === 'Engineering' && (job.title.toLowerCase().includes('developer') || job.title.toLowerCase().includes('engineer'))) ||
      (activeCategory === 'Design' && job.title.toLowerCase().includes('design')) ||
      (activeCategory === 'Product' && job.title.toLowerCase().includes('product'));

    return matchesSearch && matchesLocation && matchesRemote && matchesCategory;
  });

  return (
    <main className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden text-white font-sans">
      {/* Header */}
      <header className="h-16 border-b border-[#222] px-6 flex items-center justify-between glass z-20 shrink-0">
        <div className="flex items-center gap-8 flex-1">
          <h1 className="text-xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mr-4">KAAMLEE</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#161616] rounded-full p-1 border border-[#222]">
            <button
              onClick={() => setViewMode('split')}
              className={`p-1.5 rounded-full transition-all ${viewMode === 'split' ? 'bg-[#3b82f6] text-white' : 'text-[#555] hover:text-[#888]'}`}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded-full transition-all ${viewMode === 'map' ? 'bg-[#3b82f6] text-white' : 'text-[#555] hover:text-[#888]'}`}
            >
              <MapIcon size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className={`${viewMode === 'map' ? 'hidden' : 'flex'} w-full md:w-[450px] flex-col border-r border-[#222] bg-[#0a0a0a] z-10 shrink-0`}>

          {/* Search Area */}
          <form onSubmit={handleSearchSubmit} className="p-4 border-b border-[#222] bg-[#0a0a0a]">
            <div className="bg-[#161616] border border-[#222] rounded-2xl w-full shadow-inner flex flex-col overflow-hidden focus-within:border-[#3b82f6]/50 transition-all">
              <div className="flex items-center px-3 py-2.5">
                <Search size={16} className="text-[#555] shrink-0 ml-1" />
                <input
                  type="text"
                  placeholder="Job title, keywords, or company"
                  className="bg-transparent border-none outline-none ring-0 focus:ring-0 text-sm text-white placeholder-[#555] w-full ml-3"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="w-full h-px bg-[#222]" />
              <div className="flex items-center px-3 py-2.5">
                <MapIcon size={16} className="text-[#555] shrink-0 ml-1" />
                <input
                  type="text"
                  placeholder="City, state, zip code, or remote"
                  className="bg-transparent border-none outline-none ring-0 focus:ring-0 text-sm text-white placeholder-[#555] w-full ml-3"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="hidden"></button>
          </form>

          {/* Category Filters - Moved to Sidebar */}
          <div className="px-4 py-3 border-b border-[#222] bg-[#0a0a0a] flex items-center gap-2 overflow-x-auto no-scrollbar">
            {['All', 'Engineering', 'Design', 'Product'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-300 border whitespace-nowrap ${activeCategory === cat
                    ? 'bg-white text-black border-white'
                    : 'bg-[#161616] text-[#888] border-[#222] hover:border-[#333] hover:text-white'
                  }`}
              >
                {cat}
              </button>
            ))}

            <div className="w-px h-4 bg-[#222] mx-1 shrink-0" />

            <button
              onClick={() => setRemoteOnly(!remoteOnly)}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-2 transition-all duration-300 border whitespace-nowrap ${remoteOnly
                  ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
                  : 'bg-[#161616] text-[#888] border-[#222] hover:border-[#333] hover:text-white'
                }`}
            >
              <Monitor size={12} />
              Remote
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative">
            {loading ? (
              <div className="flex justify-center py-20 pointer-events-none"><div className="w-6 h-6 rounded-full border-t-2 border-r-2 border-emerald-500 animate-spin" /></div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center text-[#555] py-10">No jobs found matching your criteria. Hit enter to globally search.</div>
            ) : (
              filteredJobs.map(job => (
                <div key={job.id} id={`job-card-${job.id}`}>
                  <JobCard
                    job={job}
                    isSelected={selectedJobId === job.id}
                    onClick={() => setSelectedJobId(job.id)}
                  />
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Map Area */}
        <section className={`${viewMode === 'list' ? 'hidden' : 'flex'} flex-1 bg-[#0a0a0a]`}>
          <Map
            jobs={filteredJobs}
            selectedJobId={selectedJobId || undefined}
            onJobClick={setSelectedJobId}
          />
        </section>
      </div>

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
