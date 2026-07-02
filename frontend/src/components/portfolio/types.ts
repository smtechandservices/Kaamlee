export interface Contact {
  type: 'email' | 'phone';
  value: string;
}

export interface Link {
  label: string;
  url: string;
  type: 'github' | 'linkedin' | 'web';
}

export interface SkillGroup {
  category: string;
  items: string[];
}

export interface ExpEntry {
  company: string;
  location: string;
  period: string;
  role: string;
  bullets: string[];
}

export interface EduEntry {
  institution: string;
  degree: string;
  period: string;
  location: string;
}

export interface Project {
  name: string;
  description: string;
  tech: string[];
  bullets: string[];
  url: string;
}

export interface Certification {
  name: string;
  issuer: string;
  date: string;
}

export interface ResumeParsed {
  name: string;
  role: string;
  contacts: Contact[];
  links: Link[];
  summary: string;
  skills: SkillGroup[];
  experience: ExpEntry[];
  education: EduEntry[];
  projects: Project[];
  certifications: Certification[];
  achievements: string[];
}

export interface PortfolioData {
  username: string;
  resume_parsed: ResumeParsed;
  template: 'classic' | 'bento';
  theme: 'minimal' | 'noir' | 'noir-violet' | 'minimal-violet' | 'noir-blue' | 'minimal-blue';
}
