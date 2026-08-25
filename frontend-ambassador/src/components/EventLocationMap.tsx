'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Same free, keyless CARTO/MapLibre stack used on the Explore page's job map
// (see components/ui/map.tsx) — no Google Maps API key involved.
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

interface EventLocationMapProps {
  latitude: number;
  longitude: number;
  label?: string;
  className?: string;
}

export default function EventLocationMap({ latitude, longitude, label, className }: EventLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [longitude, latitude],
      zoom: 14,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    markerRef.current = new maplibregl.Marker({ color: '#16a34a' })
      .setLngLat([longitude, latitude])
      .addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Only re-init on mount/unmount — position updates are handled by the
    // effect below via setCenter/setLngLat instead of tearing the map down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    mapRef.current.setCenter([longitude, latitude]);
    markerRef.current.setLngLat([longitude, latitude]);
  }, [latitude, longitude]);

  return <div ref={containerRef} className={className} title={label} />;
}
