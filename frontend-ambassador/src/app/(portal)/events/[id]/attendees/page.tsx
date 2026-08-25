'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Attendee {
  id: number;
  name: string;
  email: string;
  status: string;
  amount_paise: number;
  created_at: string;
}

export default function EventAttendeesPage() {
  const params = useParams<{ id: string }>();
  const [attendees, setAttendees] = useState<Attendee[] | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await apiFetch(`/events/${params.id}/attendees/`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      setAttendees(await res.json());
    })();
  }, [params.id]);

  return (
    <div>
      <Link href="/events" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-black/50 transition-colors hover:text-black/80" style={{ fontFamily: 'var(--font-outfit)' }}>
        <ArrowLeft size={15} /> Back to Events
      </Link>

      <h1 className="mt-4 font-[var(--font-outfit)] text-[30px] font-semibold tracking-tighter">Attendees</h1>
      <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-[#6B7280]">Everyone who has paid and confirmed their registration for this event.</p>

      <div className="mt-6 rounded-[24px] border border-[#E7E5E0] bg-white p-6 sm:p-7">
        {notFound ? (
          <div className="py-16 text-center">
            <p className="text-[14px] text-[#6B7280]">This event isn&apos;t yours, or it doesn&apos;t exist.</p>
          </div>
        ) : attendees === null ? null : attendees.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto mb-3 text-black/15" size={36} />
            <p className="text-[14px] text-[#6B7280]">No one has registered yet.</p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E7E5E0]">
                  <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-black/35">Name</th>
                  <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-black/35">Email</th>
                  <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-black/35">Registered</th>
                  <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-black/35">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {attendees.map((a) => (
                  <tr key={a.id}>
                    <td className="py-3.5 text-[13.5px] font-semibold">{a.name}</td>
                    <td className="py-3.5 text-[13.5px] text-[#57534E]">{a.email}</td>
                    <td className="py-3.5 text-[13.5px] text-[#6B7280]">
                      {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 text-[13.5px] text-[#6B7280]">
                      {a.amount_paise === 0 ? 'Free' : `₹${(a.amount_paise / 100).toFixed(0)}`}
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
