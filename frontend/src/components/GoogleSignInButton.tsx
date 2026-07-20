'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { Loader2, Phone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface GoogleSignInButtonProps {
  onError: (message: string) => void;
  setLoading?: (loading: boolean) => void;
}

export default function GoogleSignInButton({ onError, setLoading }: GoogleSignInButtonProps) {
  const { login } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  // Google's button is an iframe with a fixed pixel width. We measure the container
  // once before first paint so GoogleLogin mounts with its final width already —
  // changing `width` after mount re-triggers its internal google.accounts.id.initialize().
  const [width, setWidth] = useState<number>();

  // Google's ID token never includes a phone number. New Google accounts are created
  // with it blank, so we hold the issued token here and collect it before logging in.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isSubmittingPhone, setIsSubmittingPhone] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));

    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth((prev) => (Math.round(w) !== prev ? Math.round(w) : prev));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      onError('Google sign-in failed.');
      return;
    }

    setLoading?.(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.user?.phone) {
          login(data.token);
        } else {
          setPendingToken(data.token);
        }
      } else {
        onError(data.error || 'Google sign-in failed.');
      }
    } catch (err) {
      onError('An error occurred. Please try again later.');
    } finally {
      setLoading?.(false);
    }
  };

  const handlePhoneSubmit = async () => {
    if (!pendingToken) return;
    setPhoneError('');

    if (!phone.trim()) {
      setPhoneError('Please enter a phone number.');
      return;
    }

    setIsSubmittingPhone(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${pendingToken}`,
        },
        body: JSON.stringify({ phone }),
      });

      if (response.ok) {
        login(pendingToken);
      } else {
        const data = await response.json().catch(() => ({}));
        setPhoneError(data.phone?.[0] || 'Could not save phone number.');
      }
    } catch (err) {
      setPhoneError('An error occurred. Please try again.');
    } finally {
      setIsSubmittingPhone(false);
    }
  };

  const handleSkipPhone = () => {
    if (pendingToken) login(pendingToken);
  };

  if (pendingToken) {
    return (
      <div className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl p-5 space-y-4">
        <div>
          <p className="text-sm font-bold text-white mb-1">Add your phone number</p>
          <p className="text-xs text-[#888]">Google doesn't share this with us — we need it to finish setting up your account.</p>
        </div>

        {phoneError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2 px-3 rounded-lg">
            {phoneError}
          </div>
        )}

        {/* Not a <form> — this component can be rendered inside the page's own <form> (e.g. login/signup),
            and HTML disallows nested forms. Enter-to-submit is wired up manually below instead. */}
        <div className="space-y-3">
          <div className="relative">
            <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444]" />
            <input
              type="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePhoneSubmit();
                }
              }}
              placeholder="987..."
              className="w-full bg-[#111] border border-[#222] rounded-xl pl-12 pr-4 py-3 text-sm focus:border-green-500/50 outline-none transition-all placeholder-[#333]"
            />
          </div>

          <button
            type="button"
            onClick={handlePhoneSubmit}
            disabled={isSubmittingPhone}
            className="cursor-pointer w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-[#ededed] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmittingPhone ? <Loader2 size={18} className="animate-spin" /> : 'Continue'}
          </button>

          <button
            type="button"
            onClick={handleSkipPhone}
            className="cursor-pointer w-full text-center text-xs text-[#666] hover:text-white transition-colors py-1"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full group/google">
      <div className="absolute -inset-1 bg-gradient-to-r from-green-600 to-green-400 rounded-xl blur opacity-0 group-hover/google:opacity-40 transition duration-700" />
      <div ref={containerRef} className="relative w-full flex justify-center rounded-xl overflow-hidden">
        {width && (
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => onError('Google sign-in failed.')}
            theme="outline"
            shape="rectangular"
            size="large"
            text="continue_with"
            logo_alignment="center"
            width={width}
          />
        )}
      </div>
    </div>
  );
}
