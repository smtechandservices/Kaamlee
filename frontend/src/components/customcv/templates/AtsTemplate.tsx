import type { ResumeParsed } from '@/components/portfolio/types';
import ResumeDocument from './ResumeDocument';

export default function AtsTemplate({ r }: { r: ResumeParsed }) {
  return <ResumeDocument r={r} template="ats" />;
}
