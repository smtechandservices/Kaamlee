'use client';

import { Sparkles } from 'lucide-react';

interface ComingSoonPageProps {
  tag: string;
  title: string;
  description: string;
  icon: React.ElementType;
  items: { icon: React.ElementType; title: string; body: string }[];
}

const CARD_STYLES = [
  { bg: '#34D399', fg: '#04231A', rotate: '-rotate-1' },
  { bg: '#FBCFE8', fg: '#3B0A28', rotate: 'rotate-1' },
  { bg: '#FDE68A', fg: '#3B2A03', rotate: '-rotate-2' },
] as const;

export default function ComingSoonPage({ tag, title, description, icon: HeroIcon, items }: ComingSoonPageProps) {
  return (
    <div>
      <span className="block text-[26px] font-bold text-[#16A34A] -rotate-2" style={{ fontFamily: 'var(--font-caveat)' }}>{tag}</span>
      <h1 className="mt-2 font-[var(--font-outfit)] text-[34px] font-semibold tracking-tighter">
        {title}
      </h1>
      <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-[#6B7280]">{description}</p>

      <div className="relative mt-8 overflow-hidden rounded-[24px] border border-[#E7E5E0] bg-white p-8 text-center sm:p-12">
        <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-[#FDE68A]/50" />
        <div className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-[#34D399]/25" />
        <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#eafaf0] text-[#16A34A]">
          <HeroIcon size={24} />
        </span>
        <h2 className="relative mt-5 font-[var(--font-outfit)] text-[22px] font-semibold tracking-tight">Coming soon</h2>
        <p className="relative mx-auto mt-2 max-w-sm text-[14px] text-[#6B7280]">
          We&apos;re building this out, it&apos;ll show up right here once it&apos;s live.
        </p>
        <span className="relative mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#FDE68A] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#3B2A03]">
          <Sparkles size={12} /> In the works
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {items.map((item, i) => {
          const style = CARD_STYLES[i % CARD_STYLES.length];
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className={`rounded-[20px] p-6 transition-transform duration-300 hover:-translate-y-1 ${style.rotate}`}
              style={{ background: style.bg, color: style.fg }}
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-black/10">
                <Icon size={18} />
              </span>
              <h3 className="mt-4 font-[var(--font-outfit)] text-[16px] font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed opacity-80">{item.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
