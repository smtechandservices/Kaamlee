// Shared between the dashboard's embedded "Import Jobs" panel and the
// dedicated live scraper page — the set of ATS scripts an admin can trigger
// a run for, and the company-picker config each one uses.

export const SCRIPT_OPTIONS = [
  { value: 'ashbyhq', label: 'Ashby (jobs.ashbyhq.com)' },
  { value: 'greenhouse', label: 'Greenhouse (boards.greenhouse.io)' },
  { value: 'recruitee', label: 'Recruitee (*.recruitee.com)' },
  { value: 'lever', label: 'Lever (jobs.lever.co)' },
  { value: 'workable', label: 'Workable (apply.workable.com)' },
  { value: 'epam', label: 'EPAM (careers.epam.com)' },
];

// Which career_url substring identifies a company as belonging to each
// script — so the company picker only offers boards that script can
// actually fetch, instead of letting you pick e.g. a Greenhouse company
// while "Ashby" is selected.
export const SCRIPT_URL_MATCH: Record<string, string> = {
  ashbyhq: 'ashbyhq.com',
  greenhouse: 'greenhouse.io',
  recruitee: 'recruitee.com',
  lever: 'lever.co',
  workable: 'workable.com',
  epam: 'epam.com',
};

export const MAX_SCRIPT_COMPANIES = 3;
