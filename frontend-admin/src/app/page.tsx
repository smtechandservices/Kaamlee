'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  MapPin,
  Play,
  RefreshCcw,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Search,
  Loader2,
  Terminal,
  X,
  AlertTriangle,
  LogOut,
  Users,
  ChevronDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface Location {
  id: number;
  country: string;
  country_code: string;
  state: string;
  city: string;
  last_scraped: string | null;
  job_count: number;
  accuracy_percentage: number;
}

interface ScrapeSession {
  id: number;
  start_time: string;
  end_time: string | null;
  status: string;
  jobs_found: number;
  jobs_deleted: number;
  current_location: string | null;
  error_message: string | null;
  stop_requested: boolean;
}

interface ScrapeLog {
  id: number;
  session: number;
  message: string;
  level: string;
  timestamp: string;
}

interface Stats {
  total_jobs: number;
  total_locations: number;
  last_scrape_session: (ScrapeSession & { search_term: string; results_limit: number }) | null;
  jobs_by_site: { site: string; count: number }[];
}

export default function AdminDashboard() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobRoles, setJobRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const router = useRouter();

  const fetchData = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      const [locRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/locations/`, {
          headers: { 'Authorization': `Token ${token}` }
        }),
        fetch(`${API_BASE}/stats/`, {
          headers: { 'Authorization': `Token ${token}` }
        })
      ]);

      if (locRes.status === 401 || statsRes.status === 401) {
        localStorage.removeItem('admin_token');
        router.push('/login');
        return;
      }

      if (!locRes.ok || !statsRes.ok) {
        throw new Error('Backend responded with an error');
      }

      const locData = await locRes.json();
      const statsData = await statsRes.json();
      setLocations(locData);
      setStats(statsData);

      // Fetch roles only once
      if (jobRoles.length === 0) {
        const rolesRes = await fetch(`${API_BASE}/roles/`);
        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          setJobRoles(rolesData);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/login');
  };

  const triggerScrape = async (term: string, limit: number) => {
    const token = localStorage.getItem('admin_token');
    setTriggering(true);
    try {
      const res = await fetch(`${API_BASE}/trigger-scrape/`, { 
        method: 'POST',
        headers: { 
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          search_term: term,
          results_wanted: limit
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.status || "Failed to trigger scrape");
        return;
      }

      alert(`Scraping for "${term}" started in background!`);
      setIsSettingsModalOpen(false);
      fetchData();
    } catch (error) {
      alert("Failed to trigger scrape");
    } finally {
      setTriggering(false);
    }
  };

  const stopScrape = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      await fetch(`${API_BASE}/stop-scrape/`, { 
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });
      alert("Stop request sent. Scraper will stop after current city.");
      fetchData();
    } catch (error) {
      alert("Failed to stop scrape");
    }
  };

  const forceStopScrape = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      await fetch(`${API_BASE}/force-reset/`, { 
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
      });
      alert("Force stopped all running sessions.");
      fetchData();
    } catch (error) {
      alert("Failed to force stop scrape");
    }
  };


  const countries = ['All', ...Array.from(new Set(locations.map(loc => {
    if (loc.country === 'United States') return 'USA';
    if (loc.country === 'United Kingdom') return 'UK';
    return loc.country;
  })))];

  const filteredLocations = locations.filter(loc => {
    const normalizedCountry = loc.country === 'United States' ? 'USA' : (loc.country === 'United Kingdom' ? 'UK' : loc.country);

    const matchesSearch = loc.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.country.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCountry = selectedCountry === 'All' || normalizedCountry === selectedCountry;
    return matchesSearch && matchesCountry;
  });

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white p-8">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Connection Error</h1>
        <p className="text-[#888] mb-6 text-center max-w-md">
          Could not connect to the backend server. Please make sure the Django server is running at {API_BASE}.
        </p>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="bg-[#111] border border-[#222] px-6 py-2 rounded-xl hover:bg-[#161616] transition-all flex items-center gap-2"
        >
          <RefreshCcw size={18} />
          Retry Connection
        </button>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Kaamlee Logo" className="h-10 w-auto" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Scraper Admin</h1>
              <p className="text-[#888] flex items-center gap-2">

              <LayoutDashboard size={16} />
              System Status:
              <span className={stats?.last_scrape_session?.status === 'running' ? 'text-blue-400' : 'text-green-400'}>
                {stats?.last_scrape_session?.status === 'running'
                  ? `Active Scraping: ${stats.last_scrape_session.current_location || 'Initializing...'}`
                  : 'Idle'}
              </span>
              </p>
            </div>
          </div>


          <div className="flex items-center gap-4">
            <button
              onClick={fetchData}
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all"
              title="Refresh Data"
            >
              <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <Link
              href="/users"
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all text-[#888] hover:text-white flex items-center gap-2 px-4"
              title="User Management"
            >
              <Users size={20} />
              <span className="text-sm font-bold">Users</span>
            </Link>
            <button
              onClick={() => setIsLogsModalOpen(true)}
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-[#161616] transition-all text-[#888] hover:text-white"
              title="Live Logs"
            >
              <Terminal size={20} />
            </button>

            {stats?.last_scrape_session?.status === 'running' ? (
              stats?.last_scrape_session?.stop_requested ? (
                <button
                  onClick={forceStopScrape}
                  className="cursor-pointer bg-red-800 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-red-900/50"
                  title="Force stop the stuck session"
                >
                  <AlertTriangle size={18} />
                  Force Stop
                </button>
              ) : (
                <button
                  onClick={stopScrape}
                  className="cursor-pointer bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-red-500/20"
                >
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Stop Scraping
                </button>
              )
            ) : (

              <button
                onClick={() => setIsSettingsModalOpen(true)}
                disabled={triggering}
                className="cursor-pointer bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
              >
                {triggering ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                Trigger Global Scrape
              </button>
            )}

            <button
              onClick={handleLogout}
              className="cursor-pointer p-3 rounded-xl bg-[#111] border border-[#222] hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500 transition-all text-[#888]"
              title="Logout"
            >
              <LogOut size={20} />
            </button>

          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <StatCard
            icon={<Briefcase className="text-blue-500" />}
            label="Total Jobs"
            value={stats?.total_jobs.toLocaleString() || '0'}
          />
          <StatCard
            icon={<MapPin className="text-indigo-500" />}
            label="Active Locations"
            value={stats?.total_locations || '0'}
          />
          <StatCard
            icon={<CheckCircle2 className="text-green-500" />}
            label="Last Success"
            value={stats?.last_scrape_session?.jobs_found ? `+ ${stats.last_scrape_session.jobs_found} jobs` : 'no jobs found'}
          />
          <StatCard
            icon={<AlertCircle className="text-orange-500" />}
            label="Last Run"
            value={stats?.last_scrape_session?.start_time ? new Date(stats.last_scrape_session.start_time).toLocaleTimeString() : 'Never'}
          />
        </div>

        <h2 className="text-xl font-bold">Locations & Job Distribution</h2>
        <div className="my-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Country Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#111] border border-[#222] rounded-2xl overflow-x-auto no-scrollbar max-w-full">
            {countries.map((country) => (
              <button
                key={country}
                onClick={() => setSelectedCountry(country)}
                className={`
                  relative px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all
                  ${selectedCountry === country ? 'text-white' : 'text-[#555] hover:text-[#888]'}
                `}
              >
                {selectedCountry === country && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-[#222] border border-[#333] rounded-xl shadow-lg"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="cursor-pointer relative z-10">{country}</span>
              </button>
            ))}
          </div>

          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" size={18} />
            <input
              type="text"
              placeholder="Search city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111] border border-[#222] rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
          <AnimatePresence mode='popLayout'>
            {filteredLocations.map((loc, i) => (
              <motion.div
                key={loc.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.02 }}
                className="break-inside-avoid"
              >
                <div className={`
                  bg-[#111] border border-[#222] rounded-3xl p-6 hover:border-blue-500/50 transition-all group relative overflow-hidden
                  ${i % 3 === 0 ? 'aspect-[4/5]' : i % 2 === 0 ? 'aspect-square' : 'aspect-[4/3]'}
                `}>
                  {/* Background Decoration */}
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/5 blur-2xl rounded-full group-hover:bg-blue-500/10 transition-all" />

                  <div className="h-full flex flex-col justify-between relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#1a1a1a] flex items-center justify-center text-sm font-bold text-blue-500 shadow-inner">
                        {loc.country_code}
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black tracking-tighter text-white group-hover:text-blue-400 transition-colors">
                          {loc.job_count}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-[#555] font-bold">Jobs Found</div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold truncate leading-tight mb-1">{loc.city}</h3>
                      <p className="text-sm text-[#555] font-medium mb-3">{loc.state ? `${loc.state}, ` : ''}{loc.country}</p>

                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex-1 h-1.5 bg-[#222] rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${loc.accuracy_percentage >= 80 ? 'bg-green-500' : loc.accuracy_percentage >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
                            style={{ width: `${loc.accuracy_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-[#888] whitespace-nowrap">{loc.accuracy_percentage}% Acc</span>
                      </div>

                      <div className="pt-4 border-t border-[#222] flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                          {loc.last_scraped ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                              <span className="text-green-500/80">Synced</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                              <span className="text-orange-500/80">Pending</span>
                            </>
                          )}
                        </div>
                        <div className="text-[10px] text-[#444] font-medium">
                          {loc.last_scraped ? new Date(loc.last_scraped).toLocaleDateString() : 'Never'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredLocations.length === 0 && (
          <div className="p-20 text-center text-[#555]">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No locations found matching "{searchTerm}"</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isLogsModalOpen && <LogsModal onClose={() => setIsLogsModalOpen(false)} stats={stats} />}
        {isSettingsModalOpen && (
          <ScrapeSettingsModal 
            onClose={() => setIsSettingsModalOpen(false)} 
            onStart={triggerScrape}
            loading={triggering}
            jobRoles={jobRoles}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) {
  return (
    <div className="bg-[#111] border border-[#222] p-6 rounded-3xl hover:border-[#333] transition-all">
      <div className="w-10 h-10 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mb-4">
        {icon}
      </div>
      <div className="text-xs text-[#555] font-medium uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function LogsModal({ onClose, stats }: { onClose: () => void, stats: Stats | null }) {
  const [logs, setLogs] = useState<ScrapeLog[]>([]);
  const [currentSession, setCurrentSession] = useState<ScrapeSession | null>(stats?.last_scrape_session || null);
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const token = localStorage.getItem('admin_token');
      try {
        const res = await fetch(`${API_BASE}/logs/`, {
          headers: { 'Authorization': `Token ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs);
          if (data.session) {
            setCurrentSession(data.session);
          }
        }
      } catch (error) {
        console.error("Failed to fetch logs:", error);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#111] border border-[#333] rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-[#333] bg-[#1a1a1a]">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Terminal size={20} className="text-blue-500" />
            Live Scraper Logs
          </h2>
          <div className="flex items-center gap-8">
            {currentSession && (
              <div className="hidden md:flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-md font-bold text-[#555] uppercase tracking-widest">Found</span>
                  <span className="text-md font-black text-green-500">{currentSession.jobs_found}</span>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-md font-bold text-[#555] uppercase tracking-widest">Deleted</span>
                  <span className="text-md font-black text-red-400">{currentSession.jobs_deleted}</span>
                </div>
              </div>
            )}
            <button onClick={onClose} className="cursor-pointer p-2 hover:bg-[#333] rounded-lg transition-colors text-[#888] hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div 
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm bg-black custom-scrollbar"
        >
          {logs.length === 0 ? (
            <div className="text-center text-[#555] py-10 flex flex-col items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin mb-4 opacity-50" />
              Waiting for logs...
            </div>
          ) : (
            logs.map(log => {
              let color = "text-[#aaa]";
              if (log.level === 'error') color = "text-red-400";
              else if (log.level === 'success') color = "text-green-400";
              else if (log.level === 'warning') color = "text-orange-400";
              
              return (
                <div key={log.id} className={`flex gap-3 py-1 border-b border-[#222]/50 hover:bg-[#111] ${color}`}>
                  <span className="text-[#555] shrink-0">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className="break-words w-full">{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function ScrapeSettingsModal({ onClose, onStart, loading, jobRoles }: { onClose: () => void, onStart: (term: string, limit: number) => void, loading: boolean, jobRoles: string[] }) {
  const [term, setTerm] = useState(jobRoles[0] || '');
  const [limit, setLimit] = useState(5);
  const [customTerm, setCustomTerm] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (!term && jobRoles.length > 0) {
      setTerm(jobRoles[0]);
    }
  }, [jobRoles]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#111] border border-[#333] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-[#333] bg-[#1a1a1a]">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Play size={20} className="text-blue-500" />
            Scrape Configuration
          </h2>
          <p className="text-sm text-[#555] mt-1">Configure parameters for the global scraping session.</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#555] mb-2 block">Job Role / Search Term</label>
            <div className="space-y-3">
              {!isCustom ? (
                <div className="relative">
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5 text-white flex items-center justify-between hover:border-blue-500 transition-all text-sm font-medium"
                  >
                    <span>{term}</span>
                    <ChevronDown size={16} className={`text-[#444] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-20 w-full mt-2 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl overflow-hidden"
                        >
                          <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {jobRoles.map(role => (
                              <button
                                key={role}
                                onClick={() => {
                                  setTerm(role);
                                  setIsDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-xs hover:bg-blue-600/10 hover:text-blue-400 transition-colors ${term === role ? 'bg-blue-600/5 text-blue-500' : 'text-[#888]'}`}
                              >
                                {role}
                              </button>
                            ))}
                            <button
                              onClick={() => {
                                setIsCustom(true);
                                setIsDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-xs text-blue-500 hover:bg-blue-600/10 border-t border-[#222] font-bold"
                            >
                              + Other Role...
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Enter job role..."
                    value={customTerm}
                    onChange={(e) => setCustomTerm(e.target.value)}
                    className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                  />
                  <button 
                    onClick={() => setIsCustom(false)}
                    className="px-3 bg-[#222] rounded-xl hover:bg-[#333]"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#555] mb-2 block">Results Wanted per Site</label>
            <div className="grid grid-cols-2 gap-4">
              {[5, 10].map(val => (
                <button
                  key={val}
                  onClick={() => setLimit(val)}
                  className={`
                    py-3 rounded-xl border font-bold transition-all
                    ${limit === val ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#161616] border-[#222] text-[#555] hover:border-[#333]'}
                  `}
                >
                  {val} Results
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#444] mt-2 italic text-center">
              Higher limits increase scraping time and risk of rate limits.
            </p>
          </div>
        </div>

        <div className="p-6 bg-[#1a1a1a] border-t border-[#333] flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-[#222] hover:bg-[#2a2a2a] font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button 
            disabled={loading || (isCustom && !customTerm)}
            onClick={() => onStart(isCustom ? customTerm : term, limit)}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            Start Scrape
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

