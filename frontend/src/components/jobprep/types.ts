// Shared types for the Job Preparation module (src/app/preparation/**).
// Data currently comes from src/data/preparation/*.json via src/services/preparation.ts —
// these types are the contract that a future Django API must also satisfy.

export type Difficulty = 'easy' | 'medium' | 'hard';

export type CategoryId = 'aptitude' | 'coding' | 'verbal' | 'reasoning' | 'interview' | 'companies';

export interface TopicMeta {
  slug: string;
  name: string;
}

export interface CategoryMeta {
  id: CategoryId;
  title: string;
  emoji: string;
  icon: string; // lucide-react icon name, resolved via ICON_MAP in PreparationCard
  gradient: string; // tailwind gradient classes, e.g. "from-blue-500 to-cyan-500"
  description: string;
  topics: TopicMeta[];
}

// Multiple-choice question — used by aptitude / verbal / reasoning, and by
// the "companies" cross-category pull (tags-filtered subset of these + coding + interview).
export interface McqQuestion {
  kind: 'mcq';
  id: string;
  category: CategoryId;
  topic: string;
  difficulty: Difficulty;
  question: string;
  options: string[];
  answer: number; // index into options
  explanation: string;
  hint: string;
  tags: string[]; // company slugs and/or topical keywords
  estimatedTime: number; // seconds
}

// Open-ended question — used by the "interview" category (HR/Technical/Behavioral/etc).
export interface OpenQuestion {
  kind: 'open';
  id: string;
  category: 'interview';
  topic: string;
  difficulty: Difficulty;
  question: string;
  modelAnswer: string;
  tips: string[];
  tags: string[];
  estimatedTime: number;
}

export type PrepQuestion = McqQuestion | OpenQuestion;

export interface CodingTestCase {
  input: string;
  expectedOutput: string;
}

export type CodingLanguage = 'javascript' | 'python' | 'java' | 'cpp';

export interface CodingQuestion {
  kind: 'coding';
  id: string;
  category: 'coding';
  topic: string;
  difficulty: Difficulty;
  title: string;
  question: string;
  starterCode: Record<CodingLanguage, string>;
  testCases: CodingTestCase[];
  sampleOutput: string;
  hint: string;
  explanation: string;
  tags: string[];
  estimatedTime: number;
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  difficulty: Difficulty;
  hiringNote: string;
  rounds: string[];
  tags: string[];
}

export interface MockTest {
  id: string;
  slug: string;
  title: string;
  category: 'quant' | 'reasoning' | 'verbal' | 'coding' | 'mixed';
  durationMins: number;
  questionCount: number;
  difficulty: Difficulty;
  passingPercent: number;
  topicPool: string[]; // topic slugs (or, for 'mixed', category ids) to draw questions from
}

export interface RoadmapMilestone {
  id: string;
  label: string;
  categoryId: CategoryId;
  topicSlug?: string;
}

export interface RoadmapStage {
  id: string;
  title: string;
  description: string;
  milestones: RoadmapMilestone[];
}

export type AchievementCriteria =
  | { type: 'streak'; value: number }
  | { type: 'solved'; value: number }
  | { type: 'category-solved'; category: CategoryId; value: number }
  | { type: 'test-passed'; value: number };

export interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: string; // lucide-react icon name
  criteria: AchievementCriteria;
}

export interface Tip {
  id: string;
  group: 'placement' | 'resume' | 'interview';
  text: string;
}

// ---- Local progress (localStorage-backed, see src/lib/prepStorage.ts) ----

export interface TopicProgress {
  attempted: number;
  correct: number;
}

export interface TestHistoryEntry {
  testId: string;
  score: number;
  total: number;
  passed: boolean;
  takenAt: string; // ISO timestamp
}

export interface RecentActivityEntry {
  label: string;
  href: string;
  at: string; // ISO timestamp
}

export interface StreakState {
  current: number;
  longest: number;
  lastActiveDate: string | null; // yyyy-mm-dd
}

export interface PrepProgress {
  solvedQuestionIds: string[];
  bookmarkedQuestionIds: string[];
  streak: StreakState;
  topicProgress: Record<string, TopicProgress>;
  activityLog: Record<string, number>; // yyyy-mm-dd -> questions solved that day
  testHistory: TestHistoryEntry[];
  recentActivity: RecentActivityEntry[];
  dailyGoal: number;
}

export interface SearchResultItem {
  type: 'question' | 'topic' | 'company';
  label: string;
  sublabel: string;
  href: string;
}
