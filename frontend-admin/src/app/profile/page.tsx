'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserCircle2, KeyRound, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface AdminUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_superuser: boolean;
  is_staff: boolean;
}

const INPUT_CLASS = 'w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 transition-all';
const LABEL_CLASS = 'text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block';

// DRF errors come back as { field: [msg] } — flatten to one readable line.
const errorText = (data: unknown, fallback: string) => {
  if (data && typeof data === 'object') {
    const text = Object.values(data as Record<string, unknown>).flat().join(' ');
    if (text) return text;
  }
  return fallback;
};

export default function AdminProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordChanged, setPasswordChanged] = useState(false);

  const getToken = () => {
    const token = localStorage.getItem('admin_token');
    if (!token) router.push('/login');
    return token;
  };

  const applyUser = (data: AdminUser) => {
    setUser(data);
    setFirstName(data.first_name || '');
    setLastName(data.last_name || '');
    setUsername(data.username || '');
    setPhone(data.phone || '');
  };

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API_BASE}/user/`, { headers: { Authorization: `Token ${token}` } })
      .then(async (res) => {
        if (res.status === 401) { router.push('/login'); return; }
        if (res.ok) applyUser(await res.json());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const res = await fetch(`${API_BASE}/user/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, username, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        applyUser(data);
        // The sidebar reads the admin's name/initials from here.
        localStorage.setItem('admin_user', JSON.stringify(data));
        window.dispatchEvent(new Event('admin-user-updated'));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setSaveError(errorText(data, 'Failed to save changes.'));
      }
    } catch {
      setSaveError('Failed to reach the server.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setChangingPassword(true);
    setPasswordError('');
    setPasswordChanged(false);
    try {
      const res = await fetch(`${API_BASE}/admin/me/change-password/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordChanged(true);
        setTimeout(() => setPasswordChanged(false), 3000);
      } else {
        setPasswordError(errorText(data, 'Failed to update password.'));
      }
    } catch {
      setPasswordError('Failed to reach the server.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      </div>
    );
  }

  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'A';
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username;

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <UserCircle2 size={28} className="text-purple-600" />
            Profile
          </h1>
          <p className="text-[#0b0b0c]/60 font-medium">Your admin account details</p>
        </header>

        <div className="bg-white border border-black/[0.08] rounded-3xl p-6 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#4ade80] to-[#16a34a] flex items-center justify-center text-lg font-bold text-white shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold truncate">{fullName}</div>
            <div className="text-sm text-[#0b0b0c]/60 flex items-center gap-1.5 truncate">
              <Mail size={13} className="shrink-0" /> {user?.email || 'No email set'}
            </div>
          </div>
          <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border bg-purple-600/10 text-purple-600 border-purple-600/30">
            <ShieldCheck size={12} /> {user?.is_superuser ? 'Superuser' : 'Staff'}
          </span>
        </div>

        <form onSubmit={handleSave} className="bg-white border border-black/[0.08] rounded-3xl p-6 mb-6 space-y-4">
          <h2 className="text-lg font-bold">Account details</h2>
          {saveError && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{saveError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>First name</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Last name</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Username</label>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS}>Email</label>
              <input type="email" value={user?.email || ''} disabled className={`${INPUT_CLASS} opacity-60 cursor-not-allowed`} />
              <p className="text-xs text-[#0b0b0c]/50 mt-1.5">Email can&apos;t be changed here.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Save changes
            </button>
            {saved && (
              <span className="text-sm text-green-700 flex items-center gap-1.5"><CheckCircle2 size={15} /> Saved</span>
            )}
          </div>
        </form>

        <form onSubmit={handleChangePassword} className="bg-white border border-black/[0.08] rounded-3xl p-6 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><KeyRound size={18} className="text-purple-600" /> Change password</h2>
          {passwordError && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{passwordError}</div>
          )}
          <div>
            <label className={LABEL_CLASS}>Current password</label>
            <input type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>New password</label>
              <input type="password" required autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Confirm new password</label>
              <input type="password" required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={INPUT_CLASS} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={changingPassword}
              className="cursor-pointer inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            >
              {changingPassword && <Loader2 size={16} className="animate-spin" />}
              Update password
            </button>
            {passwordChanged && (
              <span className="text-sm text-green-700 flex items-center gap-1.5"><CheckCircle2 size={15} /> Password updated</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
