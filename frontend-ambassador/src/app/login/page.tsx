'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, User, AlertCircle, ArrowLeft } from 'lucide-react';
import { ambassadorFetch, setToken } from '@/lib/api';

const inputClass = 'w-full rounded-full border border-black/10 bg-white pl-12 pr-4 py-3.5 text-[14.5px] outline-none transition-all placeholder:text-black/35 focus:border-[#16A34A] focus:shadow-[0_0_0_4px_rgba(22,163,74,.12)]';

export default function AmbassadorLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await ambassadorFetch('/login/', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || data.non_field_errors?.[0] || 'Invalid username or password.');
        return;
      }

      setToken(data.token);
      router.push(data.must_change_password ? '/change-password' : '/dashboard');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FAF9F6] px-5 py-14 text-[#0A0A0A]"
      style={{ fontFamily: 'var(--font-jakarta), ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="pointer-events-none absolute top-24 right-8 w-32 h-32 md:w-40 md:h-40 opacity-90 animate-[spin_44s_linear_infinite]">
        <div
          className="w-full h-full bg-[#4F46E5]"
          style={{ clipPath: 'polygon(50% 0%,58% 32%,79% 8%,71% 38%,97% 27%,80% 50%,97% 73%,71% 62%,79% 92%,58% 68%,50% 100%,42% 68%,21% 92%,29% 62%,3% 73%,20% 50%,3% 27%,29% 38%,21% 8%,42% 32%)' }}
        />
      </div>
      <div className="pointer-events-none absolute bottom-16 left-6 w-16 h-16 md:w-20 md:h-20 animate-bounce [animation-duration:3.4s]">
        <div
          className="w-full h-full bg-[#FF4D2E]"
          style={{ clipPath: 'polygon(50% 0%,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0% 50%,40% 40%)' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <Link href="/" className="mb-8 flex items-center gap-1.5 text-[14px] font-semibold text-[#57534E] transition-colors hover:text-[#0A0A0A]" style={{ fontFamily: 'var(--font-outfit)' }}>
          <ArrowLeft size={15} /> Back to Campus Ambassador
        </Link>

        <div className="rounded-[28px] border border-[#E7E5E0] bg-white p-8">
          <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-lg border border-black/10">
            <Image src="/logo.png" alt="Kaamlee" width={44} height={44} className="h-full w-full object-cover" />
          </span>
          <h1 className="mt-5 font-[var(--font-outfit)] text-[28px] font-semibold tracking-tighter">
            Ambassador login
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[#6B7280]">
            Sign in with the username and password your admin gave you.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35" />
              <input
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className={inputClass}
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={inputClass}
              />
            </div>

            {error && (
              <p className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-[13.5px] text-red-700">
                <AlertCircle size={15} className="mt-0.5 flex-none" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex items-center justify-center gap-2 rounded-full bg-[#16A34A] py-[15px] text-[15px] font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#0A0A0A] disabled:opacity-60 disabled:hover:translate-y-0"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              {loading ? <><Loader2 size={17} className="animate-spin" /> Logging in…</> : 'Log in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[13.5px] text-[#6B7280]">
          Not an ambassador yet? <Link href="/apply" className="font-semibold text-[#16A34A] hover:underline">Apply here</Link>
        </p>
      </div>
    </main>
  );
}
