// Data-access layer for the Job Preparation module. Every function here reads
// from local JSON today and resolves as a Promise so a future Django REST
// endpoint can replace the body of any one function without touching a
// single page or component that calls it.

import type {
  Achievement,
  CategoryId,
  CategoryMeta,
  Company,
  CodingQuestion,
  McqQuestion,
  MockTest,
  OpenQuestion,
  PrepQuestion,
  RoadmapStage,
  SearchResultItem,
  Tip,
} from '@/components/jobprep/types';

import metaData from '@/data/preparation/meta.json';
import aptitudeData from '@/data/preparation/aptitude.json';
import codingData from '@/data/preparation/coding.json';
import verbalData from '@/data/preparation/verbal.json';
import reasoningData from '@/data/preparation/reasoning.json';
import interviewData from '@/data/preparation/interview.json';
import companiesData from '@/data/preparation/companies.json';
import testsData from '@/data/preparation/tests.json';
import roadmapData from '@/data/preparation/roadmap.json';
import achievementsData from '@/data/preparation/achievements.json';
import tipsData from '@/data/preparation/tips.json';

const CATEGORIES = metaData as CategoryMeta[];
const MCQ_BY_CATEGORY: Partial<Record<CategoryId, McqQuestion[]>> = {
  aptitude: aptitudeData as McqQuestion[],
  verbal: verbalData as McqQuestion[],
  reasoning: reasoningData as McqQuestion[],
};
const CODING_QUESTIONS = codingData as CodingQuestion[];
const OPEN_QUESTIONS = interviewData as OpenQuestion[];
const COMPANIES = companiesData as Company[];
const MOCK_TESTS = testsData as MockTest[];
const ROADMAP = roadmapData as RoadmapStage[];
const ACHIEVEMENTS = achievementsData as Achievement[];
const TIPS = tipsData as Tip[];

function allMcqQuestions(): McqQuestion[] {
  return [...(MCQ_BY_CATEGORY.aptitude ?? []), ...(MCQ_BY_CATEGORY.verbal ?? []), ...(MCQ_BY_CATEGORY.reasoning ?? [])];
}

export async function getCategories(): Promise<CategoryMeta[]> {
  return Promise.resolve(CATEGORIES);
}

export async function getCategory(categoryId: CategoryId): Promise<CategoryMeta | undefined> {
  return Promise.resolve(CATEGORIES.find((c) => c.id === categoryId));
}

export async function getQuestionCounts(): Promise<Record<CategoryId, number>> {
  return Promise.resolve({
    aptitude: (MCQ_BY_CATEGORY.aptitude ?? []).length,
    verbal: (MCQ_BY_CATEGORY.verbal ?? []).length,
    reasoning: (MCQ_BY_CATEGORY.reasoning ?? []).length,
    coding: CODING_QUESTIONS.length,
    interview: OPEN_QUESTIONS.length,
    companies: COMPANIES.length,
  });
}

export async function getTopicQuestionCounts(categoryId: CategoryId): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const source: { topic: string }[] =
    categoryId === 'coding' ? CODING_QUESTIONS : categoryId === 'interview' ? OPEN_QUESTIONS : MCQ_BY_CATEGORY[categoryId] ?? [];
  for (const q of source) counts[q.topic] = (counts[q.topic] ?? 0) + 1;
  return Promise.resolve(counts);
}

export async function getQuestions(categoryId: CategoryId, topicSlug: string): Promise<PrepQuestion[]> {
  if (categoryId === 'aptitude' || categoryId === 'verbal' || categoryId === 'reasoning') {
    return Promise.resolve((MCQ_BY_CATEGORY[categoryId] ?? []).filter((q) => q.topic === topicSlug));
  }
  if (categoryId === 'interview') {
    return Promise.resolve(OPEN_QUESTIONS.filter((q) => q.topic === topicSlug));
  }
  return Promise.resolve([]);
}

export async function getCategoryQuestions(categoryId: CategoryId): Promise<(McqQuestion | OpenQuestion | CodingQuestion)[]> {
  if (categoryId === 'coding') return Promise.resolve(CODING_QUESTIONS);
  if (categoryId === 'interview') return Promise.resolve(OPEN_QUESTIONS);
  if (categoryId === 'aptitude' || categoryId === 'verbal' || categoryId === 'reasoning') {
    return Promise.resolve(MCQ_BY_CATEGORY[categoryId] ?? []);
  }
  return Promise.resolve([]);
}

export async function getCodingQuestions(topicSlug: string): Promise<CodingQuestion[]> {
  return Promise.resolve(CODING_QUESTIONS.filter((q) => q.topic === topicSlug));
}

