// Shared between the dashboard's embedded "Import Jobs" panel
// (app/page.tsx) and the dedicated live scraper page (app/scraper/page.tsx)
// — both render the same kind of board log lines, just fed from different
// transports (HTTP polling vs. the scraper WebSocket), so the parsing logic
// that turns a raw log line into a progress stage/ETA lives here once.

export interface BoardProgress {
  stage: string;
  current?: number;
  total?: number;
  geocodeStartedAt?: number;
}

// Scripts only emit granular counters during the geocode pass (every 25
// locations) — everything else is a one-shot line — so progress/ETA is
// only ever computable for that phase; other stages just show a label.
export function parseBoardProgress(message: string, prev: BoardProgress | undefined): BoardProgress {
  const locationMatch = message.match(/^(\d+)\/(\d+) location\(s\) checked/);
  if (locationMatch) {
    return {
      stage: 'Geocoding locations',
      current: Number(locationMatch[1]),
      total: Number(locationMatch[2]),
      geocodeStartedAt: prev?.geocodeStartedAt ?? Date.now(),
    };
  }
  if (message.startsWith('Fetching ')) return { stage: 'Fetching postings' };
  if (/posting\(s\) received$/.test(message)) return { stage: 'Saving to database' };
  if (/created, \d+ updated/.test(message)) return { stage: 'Preparing to geocode' };
  if (message === 'Geocoding locations...') return { stage: 'Geocoding locations', geocodeStartedAt: Date.now() };
  if (/^Stopped by admin request/.test(message)) return { ...prev, stage: 'Stopping...' };
  if (/rate-limiting/.test(message)) return { ...prev, stage: 'Rate-limited by Nominatim, waiting to retry' };
  if (/geocoded, \d+ borrowed/.test(message)) return { stage: 'Cleaning up' };
  if (/^Removed \d+/.test(message)) return { stage: 'Finishing up' };
  return prev ?? { stage: message };
}

export function formatEta(progress: BoardProgress): string | null {
  const { current, total, geocodeStartedAt } = progress;
  if (current == null || total == null || !geocodeStartedAt || current <= 0) return null;
  const elapsedSeconds = (Date.now() - geocodeStartedAt) / 1000;
  const rate = current / elapsedSeconds; // items/sec
  if (rate <= 0) return null;
  const remainingSeconds = Math.round((total - current) / rate);
  if (remainingSeconds <= 0) return 'almost done';
  if (remainingSeconds < 60) return `~${remainingSeconds}s left`;
  const minutes = Math.round(remainingSeconds / 60);
  return `~${minutes} min left`;
}

export function formatElapsed(startedAt: number): string {
  const seconds = Math.max(0, Math.round(Date.now() / 1000 - startedAt));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  return `${minutes}m ${remSeconds}s`;
}
