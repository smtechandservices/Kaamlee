// Shared by the landing page's world-map mockup and the login page's phone
// mockup: the cities that get toured, the fake-but-stable stats shown for
// them, and the timer that hops from city to city drawing an arc.

import { useEffect, useRef, useState } from 'react';

export const MAP_MARKERS: { name: string; coords: [number, number] }[] = [
  // North America
  { name: 'San Francisco', coords: [-122.4194, 37.7749] },
  { name: 'Los Angeles', coords: [-118.2437, 34.0522] },
  { name: 'Seattle', coords: [-122.3321, 47.6062] },
  { name: 'Chicago', coords: [-87.6298, 41.8781] },
  { name: 'New York', coords: [-74.0060, 40.7128] },
  { name: 'Toronto', coords: [-79.3832, 43.6532] },
  { name: 'Austin', coords: [-97.7431, 30.2672] },
  { name: 'Mexico City', coords: [-99.1332, 19.4326] },
  { name: 'Vancouver', coords: [-123.1207, 49.2827] },
  // South America
  { name: 'São Paulo', coords: [-46.6333, -23.5505] },
  { name: 'Buenos Aires', coords: [-58.3816, -34.6037] },
  { name: 'Santiago', coords: [-70.6693, -33.4489] },
  { name: 'Bogotá', coords: [-74.0721, 4.7110] },
  { name: 'Lima', coords: [-77.0428, -12.0464] },
  // Europe
  { name: 'London', coords: [-0.1276, 51.5074] },
  { name: 'Paris', coords: [2.3522, 48.8566] },
  { name: 'Berlin', coords: [13.4050, 52.5200] },
  { name: 'Madrid', coords: [-3.7038, 40.4168] },
  { name: 'Amsterdam', coords: [4.9041, 52.3676] },
  { name: 'Dublin', coords: [-6.2603, 53.3498] },
  { name: 'Stockholm', coords: [18.0686, 59.3293] },
  { name: 'Warsaw', coords: [21.0122, 52.2297] },
  { name: 'Rome', coords: [12.4964, 41.9028] },
  { name: 'Lisbon', coords: [-9.1393, 38.7223] },
  { name: 'Zurich', coords: [8.5417, 47.3769] },
  // Africa
  { name: 'Lagos', coords: [3.3792, 6.5244] },
  { name: 'Nairobi', coords: [36.8219, -1.2921] },
  { name: 'Cairo', coords: [31.2357, 30.0444] },
  { name: 'Johannesburg', coords: [28.0473, -26.2041] },
  { name: 'Accra', coords: [-0.1870, 5.6037] },
  { name: 'Casablanca', coords: [-7.5898, 33.5731] },
  // Middle East
  { name: 'Dubai', coords: [55.2708, 25.2048] },
  { name: 'Riyadh', coords: [46.6753, 24.7136] },
  { name: 'Tel Aviv', coords: [34.7818, 32.0853] },
  { name: 'Istanbul', coords: [28.9784, 41.0082] },
  // South & East Asia
  { name: 'Mumbai', coords: [72.8777, 19.0760] },
  { name: 'Delhi', coords: [77.2090, 28.6139] },
  { name: 'Bengaluru', coords: [77.5946, 12.9716] },
  { name: 'Hyderabad', coords: [78.4867, 17.3850] },
  { name: 'Pune', coords: [73.8567, 18.5204] },
  { name: 'Chennai', coords: [80.2707, 13.0827] },
  { name: 'Kolkata', coords: [88.3639, 22.5726] },
  { name: 'Singapore', coords: [103.8198, 1.3521] },
  { name: 'Tokyo', coords: [139.6503, 35.6762] },
  { name: 'Seoul', coords: [126.9780, 37.5665] },
  { name: 'Shanghai', coords: [121.4737, 31.2304] },
  { name: 'Hong Kong', coords: [114.1694, 22.3193] },
  { name: 'Jakarta', coords: [106.8456, -6.2088] },
  { name: 'Manila', coords: [120.9842, 14.5995] },
  { name: 'Bangkok', coords: [100.5018, 13.7563] },
  { name: 'Ho Chi Minh City', coords: [106.6297, 10.8231] },
  // Oceania
  { name: 'Sydney', coords: [151.2093, -33.8688] },
  { name: 'Melbourne', coords: [144.9631, -37.8136] },
  { name: 'Auckland', coords: [174.7633, -36.8485] },
];

export function hashSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function cityStats(name: string) {
  const h = hashSeed(name);
  return {
    openRoles: 800 + (h % 12000),
    postedToday: 20 + ((h >>> 3) % 380),
  };
}

/** Point at parameter t along the same quadratic bezier MapArc draws between
 * `from` and `to` (lng/lat space), so a partial arc can be grown over time. */
export function arcPointAt(from: [number, number], to: [number, number], curvature: number, t: number): [number, number] {
  const [x0, y0] = from;
  const [x2, y2] = to;
  const dx = x2 - x0;
  const dy = y2 - y0;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || curvature === 0) {
    return [x0 + dx * t, y0 + dy * t];
  }
  const mx = (x0 + x2) / 2;
  const my = (y0 + y2) / 2;
  const nx = -dy / distance;
  const ny = dx / distance;
  const offset = distance * curvature;
  const cx = mx + nx * offset;
  const cy = my + ny * offset;
  const inv = 1 - t;
  return [inv * inv * x0 + 2 * inv * t * cx + t * t * x2, inv * inv * y0 + 2 * inv * t * cy + t * t * y2];
}

/** Every 3.2s: fade the city card out, move to the next city, fade it back
 * in, and grow the arc from the previous city over 2.2s. */
export function useCityTour() {
  const [cityIndex, setCityIndex] = useState(0);
  const [prevCityIndex, setPrevCityIndex] = useState(0);
  const [cityCardVisible, setCityCardVisible] = useState(true);
  const [arcProgress, setArcProgress] = useState(1);
  const cityIndexRef = useRef(0);

  useEffect(() => {
    cityIndexRef.current = cityIndex;
  }, [cityIndex]);

  useEffect(() => {
    let raf: number | null = null;
    const timer = setInterval(() => {
      setCityCardVisible(false);
      setTimeout(() => {
        setPrevCityIndex(cityIndexRef.current);
        setCityIndex((i) => (i + 1) % MAP_MARKERS.length);
        setCityCardVisible(true);

        setArcProgress(0);
        const start = performance.now();
        const dur = 2200;
        const tick = (now: number) => {
          const p = Math.min((now - start) / dur, 1);
          setArcProgress(p);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, 900);
    }, 3200);
    return () => {
      clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return { cityIndex, prevCityIndex, cityCardVisible, arcProgress };
}
