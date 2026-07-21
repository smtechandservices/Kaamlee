'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { isSubscriptionActive } from '@/lib/subscription';

// Redirects unauthenticated users to /login and authenticated-but-unsubscribed
// users to /pricing. `isReady` gates rendering of the page's real content —
// pages should show their existing loading spinner while it's false.
export function useSubscriptionGate() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const isSubscribed = isSubscriptionActive(user);

  useEffect(() => {
    if (isLoading) return;
    if (!token) {
      router.push('/login');
      return;
    }
    if (user && !isSubscribed) {
      router.push('/pricing');
    }
  }, [isLoading, token, user, isSubscribed, router]);

  const isReady = !isLoading && !!token && !!user && isSubscribed;
  return { isReady, isSubscribed, isLoading, token };
}
