'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Copy, Check, Users, CheckCircle2, TrendingUp, Search,
} from 'lucide-react';
import { ambassadorFetch } from '@/lib/api';
import { useAmbassadorContext } from '@/context/AmbassadorContext';

const KAAMLEE_URL = process.env.NEXT_PUBLIC_KAAMLEE_URL || 'https://kaamlee.in';

interface DashboardStats {
  total_referrals: number;
  subscribed_referrals: number;
  conversion_rate: number;
  weekly_signups: { week: string; count: number }[];
}

interface Referral {
  name: string;
  email: string;
  joined_at: string;
  is_subscribed: boolean;
  subscription_expires_at: string | null;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#16A34A] px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#0A0A0A]"
      style={{ fontFamily: 'var(--font-outfit)' }}
    >
      {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
    </button>
  );
}

const STAT_STYLES = [
  { bg: '#34D399', fg: '#04231A', rotate: '-rotate-2' },
  { bg: '#FDE68A', fg: '#3B2A03', rotate: 'rotate-2' },
  { bg: '#FBCFE8', fg: '#3B0A28', rotate: '-rotate-1' },
] as const;

function StatCard({ icon, label, value, style }: { icon: React.ReactNode; label: string; value: string | number; style: (typeof STAT_STYLES)[number] }) {
  return (
    <div
      className={`rounded-[20px] p-6 transition-transform duration-300 hover:-translate-y-1 ${style.rotate}`}
      style={{ background: style.bg, color: style.fg }}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-black/10">{icon}</span>
      <div className="mt-4 text-[32px] font-semibold tracking-tighter" style={{ fontFamily: 'var(--font-outfit)' }}>{value}</div>
      <div className="mt-1 text-[13.5px] font-semibold opacity-80">{label}</div>
    </div>
  );
}

export default function AmbassadorDashboardPage() {
  const me = useAmbassadorContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'subscribed' | 'unsubscribed'>('all');

  useEffect(() => {
    (async () => {
      const [statsRes, referralsRes] = await Promise.all([
        ambassadorFetch('/dashboard/'),
        ambassadorFetch('/referrals/'),
      ]);
      setStats(await statsRes.json());
      setReferrals(await referralsRes.json());
    })();
  }, []);

  const filteredReferrals = useMemo(() => {
    return referrals.filter((r) => {
      const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'all' || (filter === 'subscribed' ? r.is_subscribed : !r.is_subscribed);
      return matchesSearch && matchesFilter;
    });
  }, [referrals, search, filter]);

  if (!stats) return null;

  const referralLink = `${KAAMLEE_URL}/signup?ref=${me.referral_code}`;

  return (
    <div>
      <span className="block text-[26px] font-bold text-[#16A34A] -rotate-2 -mt-4" style={{ fontFamily: 'var(--font-caveat)' }}>hey there,</span>
      <h1 className="mt-2 font-[var(--font-outfit)] text-[34px] font-semibold tracking-tighter">
        {me.full_name.split(' ')[0]}
      </h1>

      {/* Referral link */}
      <div className="mt-6 rounded-[24px] border border-[#E7E5E0] bg-white p-6 sm:p-7">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#57534E]">Your referral link</h2>
        <p className="mt-1 text-[13.5px] text-[#6B7280]">Share this — signups through it count toward your referrals.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 truncate rounded-full border border-black/10 bg-[#FAF9F6] px-5 py-3 text-[14px] font-medium text-[#374151]">
            {referralLink}
          </div>
          <CopyButton value={referralLink} />
        </div>
        <div className="mt-3 flex items-center gap-2 text-[12.5px] text-[#6B7280]">
          Referral code: <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-mono font-semibold text-[#374151]">{me.referral_code}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<Users size={18} />} label="Total referrals" value={stats.total_referrals} style={STAT_STYLES[0]} />
        <StatCard icon={<CheckCircle2 size={18} />} label="Subscribed" value={stats.subscribed_referrals} style={STAT_STYLES[1]} />
        <StatCard icon={<TrendingUp size={18} />} label="Conversion rate" value={`${stats.conversion_rate}%`} style={STAT_STYLES[2]} />
      </div>

      {/* Referrals table */}
      <div className="mt-6 rounded-[24px] border border-[#E7E5E0] bg-white p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#57534E]">Your referrals</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="rounded-full border border-black/10 bg-[#FAF9F6] py-2 pl-9 pr-3 text-[13px] outline-none focus:border-[#16A34A]"
              />
            </div>
            {([['all', 'All'], ['subscribed', 'Subscribed'], ['unsubscribed', 'Not subscribed']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${filter === key ? 'bg-[#0A0A0A] text-white' : 'bg-black/[0.04] text-[#57534E] hover:bg-black/[0.08]'}`}
                style={{ fontFamily: 'var(--font-outfit)' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredReferrals.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto mb-3 text-black/15" size={36} />
            <p className="text-[14px] text-[#6B7280]">
              {referrals.length === 0 ? "No referrals yet — share your link above to get started." : 'No results match your search.'}
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E7E5E0]">
                  <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-black/35">Name</th>
                  <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-black/35">Email</th>
                  <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-black/35">Joined</th>
                  <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-black/35">Subscribed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {filteredReferrals.map((r) => (
                  <tr key={r.email}>
                    <td className="py-3.5 text-[13.5px] font-semibold">{r.name}</td>
                    <td className="py-3.5 text-[13.5px] text-[#57534E]">{r.email}</td>
                    <td className="py-3.5 text-[13.5px] text-[#6B7280]">
                      {new Date(r.joined_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${r.is_subscribed ? 'bg-green-50 text-green-700' : 'bg-black/[0.05] text-black/40'}`}>
                        {r.is_subscribed ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
