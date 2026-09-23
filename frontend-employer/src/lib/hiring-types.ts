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

export type JobStatus = 'draft' | 'published' | 'paused' | 'closed';

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
  status: JobStatus;
  application_form_schema: FormField[];
  screening_questions: ScreeningQuestion[];
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

export interface KanbanApplication {
  id: number;
  job_posting: number;
  candidate_username: string;
  candidate_email: string;
  candidate_phone: string | null;
  cv: { id: number; label: string; target_role: string; ats_score: number } | null;
  portfolio_url: string | null;
  portfolio_public_snapshot: boolean;
  form_responses: Record<string, string>;
  screening_answers: { question_id: string; answer_text: string }[];
  stage: ApplicationStage;
  stage_updated_at: string;
  applied_at: string;
  latest_note: string | null;
}

export const EMPLOYMENT_TYPES: { value: JobPosting['employment_type']; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];

export const EXPERIENCE_LEVELS: { value: JobPosting['experience_level']; label: string }[] = [
  { value: 'entry', label: 'Entry level' },
  { value: 'mid', label: 'Mid level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead / Principal' },
];

export const FIELD_TYPES: { value: FormField['type']; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'url', label: 'URL' },
  { value: 'number', label: 'Number' },
];
