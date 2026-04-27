'use client';

import React, { useState, useEffect } from 'react';
import { Search, Map as MapIcon, List, Filter, SlidersHorizontal, ChevronDown, Monitor } from 'lucide-react';
import { JobCard } from '@/components/JobCard';
import Map from '@/components/Map';


export default function ExplorePage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split');
  const [activeCountry, setActiveCountry] = useState<string>('All');
  const [remoteOnly, setRemoteOnly] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobsRes, locsRes] = await Promise.all([
          fetch('http://127.0.0.1:8000/api/jobs/'),
          fetch('http://127.0.0.1:8000/api/locations/')
        ]);
        
        const jobsData = await jobsRes.json();
        const locsData = await locsRes.json();
        
        const processedJobs = jobsData.map((job: any) => ({
          ...job,
          location: job.location_name
        }));
        
        setJobs(processedJobs);
        setLocations(locsData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };
    fetchData();
  }, []);



  useEffect(() => {
    if (selectedJobId) {
      const element = document.getElementById(`job-card-${selectedJobId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedJobId]);

  const countries = ['All', ...Array.from(new Set(locations.map(loc => {
    if (loc.country === 'United States') return 'USA';
    if (loc.country === 'United Kingdom') return 'UK';
    return loc.country;
  })))];

  const filteredJobs = jobs.filter(job => {
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
    
    return matchesSearch && matchesLocation && matchesRemote && matchesCountry;
  });




  return (
    <main className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-[#222] px-6 flex items-center justify-between glass z-20 shrink-0">
        <div className="flex items-center gap-8 flex-1">
          <h1 className="text-xl font-black tracking-tighter text-white mr-4">KAAMLEE</h1>
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
          <div className="p-4 border-b border-[#222] bg-[#0a0a0a]">
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
          </div>

          {/* Category Filters - Moved to Sidebar */}
          <div className="px-4 py-3 border-b border-[#222] bg-[#0a0a0a] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
              {countries.map((country) => (
                <button
                  key={country}
                  onClick={() => setActiveCountry(country)}
                  className={`cursor-pointer px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-300 border whitespace-nowrap ${
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
              className={`cursor-pointer px-4 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-2 transition-all duration-300 border whitespace-nowrap shrink-0 ${
                remoteOnly 
                  ? 'bg-[#3b82f6] text-white border-[#3b82f6]' 
                  : 'bg-[#161616] text-[#888] border-[#222] hover:border-[#333] hover:text-white'
              }`}
            >
              <Monitor size={12} />
              Remote
            </button>
          </div>



          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {filteredJobs.map(job => (
              <div key={job.id} id={`job-card-${job.id}`}>
                <JobCard 
                  job={job} 
                  isSelected={selectedJobId === job.id}
                  onClick={() => setSelectedJobId(job.id)}
                />
              </div>
            ))}
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
