"""Best-effort job categorization used to power the category filter.

categorize_job() is given the job title and, when the source ATS exposes one,
a department/team hint (e.g. Greenhouse `departments`, Lever `categories.team`,
Ashby `department`, SmartRecruiters `department`/`function`). The hint is far
more reliable than guessing from the title alone, so it's checked first;
title-keyword matching is the fallback for sources with no structured field
(job-board scrapes, generic career-page scrapes).
"""

CATEGORIES = [
    'Technology',
    'Design',
    'Product & Project Management',
    'Marketing',
    'Sales',
    'Customer Support',
    'Human Resources',
    'Finance & Accounting',
    'Business & Consulting',
    'Operations & Administration',
    'Legal & Compliance',
    'Engineering',
    'Healthcare',
    'Education',
    'Real Estate',
    'Other',
]

# Exact matches for a fixed set of common role titles — checked before the
# generic keyword fallback since it's unambiguous by construction.
_EXACT_ROLE_CATEGORY = {
    'python developer': 'Technology',
    'fullstack developer': 'Technology',
    'frontend developer': 'Technology',
    'backend developer': 'Technology',
    'node js developer': 'Technology',
    'ai engineer': 'Technology',
    'data scientist': 'Technology',
    'data analyst': 'Technology',
    'ui/ux designer': 'Design',
    'product manager': 'Product & Project Management',
    'devops engineer': 'Technology',
    'mobile developer': 'Technology',
    'qa engineer': 'Technology',
    'marketing manager': 'Marketing',
    'sales representative': 'Sales',
    'hr manager': 'Human Resources',
    'cybersecurity': 'Technology',
    'project manager': 'Product & Project Management',
    'business analyst': 'Business & Consulting',
    'account executive': 'Sales',
    'business development manager': 'Sales',
    'financial analyst': 'Finance & Accounting',
    'investment analyst': 'Finance & Accounting',
    'risk analyst': 'Finance & Accounting',
    'auditor': 'Finance & Accounting',
    'tax consultant': 'Finance & Accounting',
    'management consultant': 'Business & Consulting',
    'operations manager': 'Operations & Administration',
    'hr recruiter': 'Human Resources',
    'talent acquisition specialist': 'Human Resources',
    'payroll specialist': 'Human Resources',
    'executive assistant': 'Operations & Administration',
    'office manager': 'Operations & Administration',
    'legal counsel': 'Legal & Compliance',
    'paralegal': 'Legal & Compliance',
    'compliance officer': 'Legal & Compliance',
    'brand manager': 'Marketing',
    'social media manager': 'Marketing',
    'content writer': 'Marketing',
    'copywriter': 'Marketing',
    'seo specialist': 'Marketing',
    'digital marketing specialist': 'Marketing',
    'public relations manager': 'Marketing',
    'graphic designer': 'Design',
    'video editor': 'Design',
    'motion graphics designer': 'Design',
    'architect': 'Engineering',
    'civil engineer': 'Engineering',
    'mechanical engineer': 'Engineering',
    'electrical engineer': 'Engineering',
    'nurse': 'Healthcare',
    'pharmacist': 'Healthcare',
    'healthcare administrator': 'Healthcare',
    'physical therapist': 'Healthcare',
    'teacher': 'Education',
    'instructional designer': 'Education',
    'real estate agent': 'Real Estate',
    'property manager': 'Real Estate',
    'retail manager': 'Operations & Administration',
    'customer support': 'Customer Support',
    'customer success manager': 'Customer Support',
    'technical writer': 'Technology',
    'research analyst': 'Business & Consulting',
    'event manager': 'Marketing',
    'finance manager': 'Finance & Accounting',
    'accountant': 'Finance & Accounting',
    'scrum master': 'Product & Project Management',
    'program manager': 'Product & Project Management',
}

