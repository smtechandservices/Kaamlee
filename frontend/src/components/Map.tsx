'use client';

import { Map as Mapcn, MapControls, MapMarker, MarkerContent, MarkerPopup, MarkerLabel, MapClusterLayer, type MapViewport } from "@/components/ui/map";
import { ChevronLeft, ChevronRight, ExternalLink, X, Loader2, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useRef, useEffect, useState, useMemo } from 'react';

// Haversine formula to calculate distance between two points in km
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

interface MapProps {
  jobs: any[];
  selectedJobId?: string | null;
  onJobClick?: (id: string | null) => void;
}

const Map = ({ jobs, selectedJobId, onJobClick }: MapProps) => {
  // Center of India as default
  const center: [number, number] = [78.9629, 20.5937];
  const mapRef = useRef<any>(null);
  const [nearbyJobs, setNearbyJobs] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Performance states
  const [zoom, setZoom] = useState(4);
  const [bounds, setBounds] = useState<any>(null);

  useEffect(() => {
    if (selectedJobId && mapRef.current) {
      const selectedJob = jobs.find(j => j.id === selectedJobId);
      if (selectedJob && selectedJob.latitude && selectedJob.longitude) {
        mapRef.current.flyTo({
          center: [selectedJob.longitude, selectedJob.latitude],
          zoom: 12,
          duration: 1200
        });
      }
    }
  }, [selectedJobId, jobs]);

  useEffect(() => {
    setNearbyJobs([]);
  }, [jobs]);

  // Convert jobs to GeoJSON for MapClusterLayer
  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: jobs
        .filter(job => job.latitude && job.longitude)
        .map(job => ({
          type: "Feature" as const,
          id: job.id,
          properties: {
            id: job.id,
            company: job.company,
            title: job.title,
            location: job.location
          },
          geometry: {
            type: "Point" as const,
            coordinates: [job.longitude, job.latitude] as [number, number]
          }
        }))
    };
  }, [jobs]);

  // Filter jobs that are currently visible in the viewport (for zoom >= 10)
  const visibleJobs = useMemo(() => {
    if (!bounds || zoom < 10) return [];
    
    return jobs.filter(job => {
      if (!job.latitude || !job.longitude) return false;
      
      // Simple bound check
      const { _sw, _ne } = bounds;
      return (
        job.longitude >= _sw.lng &&
        job.longitude <= _ne.lng &&
        job.latitude >= _sw.lat &&
        job.latitude <= _ne.lat
      );
    });
  }, [jobs, bounds, zoom]);

  const handleViewportChange = (viewport: MapViewport) => {
    setZoom(viewport.zoom);
    if (mapRef.current) {
      const newBounds = mapRef.current.getBounds();
      setBounds(newBounds);
    }
  };

  const findNearestStartup = () => {
    if (!navigator.geolocation) return;
    
    setIsSearching(true);
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      
      const jobsWithDistance = jobs
        .filter(job => job.latitude && job.longitude)
        .map(job => ({
          ...job,
          distance: getDistance(latitude, longitude, job.latitude, job.longitude)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);
      
      setNearbyJobs(jobsWithDistance);
      setCurrentIndex(0);
      setIsSearching(false);
      
      if (jobsWithDistance.length > 0) {
        const closestJob = jobsWithDistance[0];
        onJobClick?.(closestJob.id);
        mapRef.current.flyTo({
          center: [closestJob.longitude, closestJob.latitude],
          zoom: 12,
          duration: 2000
        });
      }
    }, (error) => {
      console.error(error);
      setIsSearching(false);
    });
  };

  const navigateNearby = (direction: 'next' | 'prev') => {
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = nearbyJobs.length - 1;
    if (newIndex >= nearbyJobs.length) newIndex = 0;
    
    setCurrentIndex(newIndex);
    const job = nearbyJobs[newIndex];
    onJobClick?.(job.id);
    mapRef.current.flyTo({
      center: [job.longitude, job.latitude],
      zoom: 12,
      duration: 1500
    });
  };

  const currentNearby = nearbyJobs[currentIndex];

  return (
    <div className="w-full h-full relative overflow-hidden">
      <Mapcn
        ref={mapRef}
        center={center}
        zoom={zoom}
        maxZoom={12}
        theme="light"
        className="w-full h-full"
        onClick={(e) => {
          // Don't deselect if we clicked on a cluster or point
          const features = mapRef.current?.queryRenderedFeatures(e.point);
          const hasFeature = features?.some((f: any) => 
            f.layer.id.includes('cluster') || f.layer.id.includes('unclustered')
          );
          
          if (hasFeature) return;

          setNearbyJobs([]);
          onJobClick?.(null);
        }}
        onViewportChange={handleViewportChange}
      >
        <MapControls 
          position="bottom-right" 
          showZoom={true} 
          showLocate={true}
          showFullscreen={false}
        />

        {/* Clustering layer for zoomed out view */}
        {zoom < 10 && (
          <MapClusterLayer 
            data={geojson} 
            clusterMaxZoom={10}
            clusterRadius={50}
            clusterColors={["#22c55e", "#16a34a", "#15803d"]}
            onPointClick={(feature) => {
               const jobId = feature.properties?.id;
               if (jobId) onJobClick?.(jobId);
            }}
          />
        )}

        {/* Individual markers with logos for zoomed in view (or if selected) */}
        {(zoom >= 10 ? visibleJobs : jobs.filter(j => j.id === selectedJobId)).map((job, index) => {
          const lat = job.latitude;
          const lng = job.longitude;
          if (!lat || !lng) return null;

          return (
            <MapMarker 
              key={job.id || index} 
              longitude={lng} 
              latitude={lat}
              onClick={(e) => {
                e.stopPropagation();
                onJobClick?.(selectedJobId === job.id ? null : job.id);
              }}
            >
              <MarkerContent className="group">
                {job.id === selectedJobId ? (
                  <MapPin size={20} className="text-[#16a34a] drop-shadow-[0_2px_4px_rgba(22,163,74,0.4)] fill-[#16a34a]/20 transition-all duration-300" />
                ) : (
                  <MapPin size={14} className="text-black/40 fill-white/60 group-hover:text-[#16a34a] group-hover:scale-125 transition-all duration-200" />
                )}
                <MarkerLabel position="top" className="text-[9px] font-medium text-[#0b0b0c] opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-black/[0.08] px-1.5 py-0.5 rounded-full shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] mb-1 whitespace-nowrap">
                  {job.company || 'Confidential'}
                </MarkerLabel>
              </MarkerContent>
              <MarkerPopup show={job.id === selectedJobId} className="w-64 bg-white border border-black/[0.08] p-0 overflow-hidden rounded-2xl shadow-[0_30px_80px_-30px_rgba(16,18,26,.35)]">
                <div className="p-4 bg-white">
                  <div className="text-[10px] text-black/40 uppercase tracking-widest font-semibold mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                    {job.company || 'Confidential'} • {job.location}
                  </div>
                  <div className="text-sm font-semibold text-[#0b0b0c] mb-2 leading-tight tracking-[-0.01em]" style={{ fontFamily: 'var(--font-outfit)' }}>
                    {job.title}
                  </div>
                  <div className="flex justify-between items-start gap-3 mt-3">
                    <span className="text-xs text-black/50 line-clamp-2 flex-1">{job.job_type || 'Full-time'}</span>
                    <a
                      href={job.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-[10px] text-white px-3 py-1.5 rounded-full font-semibold flex items-center gap-1 transition-transform hover:-translate-y-0.5 shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_10px_24px_-10px_rgba(22,163,74,.85)]"
                      style={{ background: 'linear-gradient(180deg,#4ade80,#16a34a 55%,#15803d)', fontFamily: 'var(--font-outfit)' }}
                    >
                      Apply Now
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </MarkerPopup>

            </MapMarker>
          );
        })}
      </Mapcn>

      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="px-3 py-1.5 rounded-full text-[11px] font-medium text-black/70 w-fit flex items-center gap-2 bg-white/90 backdrop-blur-md border border-black/[0.08] shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] pointer-events-none" style={{ fontFamily: 'var(--font-outfit)' }}>
          <div className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
          {jobs.length} {jobs.length === 1 ? 'Job' : 'Jobs'} Found
        </div>

        <AnimatePresence mode="wait">
          {currentNearby && (
            <motion.div
              key={currentNearby.id}
              initial={{ opacity: 0, x: -20, y: 0 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 20, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="px-4 py-3 rounded-2xl bg-white border border-black/[0.08] w-64 shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-[9px] font-semibold uppercase tracking-widest text-[#16a34a]" style={{ fontFamily: 'var(--font-outfit)' }}>Discovery {currentIndex + 1}/{nearbyJobs.length}</div>
                <div className="flex items-center gap-1">
                    <button
                     onClick={() => setNearbyJobs([])}
                     className="cursor-pointer p-1 rounded-md bg-black/[0.04] hover:bg-red-50 transition-colors text-black/50 hover:text-red-500"
                    >
                      <X size={12} />
                    </button>
                    <div className="w-px h-3 bg-black/[0.08] mx-0.5" />
                   <button
                    onClick={() => navigateNearby('prev')}
                    className="cursor-pointer p-1 rounded-md bg-black/[0.04] hover:bg-black/[0.08] transition-colors text-black/60"
                   >
                     <ChevronLeft size={12} />
                   </button>
                    <button
                     onClick={() => navigateNearby('next')}
                     className="cursor-pointer p-1 rounded-md bg-black/[0.04] hover:bg-black/[0.08] transition-colors text-black/60"
                    >
                      <ChevronRight size={12} />
                    </button>
                 </div>
              </div>
              <div className="mb-2">
                <div className="text-[10px] font-medium text-black/40 truncate mb-0.5" style={{ fontFamily: 'var(--font-outfit)' }}>{currentNearby.title}</div>
                <div className="text-xs font-semibold text-[#0b0b0c] truncate" style={{ fontFamily: 'var(--font-outfit)' }}>{currentNearby.company}</div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>
                 <span className="text-black/45">{currentNearby.distance.toFixed(1)} km away</span>
                 <span className="text-[#16a34a]">{Math.round(currentNearby.distance * 1.5)} min</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={findNearestStartup}
          disabled={isSearching}
          className="cursor-pointer group flex items-center gap-2 bg-white text-[#0b0b0c] px-5 py-2 rounded-full font-medium text-[13px] hover:-translate-y-0.5 active:scale-95 transition-all shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] border border-black/[0.10] disabled:opacity-70 disabled:cursor-wait disabled:hover:translate-y-0"
          style={{ fontFamily: 'var(--font-outfit)' }}
        >
          {isSearching ? (
            <>
              <Loader2 size={14} className="animate-spin text-[#16a34a]" />
              Searching...
            </>
          ) : (
            'Jobs Near Me'
          )}
        </button>
      </div>
    </div>
  );
};

export default Map;