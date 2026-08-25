'use client';

import Link from 'next/link';
import { Mail, Phone, GraduationCap, BookOpen, Hash, KeyRound } from 'lucide-react';
import { useAmbassadorContext } from '@/context/AmbassadorContext';

function Field({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3.5 border-b border-black/[0.06] py-4 last:border-0">
      <span className="mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-full bg-[#eafaf0] text-[#16A34A]">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-black/40">{label}</div>
        <div className="mt-0.5 truncate text-[15px] font-medium text-[#0A0A0A]">{value || '—'}</div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const me = useAmbassadorContext();

  return (
    <div>
      <span className="block text-[26px] font-bold text-[#16A34A] -rotate-2" style={{ fontFamily: 'var(--font-caveat)' }}>your details</span>
      <h1 className="mt-2 font-[var(--font-outfit)] text-[34px] font-semibold tracking-tighter">
        Profile
      </h1>
      <p className="mt-2 text-[14.5px] text-[#6B7280]">
        Your ambassador account details. Reach out to the Kaamlee team if any of this needs to change.
      </p>

      <div className="mt-7 rounded-[24px] border border-[#E7E5E0] bg-white p-6 sm:p-7">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 flex-none place-items-center rounded-full bg-[#16A34A] text-[22px] font-bold text-white" style={{ fontFamily: 'var(--font-outfit)' }}>
            {me.full_name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'}
          </span>
          <div className="min-w-0">
            <div className="truncate font-[var(--font-outfit)] text-[19px] font-semibold tracking-tight">{me.full_name}</div>
            <div className="truncate text-[13.5px] text-[#6B7280]">@{me.username}</div>
          </div>
        </div>

        <div className="mt-6">
          <Field icon={Mail} label="Email" value={me.email} />
          <Field icon={Phone} label="Phone" value={me.phone} />
          <Field icon={GraduationCap} label="College" value={me.college_name} />
          <Field icon={BookOpen} label="Course" value={me.course} />
          <Field icon={Hash} label="Referral code" value={me.referral_code} />
        </div>
      </div>

      <div className="mt-6 rounded-[24px] border border-[#E7E5E0] bg-white p-6 sm:p-7">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#57534E]">Security</h2>
        <p className="mt-1.5 text-[13.5px] text-[#6B7280]">Change the password you use to log in to this portal.</p>
        <Link
          href="/change-password"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#16A34A] px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-[#0A0A0A]"
          style={{ fontFamily: 'var(--font-outfit)' }}
        >
          <KeyRound size={14} /> Change password
        </Link>
      </div>
    </div>
  );
}
