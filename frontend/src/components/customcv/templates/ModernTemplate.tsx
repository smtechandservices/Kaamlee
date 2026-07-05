import type { ResumeParsed } from '@/components/portfolio/types';
import ResumeDocument from './ResumeDocument';

export default function ModernTemplate({ r }: { r: ResumeParsed }) {
  return <ResumeDocument r={r} template="modern" />;
}
