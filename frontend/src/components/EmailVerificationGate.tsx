'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import OtpDigitInput from './OtpDigitInput';

interface EmailVerificationGateProps {
  email: string;
  verified: boolean;
  onVerified: () => void;
  onError: (message: string) => void;
  /** Passed through to /api/otp/request — e.g. 'signup' blocks sending when the
   * email is already registered. Omit for already-owned emails (e.g. change-password). */
  purpose?: string;
}

const RESEND_COOLDOWN_SECONDS = 60;

export default function EmailVerificationGate({ email, verified, onVerified, onError, purpose }: EmailVerificationGateProps) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Editing the email after a code was sent invalidates that code — derived
  // during render rather than synced via an effect.
  const codeSentForCurrentEmail = sentTo !== null && sentTo === email;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const sendCode = async () => {
    if (!email.trim()) {
      onError('Enter your email address first.');
      return;
    }

    onError('');
    setIsSending(true);
    try {
      const response = await fetch('/api/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setSentTo(email);
        setCode('');
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        onError(data.error || 'Could not send code. Please try again.');
      }
    } catch (err) {
      onError('An error occurred. Please try again later.');
    } finally {
      setIsSending(false);
    }
  };

  const confirmCode = async (submittedCode: string) => {
    if (submittedCode.length < 6) {
      onError('Please enter the 6-digit code.');
      return;
    }

    onError('');
    setIsVerifying(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/otp/confirm/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: submittedCode }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        onVerified();
      } else {
        onError(data.error || 'Invalid code. Please try again.');
      }
    } catch (err) {
      onError('An error occurred. Please try again later.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (verified) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-bold text-green-500 ml-1">
        <CheckCircle2 size={14} /> Email verified
      </div>
    );
  }

  if (!codeSentForCurrentEmail) {
    return (
      <button
        type="button"
        onClick={sendCode}
        disabled={isSending || !email.trim()}
        className="cursor-pointer text-xs font-bold text-white bg-[#1a1a1a] border border-[#222] rounded-lg px-3 py-2 hover:bg-[#222] transition-all disabled:opacity-50 flex items-center gap-2"
      >
        {isSending ? <Loader2 size={14} className="animate-spin" /> : 'Verify email'}
      </button>
    );
  }

  return (
    <div className="space-y-3 bg-[#0a0a0a] border border-[#222] rounded-xl p-4">
      <p className="text-xs text-[#888]">Enter the code sent to {sentTo}</p>
      <OtpDigitInput value={code} onChange={setCode} onComplete={confirmCode} autoFocus />
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => confirmCode(code)}
          disabled={isVerifying}
          className="cursor-pointer text-xs font-bold text-white hover:underline disabled:opacity-50 flex items-center gap-1.5"
        >
          {isVerifying ? <Loader2 size={14} className="animate-spin" /> : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={sendCode}
          disabled={cooldown > 0 || isSending}
          className="cursor-pointer text-xs text-[#666] hover:text-white transition-colors disabled:opacity-50"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </div>
  );
}
