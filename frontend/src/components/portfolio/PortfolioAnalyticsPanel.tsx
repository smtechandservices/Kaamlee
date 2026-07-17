'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

export interface PortfolioAnalyticsData {
  total_views: number;
  views_today: number;
  views_this_week: number;
  views_this_month: number;
  unique_viewers: number;
  countries: { country: string; country_code: string; count: number; percent: number }[];
  devices: { label: string; count: number; percent: number }[];
  browsers: { label: string; count: number; percent: number }[];
  operating_systems: { label: string; count: number; percent: number }[];
  monthly_views: { month: string; label: string; count: number }[];
}

interface BreakdownRow {
  label: string;
  count: number;
  percent: number;
  countryCode?: string;
}

function countryFlag(code: string) {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function BreakdownRows({ rows }: { rows: BreakdownRow[] }) {
  if (!rows.length) {
    return <p className="text-[10px] text-[#555] font-mono py-10 text-center">No data yet</p>;
  }
  const max = Math.max(...rows.map((r) => r.percent), 1);
  return (
    <div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="relative rounded-lg overflow-hidden h-9">
            <div
              className="absolute inset-y-0 left-0 bg-white/[0.06] rounded-lg"
              style={{ width: `${Math.max((row.percent / max) * 100, 4)}%` }}
            />
            <div className="relative h-full flex items-center justify-between px-3 text-xs gap-2">
              <span className="text-[#ccc] font-medium truncate flex items-center gap-2">
                {row.countryCode && <span>{countryFlag(row.countryCode)}</span>}
                {row.label}
              </span>
              <span className="text-white font-bold shrink-0">{row.percent}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mt-4" />
    </div>
  );
}

function AnalyticsCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-5 flex flex-col">{children}</div>;
}

function MonthlyViewsChart({ data }: { data: { month: string; label: string; count: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.count), 1);
  const peakIndex = data.reduce((best, d, i) => (d.count > data[best].count ? i : best), 0);
  const hasData = data.some((d) => d.count > 0);

  return (
    <AnalyticsCard>
      <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">Monthly Views</h3>
      {!hasData ? (
        <p className="text-[10px] text-[#555] font-mono py-10 text-center">No views yet</p>
      ) : (
        <div className="flex items-end justify-between gap-2 h-36 px-1">
          {data.map((d, i) => {
            const heightPct = d.count === 0 ? 2 : Math.max((d.count / max) * 100, 6);
            const showLabel = hovered === i || (hovered === null && i === peakIndex);
            return (
              <div
                key={d.month}
                className="flex-1 flex flex-col items-center gap-2 h-full justify-end relative"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {showLabel && (
                  <div
                    className={`absolute bottom-full mb-1 px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap z-10 ${
                      hovered === i ? 'bg-white text-black' : 'bg-[#111] border border-[#222] text-white'
                    }`}
                  >
                    {d.count.toLocaleString()}
                  </div>
                )}
                <div
                  className="w-full max-w-[24px] rounded-t-[4px] bg-green-500 transition-opacity"
                  style={{ height: `${heightPct}%`, opacity: hovered === null || hovered === i ? 0.9 : 0.4 }}
                />
                <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest">{d.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </AnalyticsCard>
  );
}

export default function PortfolioAnalyticsPanel({
  analytics,
  isLoading,
}: {
  analytics: PortfolioAnalyticsData | null;
  isLoading: boolean;
}) {
  const [deviceTab, setDeviceTab] = useState<'devices' | 'browsers'>('devices');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
      </div>
    );
  }

  const countryRows: BreakdownRow[] = (analytics?.countries ?? []).map((c) => ({
    label: c.country,
    count: c.count,
    percent: c.percent,
    countryCode: c.country_code,
  }));
  const deviceRows: BreakdownRow[] = analytics?.devices ?? [];
  const browserRows: BreakdownRow[] = analytics?.browsers ?? [];
  const osRows: BreakdownRow[] = analytics?.operating_systems ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Views', value: analytics?.total_views ?? 0 },
          { label: 'This Month', value: analytics?.views_this_month ?? 0 },
          { label: 'This Week', value: analytics?.views_this_week ?? 0 },
          { label: 'Unique Visitors', value: analytics?.unique_viewers ?? 0 },
        ].map((tile) => (
          <div key={tile.label} className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4">
            <div className="text-2xl font-black tracking-tight text-white mb-1">{tile.value.toLocaleString()}</div>
            <div className="text-[9px] font-mono text-[#555] uppercase tracking-widest">{tile.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AnalyticsCard>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1a1a1a]">
            <h3 className="text-xs font-black text-white">Countries</h3>
            <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest">Visitors</span>
          </div>
          <BreakdownRows rows={countryRows} />
        </AnalyticsCard>

        <AnalyticsCard>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setDeviceTab('devices')}
                className={`cursor-pointer text-xs font-black pb-1 border-b-2 transition-colors ${
                  deviceTab === 'devices' ? 'text-white border-white' : 'text-[#555] border-transparent hover:text-[#888]'
                }`}
              >
                Devices
              </button>
              <button
                type="button"
                onClick={() => setDeviceTab('browsers')}
                className={`cursor-pointer text-xs font-black pb-1 border-b-2 transition-colors ${
                  deviceTab === 'browsers' ? 'text-white border-white' : 'text-[#555] border-transparent hover:text-[#888]'
                }`}
              >
                Browsers
              </button>
            </div>
            <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest">Visitors</span>
          </div>
          <BreakdownRows rows={deviceTab === 'devices' ? deviceRows : browserRows} />
        </AnalyticsCard>

        <AnalyticsCard>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1a1a1a]">
            <h3 className="text-xs font-black text-white">Operating Systems</h3>
            <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest">Visitors</span>
          </div>
          <BreakdownRows rows={osRows} />
        </AnalyticsCard>
      </div>

      <MonthlyViewsChart data={analytics?.monthly_views ?? []} />
    </div>
  );
}
