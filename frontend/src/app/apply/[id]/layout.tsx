import type { Metadata } from 'next';

// page.tsx is a client component (it needs the user's token), so it can't
// export metadata itself. This server layout gives shared /apply/<id> links a
// proper preview — link crawlers never log in, hence the public meta endpoint.

interface JobMeta {
  title: string;
  employer_name: string;
  employer_logo: string | null;
  city: string;
  country: string;
  is_remote: boolean;
  employment_type: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function getJobMeta(id: string): Promise<JobMeta | null> {
  try {
    const res = await fetch(`${API_BASE}/hiring/jobs/public/${id}/meta/`, { next: { revalidate: 300 } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobMeta(id);
  if (!job) return { title: 'Job not found — Kaamlee' };

  const title = `${job.title} at ${job.employer_name}`;
  const location = job.is_remote ? 'Remote' : [job.city, job.country].filter(Boolean).join(', ');
  const details = [location, job.employment_type.replace('_', '-')].filter(Boolean).join(' · ');
  const description = `${details ? `${details}. ` : ''}Apply for ${job.title} at ${job.employer_name} on Kaamlee.`;
  // Uploaded logos come back as a relative /media/... path; crawlers need absolute.
  const logo = job.employer_logo ? new URL(job.employer_logo, API_BASE).toString() : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Kaamlee',
      ...(logo ? { images: [{ url: logo, alt: job.employer_name }] } : {}),
    },
    twitter: {
      card: 'summary',
      title,
      description,
      ...(logo ? { images: [logo] } : {}),
    },
  };
}

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