export async function getQuestionById(questionId: string): Promise<PrepQuestion | CodingQuestion | undefined> {
  return Promise.resolve(
    [...allMcqQuestions(), ...OPEN_QUESTIONS, ...CODING_QUESTIONS].find((q) => q.id === questionId),
  );
}

export async function getCompanies(): Promise<Company[]> {
  return Promise.resolve(COMPANIES);
}

export async function getCompany(slug: string): Promise<Company | undefined> {
  return Promise.resolve(COMPANIES.find((c) => c.slug === slug));
}

// Cross-category pull: every MCQ / coding / open question tagged with this company's slug.
export async function getCompanyQuestions(companySlug: string): Promise<(McqQuestion | CodingQuestion | OpenQuestion)[]> {
  const all: (McqQuestion | CodingQuestion | OpenQuestion)[] = [...allMcqQuestions(), ...CODING_QUESTIONS, ...OPEN_QUESTIONS];
  return Promise.resolve(all.filter((q) => q.tags.includes(companySlug)));
}

export async function getMockTests(): Promise<MockTest[]> {
  return Promise.resolve(MOCK_TESTS);
}

export async function getMockTest(idOrSlug: string): Promise<MockTest | undefined> {
  return Promise.resolve(MOCK_TESTS.find((t) => t.id === idOrSlug || t.slug === idOrSlug));
}

// Assembles a test's question pool at runtime from its topicPool (topic slugs,
// or category ids for the "mixed" test), then deterministically slices it to questionCount.
export async function getMockTestQuestions(test: MockTest): Promise<(McqQuestion | CodingQuestion)[]> {
  let pool: (McqQuestion | CodingQuestion)[] = [];

  if (test.category === 'mixed') {
    pool = [...allMcqQuestions(), ...CODING_QUESTIONS].filter((q) => test.topicPool.includes(q.category));
  } else if (test.category === 'coding') {
    pool = CODING_QUESTIONS.filter((q) => test.topicPool.includes(q.topic));
  } else {
    const source = MCQ_BY_CATEGORY[test.category as CategoryId] ?? [];
    pool = source.filter((q) => test.topicPool.includes(q.topic));
  }

  return Promise.resolve(pool.slice(0, test.questionCount));
}

export async function getRoadmap(): Promise<RoadmapStage[]> {
  return Promise.resolve(ROADMAP);
}

export async function getAchievements(): Promise<Achievement[]> {
  return Promise.resolve(ACHIEVEMENTS);
}

export async function getTips(group?: Tip['group']): Promise<Tip[]> {
  return Promise.resolve(group ? TIPS.filter((t) => t.group === group) : TIPS);
}

// Deterministic "daily challenge" — picked by day-of-year so it's stable for
// everyone on a given date without needing a dedicated data file.
export async function getDailyChallenge(date: Date = new Date()): Promise<McqQuestion> {
  const pool = MCQ_BY_CATEGORY.aptitude ?? [];
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
  return Promise.resolve(pool[dayOfYear % pool.length]);
}

export async function searchAll(query: string): Promise<SearchResultItem[]> {
  const q = query.trim().toLowerCase();
  if (!q) return Promise.resolve([]);

  const results: SearchResultItem[] = [];

  for (const cat of CATEGORIES) {
    for (const topic of cat.topics) {
      if (topic.name.toLowerCase().includes(q)) {
        results.push({ type: 'topic', label: topic.name, sublabel: cat.title, href: `/preparation/${cat.id}/${topic.slug}` });
      }
    }
  }

  for (const company of COMPANIES) {
    if (company.name.toLowerCase().includes(q)) {
      results.push({ type: 'company', label: company.name, sublabel: 'Company Specific', href: `/preparation/companies/${company.slug}` });
    }
  }

  const questionSources: { category: CategoryId; items: { id: string; question: string; topic: string }[] }[] = [
    { category: 'aptitude', items: MCQ_BY_CATEGORY.aptitude ?? [] },
    { category: 'verbal', items: MCQ_BY_CATEGORY.verbal ?? [] },
    { category: 'reasoning', items: MCQ_BY_CATEGORY.reasoning ?? [] },
    { category: 'interview', items: OPEN_QUESTIONS },
    { category: 'coding', items: CODING_QUESTIONS.map((c) => ({ id: c.id, question: c.title, topic: c.topic })) },
  ];

  for (const { category, items } of questionSources) {
    for (const item of items) {
      if (item.question.toLowerCase().includes(q)) {
        results.push({ type: 'question', label: item.question, sublabel: category, href: `/preparation/${category}/${item.topic}` });
        if (results.length >= 30) return Promise.resolve(results);
      }
    }
  }

  return Promise.resolve(results.slice(0, 30));
}
