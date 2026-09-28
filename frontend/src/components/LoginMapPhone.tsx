'use client';

import React, { useEffect } from 'react';
import { Map as MapView, MapMarker, MarkerContent, MapArc, useMap } from '@/components/ui/map';
import { MAP_MARKERS, cityStats, arcPointAt, useCityTour } from '@/lib/city-tour';

const ARC_CURVATURE = 0.3;
const PHONE_ZOOM = 2.2;

/** Keeps the current city centred — a phone-width map can't show the whole world like the landing page's. */
function FollowCity({ coords }: { coords: [number, number] }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded) return;
    // Offset up: the lower part of the phone runs off the bottom of the screen.
    map.flyTo({ center: coords, zoom: PHONE_ZOOM, offset: [0, -70], duration: 2200, essential: true });
  }, [map, isLoaded, coords]);
  return null;
}

/** The landing page's live world-map mockup, shrunk into a phone. */
export default function LoginMapPhone() {
  const { cityIndex, prevCityIndex, cityCardVisible, arcProgress } = useCityTour();
  const city = MAP_MARKERS[cityIndex];
  const stats = cityStats(city.name);

  return (
    <div className="rounded-[52px] bg-gradient-to-b from-[#3a3f4b] to-[#1b1e25] p-[10px] shadow-[0_40px_80px_-20px_rgba(0,0,0,.8),inset_0_0_0_1px_rgba(255,255,255,.12)]">
      <div className="relative aspect-[1/2] overflow-hidden rounded-[44px] bg-[#f2f3f5] text-[#0b0b0c]">
        <MapView
          center={MAP_MARKERS[0].coords}
          zoom={PHONE_ZOOM}
          theme="light"
          className="absolute inset-0 h-full w-full"
          interactive={false}
          attributionControl={false}
        >
          <FollowCity coords={city.coords} />
          {prevCityIndex !== cityIndex && (() => {
            const from = MAP_MARKERS[prevCityIndex].coords;
            const to = city.coords;
            const head = arcPointAt(from, to, ARC_CURVATURE, arcProgress);
            return (
              <>
                <MapArc
                  data={[{ id: 'route', from, to: head }]}
                  curvature={ARC_CURVATURE}
                  interactive={false}
                  paint={{ 'line-color': '#16a34a', 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [0.3, 1.6] }}
                />
                {arcProgress < 1 && (
                  <MapMarker longitude={head[0]} latitude={head[1]}>
                    <MarkerContent>
                      <span className="relative block h-2.5 w-2.5 rounded-full border-2 border-white bg-[#16a34a] shadow-[0_0_0_4px_rgba(22,163,74,0.18)]" />
                    </MarkerContent>
                  </MapMarker>
                )}
              </>
            );
          })()}
          {MAP_MARKERS.map((m, i) => (
            <MapMarker key={m.name} longitude={m.coords[0]} latitude={m.coords[1]}>
              <MarkerContent>
                <span className="relative block">
                  {i === cityIndex && <span className="absolute inset-0 -m-1.5 animate-ping rounded-full bg-[#16a34a]/50" />}
                  <span className="relative block rounded-full border-2 border-white bg-[#16a34a] shadow-sm transition-all duration-700" style={{ width: i === cityIndex ? 12 : 7, height: i === cityIndex ? 12 : 7 }} />
                </span>
              </MarkerContent>
            </MapMarker>
          ))}
        </MapView>

        {/* dynamic island */}
        <div className="absolute left-1/2 top-3 z-10 h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-black" />

        <span className="pointer-events-none absolute right-3 top-[50px] z-10 inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/85 px-2.5 py-1 text-[10px] font-medium text-black/70 shadow-[0_1px_2px_rgba(16,18,26,.05),0_6px_16px_-8px_rgba(16,18,26,.10)] backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a] animate-pulse" /> hiring now
        </span>

        <div
          className="pointer-events-none absolute inset-x-3 top-[84px] z-10 rounded-2xl border border-black/[0.08] bg-white p-3.5 shadow-[0_2px_4px_rgba(16,18,26,.04),0_18px_40px_-18px_rgba(16,18,26,.22)]"
          style={{
            opacity: cityCardVisible ? 1 : 0,
            transform: cityCardVisible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 900ms ease, transform 900ms ease',
          }}
        >
          <b className="text-[13px] font-medium">{city.name}</b>
          <div className="mt-0.5 text-[11px] text-black/50">{stats.openRoles.toLocaleString()} open roles · Software</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-[#16a34a]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" /> {stats.postedToday} posted today
          </div>
        </div>
      </div>
    </div>
  );
}
