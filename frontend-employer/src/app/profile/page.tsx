'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2, UserCircle2, Building2, KeyRound, Save, CheckCircle2, Mail, ShieldCheck, ShieldAlert, Clock, ArrowRight,
} from 'lucide-react';
import { getToken, authHeaders } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Account {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
}

interface Employer {
  id: number;
  name: string;
  legal_name: string;
  industry: string;
  size: string;
  website: string;
  logo: string | null;
  logo_url: string;
  address: string;
  contact_email: string;
  contact_phone: string;
  kyc_status: 'pending' | 'approved' | 'rejected';
  role: 'owner' | 'admin' | 'recruiter';
}

type EmployerFields = Pick<Employer, 'name' | 'legal_name' | 'industry' | 'size' | 'website' | 'logo_url' | 'contact_phone' | 'address'>;

const INPUT = 'w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all disabled:opacity-60';
const LABEL = 'text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block';
const CARD = 'bg-white border border-black/[0.08] rounded-3xl p-6';

const ROLE_CLS: Record<Employer['role'], string> = {
  owner: 'bg-purple-600/10 text-purple-600',
  admin: 'bg-blue-500/10 text-blue-600',
  recruiter: 'bg-black/[0.05] text-[#0b0b0c]/55',
};

const KYC_CHIP: Record<Employer['kyc_status'], { cls: string; icon: React.ReactNode; label: string }> = {
  approved: { cls: 'bg-green-500/10 text-green-700', icon: <ShieldCheck size={12} />, label: 'Verified' },
  pending: { cls: 'bg-yellow-500/10 text-yellow-700', icon: <Clock size={12} />, label: 'KYC pending' },
  rejected: { cls: 'bg-red-500/10 text-red-600', icon: <ShieldAlert size={12} />, label: 'KYC rejected' },
};

// DRF errors come back as { field: [msg] } — flatten to one readable line.
const errorText = (data: unknown, fallback: string) => {
  if (data && typeof data === 'object') {
    const text = Object.values(data as Record<string, unknown>).flat().join(' ');
    if (text) return text;
  }
  return fallback;
};

function initials(first: string, last: string, fallback: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || fallback?.[0]?.toUpperCase() || '?';
}

function SavedNote({ show, text = 'Saved' }: { show: boolean; text?: string }) {
  if (!show) return null;
  return <span className="text-xs text-green-700 flex items-center gap-1"><CheckCircle2 size={14} /> {text}</span>;
}

