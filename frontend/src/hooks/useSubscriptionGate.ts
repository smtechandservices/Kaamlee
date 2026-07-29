'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { isSubscriptionActive } from '@/lib/subscription';

// Redirects unauthenticated users to /login. Authenticated-but-unsubscribed
// users are sent to /pricing UNLESS `allowUnsubscribed` is set, in which case
// they're let through (e.g. explore's free recent-jobs preview) and `isReady`
// only requires auth, not an active subscription. `isReady` gates rendering
// of the page's real content — pages should show their existing loading
// spinner while it's false.
export function useSubscriptionGate(options?: { allowUnsubscribed?: boolean }) {
  const allowUnsubscribed = options?.allowUnsubscribed ?? false;
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const isSubscribed = isSubscriptionActive(user);

  useEffect(() => {
    if (isLoading) return;
    if (!token) {
      router.push('/login');
      return;
    }
    if (user && !isSubscribed && !allowUnsubscribed) {
      router.push('/pricing');
    }
  }, [isLoading, token, user, isSubscribed, allowUnsubscribed, router]);

  const isReady = !isLoading && !!token && !!user && (isSubscribed || allowUnsubscribed);
  return { isReady, isSubscribed, isLoading, token };
}
