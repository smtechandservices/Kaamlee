import type { ResumeParsed } from '@/components/portfolio/types';
import ResumeDocument from './ResumeDocument';

export default function ClassicCVTemplate({ r }: { r: ResumeParsed }) {
  return <ResumeDocument r={r} template="classic" />;
}
