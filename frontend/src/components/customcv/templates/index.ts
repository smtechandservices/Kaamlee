import type { CVTemplate } from '../types';
import ModernTemplate from './ModernTemplate';
import ClassicCVTemplate from './ClassicCVTemplate';
import AtsTemplate from './AtsTemplate';

export const CV_TEMPLATE_COMPONENTS: Record<CVTemplate, typeof ModernTemplate> = {
  modern: ModernTemplate,
  classic: ClassicCVTemplate,
  ats: AtsTemplate,
};
