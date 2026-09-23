'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Users, UserPlus, Mail, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { getToken, authHeaders } from '@/lib/auth';
import { useAvailability, type Availability } from '@/lib/useAvailability';

const EMPLOYERS_BASE = `${process.env.NEXT_PUBLIC_API_URL}/employers`;

interface EmployerMember {
  id: number;
  username: string;
  email: string;
  role: 'owner' | 'admin' | 'recruiter';
  created_at: string;
}

interface MeResponse {
  role: 'owner' | 'admin' | 'recruiter';
}

const ROLE_STYLES: Record<EmployerMember['role'], string> = {
  owner: 'bg-purple-600/10 text-purple-600 border-purple-600/30',
  admin: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  recruiter: 'bg-black/[0.04] text-[#0b0b0c]/60 border-black/[0.08]',
};

export default function TeamPage() {
  const [members, setMembers] = useState<EmployerMember[]>([]);
  const [myRole, setMyRole] = useState<EmployerMember['role'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'recruiter'>('recruiter');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const usernameState = useAvailability('username', username);
  const emailState = useAvailability('email', email);
  const router = useRouter();

  // Managing the team itself — inviting, changing roles, removing someone —
  // is owner-only. Admins can do everything hiring-related but not this.
  const canManage = myRole === 'owner';

  const load = async () => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      const [teamRes, meRes] = await Promise.all([
        fetch(`${EMPLOYERS_BASE}/team/`, { headers: authHeaders(token) }),
        fetch(`${EMPLOYERS_BASE}/me/`, { headers: authHeaders(token) }),
      ]);
      if (teamRes.status === 401) { router.push('/login'); return; }
      if (teamRes.ok) setMembers(await teamRes.json());
      if (meRes.ok) setMyRole(((await meRes.json()) as MeResponse).role);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setInviting(true);
    setError('');
    try {
      const res = await fetch(`${EMPLOYERS_BASE}/team/invite/`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, confirm_password: confirmPassword, role }),
      });
      if (res.ok) {
        setUsername(''); setEmail(''); setPassword(''); setConfirmPassword(''); setRole('recruiter');
        setShowInvite(false);
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(Object.values(data).flat().join(' ') || 'Failed to add teammate.');
      }
    } catch {
      setError('Failed to reach the server.');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: number, newRole: 'admin' | 'recruiter') => {
    const token = getToken();
    if (!token) return;
    setUpdatingId(memberId);
    try {
      const res = await fetch(`${EMPLOYERS_BASE}/team/${memberId}/`, {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...updated } : m)));
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemove = async (member: EmployerMember) => {
    const token = getToken();
    if (!token) return;
    if (!confirm(`Remove ${member.username} from the team? This deletes their login.`)) return;
    setUpdatingId(member.id);
    try {
      const res = await fetch(`${EMPLOYERS_BASE}/team/${member.id}/`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
      }
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f3f5] text-[#0b0b0c] p-8 font-sans">
      <div className="mx-auto">
        <header className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <Users size={28} className="text-purple-600" /> Team
            </h1>
            <p className="text-[#0b0b0c]/60 font-medium">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowInvite((v) => !v)}
              className="cursor-pointer inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            >
              <UserPlus size={16} /> Add teammate
            </button>
          )}
        </header>

        {showInvite && (
          <form onSubmit={handleInvite} className="bg-white border border-black/[0.08] rounded-3xl p-6 mb-8">
            {error && (
              <div className="mb-4 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Username</label>
                <input type="text" required autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)}
                  className={`w-full bg-black/[0.03] border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all ${usernameState === 'taken' ? 'border-red-500' : 'border-black/[0.08]'}`} />
                <AvailabilityHint state={usernameState} takenLabel="Username already taken" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Email</label>
                <input type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)}
                  className={`w-full bg-black/[0.03] border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all ${emailState === 'taken' ? 'border-red-500' : 'border-black/[0.08]'}`} />
                <AvailabilityHint state={emailState} takenLabel="Email already in use" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Password</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Confirm password</label>
                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#0b0b0c]/60 mb-1.5 block">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'recruiter')}
                  className="w-full bg-black/[0.03] border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-600 transition-all cursor-pointer">
                  <option value="recruiter">Recruiter</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button type="submit" disabled={inviting || usernameState === 'taken' || emailState === 'taken'}
                className="cursor-pointer inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all">
                {inviting ? <Loader2 size={16} className="animate-spin" /> : 'Add teammate'}
              </button>
              <button type="button" onClick={() => setShowInvite(false)}
                className="cursor-pointer px-5 py-2.5 rounded-xl text-sm font-semibold text-[#0b0b0c]/60 hover:text-[#0b0b0c] transition-all">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="bg-white border border-black/[0.08] rounded-3xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black/[0.08] bg-black/[0.02]">
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Member</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Role</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Joined</th>
                {canManage && <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b0b0c]/60">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {members.map((m) => {
                const isOwnerRow = m.role === 'owner';
                return (
                  <tr key={m.id} className="hover:bg-black/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-sm">{m.username}</div>
                      <div className="text-xs text-[#0b0b0c]/60 flex items-center gap-1 mt-0.5"><Mail size={11} /> {m.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${ROLE_STYLES[m.role]}`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#0b0b0c]/55">
                      {new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4">
                        {!isOwnerRow && (
                          <div className="flex items-center gap-2">
                            <select
                              value={m.role}
                              disabled={updatingId === m.id}
                              onChange={(e) => handleRoleChange(m.id, e.target.value as 'admin' | 'recruiter')}
                              className="text-xs bg-black/[0.03] border border-black/[0.08] rounded-lg px-2 py-1.5 outline-none focus:border-purple-600 cursor-pointer disabled:opacity-50"
                            >
                              <option value="recruiter">Recruiter</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              onClick={() => handleRemove(m)}
                              disabled={updatingId === m.id}
                              title="Remove from team"
                              className="cursor-pointer p-1.5 rounded-lg text-[#0b0b0c]/40 hover:text-red-500 hover:bg-red-500/5 transition-all disabled:opacity-50"
                            >
                              {updatingId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AvailabilityHint({ state, takenLabel }: { state: Availability; takenLabel: string }) {
  if (state === 'idle') return null;
  if (state === 'checking') {
    return <p className="text-xs text-[#0b0b0c]/50 mt-1.5 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Checking…</p>;
  }
  if (state === 'taken') {
    return <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><XCircle size={11} /> {takenLabel}</p>;
  }
  return <p className="text-xs text-green-700 mt-1.5 flex items-center gap-1"><CheckCircle2 size={11} /> Available</p>;
}
