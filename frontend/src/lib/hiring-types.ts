export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'number';
  required: boolean;
}

export interface ScreeningQuestion {
  id: string;
  question: string;
}

export interface JobPosting {
  id: number;
  employer: number;
  employer_name: string;
  employer_logo: string | null;
  title: string;
  description: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship';
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_remote: boolean;
  experience_level: 'entry' | 'mid' | 'senior' | 'lead';
  category: string;
  status: 'draft' | 'published' | 'paused' | 'closed';
  application_form_schema: FormField[];
  screening_questions: ScreeningQuestion[];
  is_saved: boolean;
  has_applied: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  closes_at: string | null;
}

export type ApplicationStage = 'applied' | 'screening' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected';

export const STAGE_COLUMNS: { key: ApplicationStage; label: string }[] = [
  { key: 'applied', label: 'Applied' },
  { key: 'screening', label: 'Screening' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'hired', label: 'Hired' },
  { key: 'rejected', label: 'Rejected' },
];

// GET /hiring/saved/mine/ — a bookmarked posting (SavedJobSerializer nests
// the full JobPosting). Not an application — job_posting.has_applied tells
// you whether the candidate has actually applied since bookmarking it.
export interface SavedPosting {
  id: number;
  job_posting: JobPosting;
  created_at: string;
}

export interface Application {
  id: number;
  job_posting: number;
  job_posting_title: string;
  employer_name: string;
  employer_logo: string | null;
  cv: number | null;
  portfolio_public_snapshot: boolean;
  form_responses: Record<string, string>;
  screening_answers: { question_id: string; answer_text: string }[];
  stage: ApplicationStage;
  stage_updated_at: string;
  applied_at: string;
  rejection_note: string | null;
}
