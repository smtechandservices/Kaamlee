'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Lock, User, AlertCircle, ArrowRight, Building2, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { setToken, authHeaders } from '@/lib/auth';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;
const EMPLOYERS_BASE = `${process.env.NEXT_PUBLIC_API_URL}/employers`;

export default function EmployerLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.non_field_errors?.[0] || 'Invalid username or password.');
        return;
      }

      // Confirm this login actually belongs to an employer account before
      // letting it in — the same User/token model is shared with the
      // candidate app, so a candidate's own credentials would otherwise
      // "work" here too.
      const meRes = await fetch(`${EMPLOYERS_BASE}/me/`, { headers: authHeaders(data.token) });
      if (!meRes.ok) {
        setError("This account isn't linked to an employer. Sign up for Kaamlee for Business first.");
        return;
      }

      setToken(data.token);
      router.push('/');
    } catch (err) {
      setError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-600/20 mb-4">
            <Building2 className="text-purple-600" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-[#0b0b0c] tracking-tight">Kaamlee for Business</h1>
          <p className="text-[#0b0b0c]/60 mt-2 font-medium">Sign in to manage your hiring</p>
        </div>

        <div className="bg-white border border-black/[0.08] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600" />

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#0b0b0c]/60 mb-2 px-1">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0b0b0c]/70" size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white border border-black/[0.08] rounded-xl py-3 pl-12 pr-4 text-[#0b0b0c] focus:outline-none focus:border-purple-600 transition-all"
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#0b0b0c]/60 mb-2 px-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0b0b0c]/70" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-black/[0.08] rounded-xl py-3 pl-12 pr-12 text-[#0b0b0c] focus:outline-none focus:border-purple-600 transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 text-[#0b0b0c]/40 hover:text-[#0b0b0c] transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-red-500 text-sm font-medium"
              >
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="cursor-pointer w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/20 group"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Log In
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-[#0b0b0c]/60 text-sm">
          New employer? Contact the Kaamlee team to get your account set up.
        </p>
      </motion.div>
    </div>
  );
}
