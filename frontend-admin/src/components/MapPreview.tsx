'use client';

import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// Click-a-coordinate map preview, shared by the Jobs and Postings pages:
// a small popover anchored under the clicked coordinates, showing the point
// on a plain map. `useMapPreview` holds the state, `CoordinatesButton` opens
// it, `MapPreviewPopover` renders it.

const MAP_PREVIEW_WIDTH = 260;
const MAP_PREVIEW_HEIGHT = 220;

export interface MapPreviewState {
  key: string | number;
  title: string;
  latitude: number;
  longitude: number;
  top: number;
  left: number;
}

// A minimal, plain (non-satellite) preview: Leaflet + CartoDB Positron tiles,
// loaded via CDN inside the iframe's own document so no map library needs to
// be added to this app's bundle just for a one-off coordinate check.
function buildMapSrcDoc(lat: number, lon: number) {
  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #f2f3f5; }
  .leaflet-control-attribution { font-size: 8px; background: rgba(255,255,255,0.7); color: #666; }
  .leaflet-control-attribution a { color: #444; }
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
  L.circleMarker([${lat}, ${lon}], { radius: 7, color: '#16a34a', weight: 2, fillColor: '#16a34a', fillOpacity: 0.9 }).addTo(map);
</script>
</body></html>`;
}

export function useMapPreview() {
  const [preview, setPreview] = useState<MapPreviewState | null>(null);

  const open = useCallback((
    point: { key: string | number; title: string; latitude: number; longitude: number },
    e: React.MouseEvent<HTMLElement>,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - MAP_PREVIEW_WIDTH - 16);
    const top = Math.min(rect.bottom + 8, window.innerHeight - MAP_PREVIEW_HEIGHT - 16);
    setPreview({ ...point, top, left });
  }, []);

  const close = useCallback(() => setPreview(null), []);
  return { preview, open, close };
}

/** "lat, lng" as a link that opens the preview; "—" when there's no point. */
export function CoordinatesButton({ latitude, longitude, onOpen }: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  onOpen: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  if (latitude == null || longitude == null) {
    return <span className="text-xs text-[#0b0b0c]/70">—</span>;
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(e); }}
      className="cursor-pointer font-mono text-xs text-[#0b0b0c]/40 hover:text-green-600 transition-colors underline decoration-dotted underline-offset-2"
      title="Preview on map"
    >
      {latitude.toFixed(4)}, {longitude.toFixed(4)}
    </button>
  );
}

export function MapPreviewPopover({ preview, onClose }: { preview: MapPreviewState | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {preview && (
        <React.Fragment key="map-preview">
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{ top: preview.top, left: preview.left, width: MAP_PREVIEW_WIDTH }}
            className="fixed z-50 bg-white border border-black/[0.12] rounded-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 bg-black/[0.04] border-b border-black/[0.12]">
              <span className="text-[10px] font-mono text-[#0b0b0c]/40 truncate">
                {preview.latitude.toFixed(5)}, {preview.longitude.toFixed(5)}
              </span>
              <button onClick={onClose} className="cursor-pointer text-[#0b0b0c]/55 hover:text-[#0b0b0c] transition-colors shrink-0 ml-2" aria-label="Close map preview">
                <X size={14} />
              </button>
            </div>
            <iframe
              key={preview.key}
              title={`Map preview for ${preview.title}`}
              srcDoc={buildMapSrcDoc(preview.latitude, preview.longitude)}
              sandbox="allow-scripts"
              className="w-full border-0"
              style={{ height: MAP_PREVIEW_HEIGHT - 34 }}
              loading="lazy"
            />
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
