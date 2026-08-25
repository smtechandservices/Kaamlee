'use client';

import React, { useEffect, useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import OtpDigitInput from './OtpDigitInput';
import { PRIMARY_BTN_CLS, PRIMARY_BTN_BG, SECONDARY_BTN_CLS } from '@/components/ui/landing-kit';
import { getReferralCode } from '@/lib/referral';

interface EmailOtpFormProps {
  onError: (message: string) => void;
  setLoading?: (loading: boolean) => void;
}

const RESEND_COOLDOWN_SECONDS = 60;

export default function EmailOtpForm({ onError, setLoading }: EmailOtpFormProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const sendCode = async () => {
    if (!email.trim()) {
      onError('Please enter your email address.');
      return;
    }

    onError('');
    setIsSending(true);
    setLoading?.(true);
    try {
      const response = await fetch('/api/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setCodeSent(true);
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setCode('');
      } else {
        onError(data.error || 'Could not send code. Please try again.');
      }
    } catch (err) {
      onError('An error occurred. Please try again later.');
    } finally {
      setIsSending(false);
      setLoading?.(false);
    }
  };

  const verifyCode = async (submittedCode: string) => {
    if (submittedCode.length < 6) {
      onError('Please enter the code sent to your email.');
      return;
    }

    onError('');
    setIsVerifying(true);
    setLoading?.(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/otp/verify/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: submittedCode, referral_code: getReferralCode() }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        login(data.token);
      } else {
        onError(data.error || 'Invalid code. Please try again.');
      }
    } catch (err) {
      onError('An error occurred. Please try again later.');
    } finally {
      setIsVerifying(false);
      setLoading?.(false);
    }
  };

  if (!codeSent) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendCode(); } }}
            placeholder="name@example.com"
            className="w-full bg-white border border-black/[0.10] rounded-full pl-12 pr-4 py-3 text-sm outline-none transition-all placeholder-black/30 focus:border-[#16a34a] focus:shadow-[0_0_0_4px_rgba(22,163,74,.12)]"
          />
        </div>
        <button
          type="button"
          onClick={sendCode}
          disabled={isSending}
          className={SECONDARY_BTN_CLS + ' w-full'}
        >
          {isSending ? <Loader2 size={18} className="animate-spin" /> : 'Send Code'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-black/45 ml-1">Code sent to {email}</p>
      <OtpDigitInput value={code} onChange={setCode} onComplete={verifyCode} autoFocus />
      <button
        type="button"
        onClick={() => verifyCode(code)}
        disabled={isVerifying}
        className={PRIMARY_BTN_CLS + ' w-full'}
        style={PRIMARY_BTN_BG}
      >
        {isVerifying ? <Loader2 size={18} className="animate-spin" /> : 'Verify Code'}
      </button>
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => { setCodeSent(false); setCode(''); }}
          className="cursor-pointer text-xs text-black/45 hover:text-[#0b0b0c] transition-colors"
        >
          Change email
        </button>
        <button
          type="button"
          onClick={sendCode}
          disabled={cooldown > 0 || isSending}
          className="cursor-pointer text-xs text-black/45 hover:text-[#0b0b0c] transition-colors disabled:opacity-50 disabled:cursor-default"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </div>
  );
}