export default function EmployerProfilePage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [loading, setLoading] = useState(true);

  const [accountForm, setAccountForm] = useState({ first_name: '', last_name: '', username: '', phone: '' });
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountSaved, setAccountSaved] = useState(false);

  const [employerForm, setEmployerForm] = useState<EmployerFields | null>(null);
  const [employerSaving, setEmployerSaving] = useState(false);
  const [employerError, setEmployerError] = useState('');
  const [employerSaved, setEmployerSaved] = useState(false);

  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  const flash = (set: (v: boolean) => void) => {
    set(true);
    setTimeout(() => set(false), 3000);
  };

  const applyAccount = (data: Account) => {
    setAccount(data);
    setAccountForm({ first_name: data.first_name || '', last_name: data.last_name || '', username: data.username || '', phone: data.phone || '' });
  };

  const applyEmployer = (data: Employer) => {
    setEmployer(data);
    setEmployerForm({
      name: data.name, legal_name: data.legal_name, industry: data.industry, size: data.size,
      website: data.website, logo_url: data.logo_url || '', contact_phone: data.contact_phone, address: data.address,
    });
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    const load = (url: string) => fetch(url, { headers: authHeaders(token) }).then((res) => (res.ok ? res.json() : Promise.reject(res.status)));
    Promise.all([load(`${API}/api/user/`), load(`${API}/employers/me/`)])
      .then(([user, emp]: [Account, Employer]) => { applyAccount(user); applyEmployer(emp); })
      .catch((status) => { if (status === 401) router.push('/login'); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setAccountSaving(true);
    setAccountError('');
    try {
      const res = await fetch(`${API}/api/user/`, {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(accountForm),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { applyAccount(data); flash(setAccountSaved); }
      else setAccountError(errorText(data, 'Failed to save your details.'));
    } catch {
      setAccountError('Failed to reach the server.');
    } finally {
      setAccountSaving(false);
    }
  };

  const saveEmployer = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token || !employerForm) return;
    setEmployerSaving(true);
    setEmployerError('');
    try {
      const res = await fetch(`${API}/employers/me/`, {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(employerForm),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { applyEmployer(data); flash(setEmployerSaved); }
      else setEmployerError(errorText(data, 'Failed to save employer details.'));
    } catch {
      setEmployerError('Failed to reach the server.');
    } finally {
      setEmployerSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setPasswordSaving(true);
    setPasswordError('');
    try {
      const res = await fetch(`${API}/employers/me/change-password/`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(passwords),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPasswords({ current_password: '', new_password: '', confirm_password: '' });
        flash(setPasswordSaved);
      } else {
        setPasswordError(errorText(data, 'Failed to update password.'));
      }
    } catch {
      setPasswordError('Failed to reach the server.');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading || !account || !employer || !employerForm) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  const canEditEmployer = employer.role === 'owner' || employer.role === 'admin';
  const fullName = [account.first_name, account.last_name].filter(Boolean).join(' ') || account.username;
  const kyc = KYC_CHIP[employer.kyc_status];
  const logoPreview = /^https?:\/\//.test(employerForm.logo_url.trim()) ? employerForm.logo_url.trim() : employer.logo;

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-6 sm:p-8 font-sans">
      <div className="mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <UserCircle2 size={28} className="text-purple-600" /> Profile
          </h1>
          <p className="text-[#0b0b0c]/60 font-medium">Your account and your employer&apos;s details.</p>
        </header>

        {/* Summary */}
        <div className={`${CARD} mb-6 flex flex-col sm:flex-row sm:items-center gap-4`}>
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-white flex items-center justify-center text-lg font-bold shrink-0">
              {initials(account.first_name, account.last_name, account.username)}
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold truncate">{fullName}</div>
              <div className="text-sm text-[#0b0b0c]/60 flex items-center gap-1.5 truncate"><Mail size={13} className="shrink-0" /> {account.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 min-w-0 sm:border-l sm:border-black/[0.08] sm:pl-4">
            {employer.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={employer.logo} alt="" className="w-10 h-10 rounded-xl object-contain bg-white border border-black/[0.06] shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0"><Building2 size={18} /></div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">{employer.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${ROLE_CLS[employer.role]}`}>{employer.role}</span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${kyc.cls}`}>{kyc.icon} {kyc.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Your account */}
        <form onSubmit={saveAccount} className={`${CARD} mb-6 space-y-4`}>
          <h2 className="text-lg font-bold flex items-center gap-2"><UserCircle2 size={18} className="text-purple-600" /> Your account</h2>
          {accountError && <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{accountError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>First name</label>
              <input type="text" value={accountForm.first_name} onChange={(e) => setAccountForm({ ...accountForm, first_name: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Last name</label>
              <input type="text" value={accountForm.last_name} onChange={(e) => setAccountForm({ ...accountForm, last_name: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Username</label>
              <input type="text" required value={accountForm.username} onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Phone</label>
              <input type="tel" value={accountForm.phone} onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })} className={INPUT} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL}>Login email</label>
              <input type="email" value={account.email} disabled className={INPUT} />
              <p className="text-xs text-[#0b0b0c]/50 mt-1.5">Ask your employer&apos;s owner or the Kaamlee team to change this.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={accountSaving} className="cursor-pointer inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all">
              {accountSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
            </button>
            <SavedNote show={accountSaved} />
          </div>
        </form>

        {/* Employer details */}
        <form onSubmit={saveEmployer} className={`${CARD} mb-6 space-y-4`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold flex items-center gap-2"><Building2 size={18} className="text-purple-600" /> Employer details</h2>
            <Link href="/kyc" className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 hover:underline shrink-0">
              Verification <ArrowRight size={13} />
            </Link>
          </div>
          {!canEditEmployer && (
            <div className="text-sm text-[#0b0b0c]/60 bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-3">
              Only an owner or admin can edit the employer&apos;s details.
            </div>
          )}
          {employerError && <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{employerError}</div>}

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-black/[0.03] border border-black/[0.08] flex items-center justify-center overflow-hidden shrink-0">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="" className="w-full h-full object-contain bg-white" />
              ) : (
                <Building2 size={22} className="text-[#0b0b0c]/30" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className={LABEL}>Logo URL</label>
              <input
                type="url"
                disabled={!canEditEmployer}
                placeholder="https://example.com/logo.png"
                value={employerForm.logo_url}
                onChange={(e) => setEmployerForm({ ...employerForm, logo_url: e.target.value })}
                className={INPUT}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ['name', 'Employer name', 'text'],
              ['legal_name', 'Legal name', 'text'],
              ['industry', 'Industry', 'text'],
              ['size', 'Company size', 'text'],
              ['website', 'Website', 'url'],
              ['contact_phone', 'Contact phone', 'tel'],
            ] as [keyof EmployerFields, string, string][]).map(([key, label, type]) => (
              <div key={key}>
                <label className={LABEL}>{label}</label>
                <input
                  type={type}
                  disabled={!canEditEmployer}
                  value={employerForm[key]}
                  onChange={(e) => setEmployerForm({ ...employerForm, [key]: e.target.value })}
                  className={INPUT}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className={LABEL}>Address</label>
              <input
                type="text"
                disabled={!canEditEmployer}
                value={employerForm.address}
                onChange={(e) => setEmployerForm({ ...employerForm, address: e.target.value })}
                className={INPUT}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL}>Contact email</label>
              <input type="email" value={employer.contact_email} disabled className={INPUT} />
              <p className="text-xs text-[#0b0b0c]/50 mt-1.5">Set by the Kaamlee team — contact support to change it.</p>
            </div>
          </div>

          {canEditEmployer && (
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={employerSaving} className="cursor-pointer inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all">
                {employerSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save employer details
              </button>
              <SavedNote show={employerSaved} />
            </div>
          )}
        </form>

        {/* Password */}
        <form onSubmit={changePassword} className={`${CARD} space-y-4`}>
          <h2 className="text-lg font-bold flex items-center gap-2"><KeyRound size={18} className="text-purple-600" /> Change password</h2>
          {passwordError && <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{passwordError}</div>}
          <div>
            <label className={LABEL}>Current password</label>
            <input type="password" required autoComplete="current-password" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} className={INPUT} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>New password</label>
              <input type="password" required autoComplete="new-password" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Confirm new password</label>
              <input type="password" required autoComplete="new-password" value={passwords.confirm_password} onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })} className={INPUT} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={passwordSaving} className="cursor-pointer inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all">
              {passwordSaving && <Loader2 size={16} className="animate-spin" />} Update password
            </button>
            <SavedNote show={passwordSaved} text="Password updated" />
          </div>
        </form>
      </div>
    </div>
  );
}
