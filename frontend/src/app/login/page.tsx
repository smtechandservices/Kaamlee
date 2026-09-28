'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LogIn, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import EmailOtpForm from '@/components/EmailOtpForm';
import AuthSplitLayout, {
  AUTH_INPUT_CLS, AUTH_SUBMIT_CLS, AUTH_SUBMIT_BG, AUTH_LINK_CLS, AuthError, AuthDivider, AuthNote,
} from '@/components/AuthSplitLayout';
import { withNext } from '@/lib/redirect';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [useOtp, setUseOtp] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.token);
      } else {
        setError('Invalid username or password.');
      }
    } catch (err) {
      setError('An error occurred. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (otp: boolean) => {
    setUseOtp(otp);
    setError('');
  };

  return (
    <AuthSplitLayout
      title={<>Sign <span className="italic font-normal">in.</span></>}
      subtitle="One login for job search, applications and your custom CVs."
    >
      <form onSubmit={handleSubmit} className="mt-7 sm:mt-9 space-y-3.5 sm:space-y-4">
        <AuthError message={error} />

        {useOtp ? (
          <>
            <EmailOtpForm onError={setError} setLoading={setIsSubmitting} />
            <button type="button" onClick={() => switchMode(false)} className={AUTH_LINK_CLS}>
              Use username & password instead
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              required
              autoComplete="username"
              aria-label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className={AUTH_INPUT_CLS}
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={`${AUTH_INPUT_CLS} pr-14`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="cursor-pointer absolute right-5 top-1/2 -translate-y-1/2 text-black/45 hover:text-black/70 transition-colors"
              >
                {showPassword ? <Eye size={19} /> : <EyeOff size={19} />}
              </button>
            </div>

            <button type="button" onClick={() => switchMode(true)} className={`${AUTH_LINK_CLS} block pt-1`}>
              Forgot password? Sign in with an email code
            </button>

            <button type="submit" disabled={isSubmitting} className={`${AUTH_SUBMIT_CLS} mt-7!`} style={AUTH_SUBMIT_BG}>
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <LogIn size={17} />
                  Sign in
                </>
              )}
            </button>
          </>
        )}

        <div className="mt-7!">
          <AuthDivider />
        </div>

        <GoogleSignInButton onError={setError} setLoading={setIsSubmitting} />
      </form>

      <AuthNote>
        New to Kaamlee?{' '}
        <Link href={withNext('/signup')} className="font-medium text-[#16a34a] hover:underline">
          Create a free account
        </Link>{' '}
        and start applying in minutes.
      </AuthNote>
    </AuthSplitLayout>
  );
}
