import type { ResumeParsed } from '@/components/portfolio/types';

export type CVTemplate = 'modern' | 'classic' | 'ats';

export interface AtsCheck {
  check: string;
  passed: boolean;
  weight: number;
  message: string;
}

export interface CustomCV {
  id: number;
  label: string;
  target_role: string;
  template: CVTemplate;
  content: ResumeParsed;
  ats_score: number;
  ats_breakdown: AtsCheck[];
  created_at: string;
  updated_at: string;
}
