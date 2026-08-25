'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, AlertCircle, KeyRound } from 'lucide-react';
import { ambassadorFetch, getToken, clearToken } from '@/lib/api';

const inputClass = 'w-full rounded-full border border-black/10 bg-white pl-12 pr-4 py-3.5 text-[14.5px] outline-none transition-all placeholder:text-black/35 focus:border-[#16A34A] focus:shadow-[0_0_0_4px_rgba(22,163,74,.12)]';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [mustChange, setMustChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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
      const data = await res.json().catch(() => ({}));
      setMustChange(Boolean(data.must_change_password));
      setChecking(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (newPassword !== confirmPassword) {
      setErrors({ confirm_password: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      const res = await ambassadorFetch('/change-password/', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const flat: Record<string, string> = {};
        Object.entries(data).forEach(([key, val]) => {
          flat[key] = Array.isArray(val) ? String(val[0]) : String(val);
        });
        setErrors(flat);
        return;
      }

      router.push('/dashboard');
    } catch {
      setErrors({ detail: 'Could not reach the server. Check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6]">
        <Loader2 className="animate-spin text-[#16A34A]" size={28} />
      </main>
    );
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#FAF9F6] px-5 py-14 text-[#0A0A0A]"
      style={{ fontFamily: 'var(--font-jakarta), ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="w-full max-w-[420px]">
        <div className="rounded-[28px] border border-[#E7E5E0] bg-white p-8">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[#eafaf0] text-[#16A34A]">
            <KeyRound size={20} />
          </span>
          <h1 className="mt-5 font-[var(--font-outfit)] text-[28px] font-semibold tracking-tighter">
            {mustChange ? 'Set a new password' : 'Change password'}
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[#6B7280]">
            {mustChange
              ? "You're logging in with a temporary password. Set your own before continuing to the dashboard."
              : 'Enter your current password and choose a new one.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35" />
              <input
                type="password"
                required
                autoFocus
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className={inputClass}
              />
            </div>
            {errors.current_password && <p className="-mt-2 ml-1 text-[13px] text-red-600">{errors.current_password}</p>}

            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35" />
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className={inputClass}
              />
            </div>
            {errors.new_password && <p className="-mt-2 ml-1 text-[13px] text-red-600">{errors.new_password}</p>}

            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={inputClass}
              />
            </div>
            {errors.confirm_password && <p className="-mt-2 ml-1 text-[13px] text-red-600">{errors.confirm_password}</p>}
            {errors.detail && (
              <p className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-[13.5px] text-red-700">
                <AlertCircle size={15} className="mt-0.5 flex-none" /> {errors.detail}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex items-center justify-center gap-2 rounded-full bg-[#16A34A] py-[15px] text-[15px] font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#0A0A0A] disabled:opacity-60 disabled:hover:translate-y-0"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              {loading ? <><Loader2 size={17} className="animate-spin" /> Saving…</> : 'Save password'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