# Ordered narrow-to-broad: first category whose keyword is found in the
# (department hint + title) haystack wins. Order matters — e.g. Engineering's
# "civil engineer" must be checked before Technology's catch-all "engineer".
_CATEGORY_KEYWORDS = [
    ('Legal & Compliance', [
        'attorney', 'lawyer', 'legal counsel', 'paralegal', 'compliance officer',
        'compliance analyst', 'general counsel', 'legal',
    ]),
    ('Healthcare', [
        'nurse', 'pharmacist', 'physician', 'therapist', 'clinical', 'medical',
        'healthcare', 'dentist', 'surgeon', 'caregiver', 'patient care',
    ]),
    ('Education', [
        'teacher', 'professor', 'instructor', 'tutor', 'instructional designer',
        'curriculum',
    ]),
    ('Real Estate', [
        'real estate agent', 'realtor', 'property manager', 'leasing agent',
        'real estate',
    ]),
    ('Finance & Accounting', [
        'financial analyst', 'investment analyst', 'risk analyst', 'tax consultant',
        'tax manager', 'auditor', 'audit', 'accountant', 'accounting', 'finance manager',
        'bookkeeper', 'controller', 'treasury', 'accounts payable', 'accounts receivable',
    ]),
    ('Human Resources', [
        'hr manager', 'hr business partner', 'hr recruiter', 'human resources',
        'recruiter', 'recruiting', 'talent acquisition', 'people operations',
        'people ops', 'people partner', 'people strategy', 'people analytics',
        'total rewards', 'technical recruiting', 'payroll',
    ]),
    ('Sales', [
        'sales', 'account executive', 'business development', 'account manager',
        'sdr', 'bdr', 'revenue',
    ]),
    ('Marketing', [
        'marketing', 'brand manager', 'social media', 'content writer', 'copywriter',
        'seo ', 'public relations', 'pr manager', 'growth marketing',
        'demand generation', 'event manager', 'communications manager',
    ]),
    ('Customer Support', [
        'customer support', 'customer success', 'customer service', 'help desk',
        'support specialist', 'customer experience', ' cx ',
    ]),
    ('Design', [
        'designer', 'ui/ux', 'ux design', 'ui design', 'graphic design',
        'video editor', 'motion graphics', 'product design', 'user researcher',
        'ux researcher',
    ]),
    ('Product & Project Management', [
        'product manager', 'project manager', 'program manager', 'scrum master',
        'product owner', 'agile coach',
    ]),
    ('Business & Consulting', [
        'business analyst', 'research analyst', 'management consultant',
        'strategy consultant', 'consultant',
    ]),
    ('Operations & Administration', [
        'operations manager', 'office manager', 'executive assistant',
        'administrative assistant', 'retail manager', 'operations analyst',
        'logistics', 'general and administrative', 'g&a',
    ]),
    ('Engineering', [
        'civil engineer', 'mechanical engineer', 'electrical engineer',
        'structural engineer', 'chemical engineer', 'industrial engineer',
    ]),
    ('Technology', [
        'software', 'developer', 'programmer', 'devops', 'data scientist',
        'data analyst', 'data engineer', 'machine learning', 'backend', 'frontend',
        'full stack', 'fullstack', 'full-stack', 'qa engineer', 'test engineer',
        'cybersecurity', 'security engineer', 'cloud engineer', 'site reliability',
        'sre', 'mobile developer', 'ios developer', 'android developer',
        'database administrator', 'network engineer', 'it support',
        'technical writer', 'system administrator', 'sysadmin',
        'solutions architect', 'cloud architect', 'software architect',
        'security architect', 'data architect', 'enterprise architect',
        'technical architect', 'engineer',
    ]),
]


def categorize_job(title, department_hint=None):
    title = (title or '').strip().lower()

    exact = _EXACT_ROLE_CATEGORY.get(title)
    if exact:
        return exact

    haystack = ' '.join(filter(None, [department_hint, title])).lower()
    if not haystack.strip():
        return 'Other'

    for category, keywords in _CATEGORY_KEYWORDS:
        if any(kw in haystack for kw in keywords):
            return category

    return 'Other'
