import { useEffect, useState } from 'react';

export type Availability = 'idle' | 'checking' | 'available' | 'taken';

// Debounced live duplicate check against /api/check-existence/ (the same
// endpoint candidate signup uses). The backend re-validates on submit, so
// this is only for early feedback.
export function useAvailability(field: 'username' | 'email', value: string): Availability {
  const [state, setState] = useState<Availability>('idle');

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed || (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))) {
      setState('idle');
      return;
    }
    setState('checking');
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/check-existence/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field, value: trimmed }),
          signal: controller.signal,
        });
        if (!res.ok) { setState('idle'); return; }
        const data = await res.json();
        setState(data.exists ? 'taken' : 'available');
      } catch {
        if (!controller.signal.aborted) setState('idle');
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [field, value]);

  return state;
}
