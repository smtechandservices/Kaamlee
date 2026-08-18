'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import EmailOtpForm from '@/components/EmailOtpForm';
import { PRIMARY_BTN_CLS, PRIMARY_BTN_BG } from '@/components/ui/landing-kit';

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

  return (
    <main className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#16a34a]/[0.06] blur-[120px] rounded-full pointer-events-none" />

      <Link href="/" className="absolute top-6 left-6 sm:top-8 sm:left-8 text-black/45 hover:text-[#0b0b0c] transition-colors flex items-center gap-2 text-xs sm:text-sm font-medium z-20" style={{ fontFamily: 'var(--font-outfit)' }}>
        <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Back to Home</span>
        <span className="sm:hidden">Back</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-8 sm:mb-10">
          <h1
            className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] mb-2"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            Welcome back
          </h1>
          <p className="text-sm sm:text-base text-[rgba(61,61,61,0.72)]">Log in to your Kaamlee account</p>
        </div>

        <div className="bg-white border border-black/[0.08] rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 shadow-[0_30px_80px_-30px_rgba(16,18,26,.35)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs py-3 px-4 rounded-2xl">
                {error}
              </div>
            )}

            <GoogleSignInButton onError={setError} setLoading={setIsSubmitting} />

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-black/[0.08]" />
              <span
                className="text-[10px] font-semibold uppercase tracking-widest text-black/40"
                style={{ fontFamily: 'var(--font-outfit)' }}
              >
                Or
              </span>
              <div className="flex-1 h-px bg-black/[0.08]" />
            </div>

            {useOtp ? (
              <EmailOtpForm onError={setError} setLoading={setIsSubmitting} />
            ) : (
              <>
                <div className="space-y-2">
                  <label
                    className="text-xs font-semibold text-black/45 uppercase tracking-wide ml-1"
                    style={{ fontFamily: 'var(--font-outfit)' }}
                  >
                    Username
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="johndoe"
                      className="w-full bg-white border border-black/[0.10] rounded-full pl-12 pr-4 py-3.5 text-[15px] outline-none transition-all placeholder-black/30 focus:border-[#16a34a] focus:shadow-[0_0_0_4px_rgba(22,163,74,.12)]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label
                      className="text-xs font-semibold text-black/45 uppercase tracking-wide"
                      style={{ fontFamily: 'var(--font-outfit)' }}
                    >
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-black/[0.10] rounded-full pl-12 pr-12 py-3.5 text-[15px] outline-none transition-all placeholder-black/30 focus:border-[#16a34a] focus:shadow-[0_0_0_4px_rgba(22,163,74,.12)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-black/35 hover:text-black/60 transition-colors z-10 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`${PRIMARY_BTN_CLS} w-full mt-4`}
                  style={PRIMARY_BTN_BG}
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Log In'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => { setUseOtp(!useOtp); setError(''); }}
              className="cursor-pointer w-full text-center text-xs text-black/45 hover:text-[#0b0b0c] transition-colors"
            >
              {useOtp ? 'Sign in with username & password instead' : 'Sign in with a one-time email code instead'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-[rgba(61,61,61,0.72)]">
            Don't have an account? <Link href="/signup" className="text-[#16a34a] font-medium hover:underline">Sign up</Link>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
