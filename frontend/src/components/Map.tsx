'use client';

import { Map as Mapcn, MapControls, MapMarker, MarkerContent, MarkerPopup, MarkerLabel } from "@/components/ui/map";
import { ExternalLink } from 'lucide-react';

import { useRef, useEffect } from 'react';

interface MapProps {
  jobs: any[];
  selectedJobId?: string | null;
  onJobClick?: (id: string) => void;
}

const Map = ({ jobs, selectedJobId, onJobClick }: MapProps) => {
  // Center of India as default
  const center: [number, number] = [78.9629, 20.5937];
  const mapRef = useRef<any>(null);

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

  return (
    <div className="w-full h-full relative overflow-hidden">
      <Mapcn 
        ref={mapRef}
        center={center} 
        zoom={4}
        theme="dark"
        className="w-full h-full"
      >
        <MapControls 
          position="bottom-right" 
          showZoom={true} 
          showLocate={true}
          showFullscreen={true}
        />

        {jobs.map((job, index) => {
          // Use real coordinates from geocoding, with a fallback if missing
          const lat = job.latitude || (20.5937 + (Math.random() - 0.5) * 5);
          const lng = job.longitude || (78.9629 + (Math.random() - 0.5) * 5);

          return (
            <MapMarker 
              key={job.id || index} 
              longitude={lng} 
              latitude={lat}
              onClick={() => onJobClick?.(job.id)}
            >
              <MarkerContent className="group">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all duration-300 overflow-hidden ${
                  job.id === selectedJobId 
                    ? 'bg-[#3b82f6] border-white text-white scale-125 shadow-[0_0_15px_rgba(59,130,246,0.6)]' 
                    : 'bg-white border-[#333] text-[#333] shadow-md group-hover:border-[#3b82f6] group-hover:scale-110'
                }`}>
                  {job.company_logo ? (
                    <img 
                      src={job.company_logo} 
                      alt="" 
                      className="w-full h-full object-cover bg-white" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.innerHTML = (job.company || job.title).charAt(0).toUpperCase();
                      }}
                    />
                  ) : (
                    (job.company || job.title).charAt(0).toUpperCase()
                  )}
                </div>
                <MarkerLabel position="top" className="text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-1.5 py-0.5 rounded backdrop-blur-sm mb-1">
                  {job.company || 'Confidential'}
                </MarkerLabel>
              </MarkerContent>
              <MarkerPopup show={job.id === selectedJobId} className="w-64 bg-[#111] border-[#333] p-0 overflow-hidden rounded-xl shadow-2xl">
                <div className="p-4 bg-[#161616]">
                  <div className="text-[10px] text-[#555] uppercase tracking-widest font-bold mb-1">
                    {job.company || 'Confidential'} • {job.location}
                  </div>
                  <div className="text-sm font-bold text-white mb-2 leading-tight">
                    {job.title}
                  </div>
                  <div className="flex justify-between items-start gap-3 mt-3">
                    <span className="text-xs text-[#888] line-clamp-2 flex-1">{job.job_type || 'Full-time'}</span>
                    <a 
                      href={job.job_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="shrink-0 text-[10px] bg-[#3b82f6] text-white px-3 py-1.5 rounded-full font-bold flex items-center gap-1 hover:bg-blue-600 transition-colors"
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

      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="glass px-3 py-1.5 rounded-full text-[11px] font-medium text-white/80 flex items-center gap-2 bg-[#111]/80 backdrop-blur-md border border-[#333]">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          {jobs.length} {jobs.length === 1 ? 'Job' : 'Jobs'} Found
        </div>
      </div>
    </div>
  );
};

export default Map;