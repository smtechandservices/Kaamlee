'use client';

import { createContext, useContext } from 'react';
import type { Me } from '@/lib/useAmbassador';

const AmbassadorContext = createContext<Me | null>(null);

export const AmbassadorProvider = AmbassadorContext.Provider;

export function useAmbassadorContext(): Me {
  const ctx = useContext(AmbassadorContext);
  if (!ctx) {
    throw new Error('useAmbassadorContext must be used within the portal layout.');
  }
  return ctx;
}
