'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ambassadorFetch, clearToken, getToken } from './api';

export interface Me {
  username: string;
  full_name: string;
  email: string;
  phone: string;
  college_name: string;
  course: string;
  referral_code: string;
  must_change_password: boolean;
}

// Shared auth guard + profile fetch for every page inside the portal shell:
// bounces to /login with no token, to /change-password with a still-temp one.
export function useAmbassador() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }

    (async () => {
      const res = await ambassadorFetch('/me/');
      if (res.status === 401) {
        clearToken();
        router.push('/login');
        return;
      }
      const data: Me = await res.json();
      if (data.must_change_password) {
        router.push('/change-password');
        return;
      }
      setMe(data);
      setLoading(false);
    })();
  }, [router]);

  return { me, loading };
}
