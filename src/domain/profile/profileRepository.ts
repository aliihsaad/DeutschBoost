import { CEFRLevel } from '@/types';

export type LearnerProfileId = 'local-learner';
export type MotherLanguage =
  | 'english'
  | 'arabic'
  | 'spanish'
  | 'french'
  | 'turkish'
  | 'italian'
  | 'portuguese'
  | 'russian'
  | 'polish'
  | 'other';
export type LearningFocus = 'daily-life' | 'exam' | 'work' | 'study' | 'travel' | 'conversation';
export type TargetExam =
  | 'none'
  | 'goethe-a1'
  | 'goethe-a2'
  | 'goethe-b1'
  | 'goethe-b2'
  | 'telc-b1'
  | 'telc-b2'
  | 'testdaf';
export type ReviewIntensity = 'light' | 'steady' | 'intensive';
export type TutorStyle = 'balanced' | 'direct' | 'supportive' | 'examiner';
export type VoicePreference = 'standard' | 'austrian' | 'swiss';

export interface ProfileOption<Value extends string | number> {
  value: Value;
  label: string;
}

export interface LearnerProfile {
  id: LearnerProfileId;
  currentLevel: CEFRLevel;
  targetLevel: CEFRLevel;
  motherLanguage: MotherLanguage;
  learningFocus: LearningFocus;
  targetExam: TargetExam;
  dailyGoalMinutes: number;
  reviewIntensity: ReviewIntensity;
  tutorStyle: TutorStyle;
  voicePreference: VoicePreference;
  studyStreak: number;
  totalStudyTimeMinutes: number;
  updatedAt: string;
}

export const DEFAULT_LEARNER_PROFILE_STORAGE_KEY = 'deutschboost.learnerProfile.v1';

export const CEFR_LEVEL_OPTIONS: ProfileOption<CEFRLevel>[] = [
  { value: CEFRLevel.A1, label: 'A1 Beginner' },
  { value: CEFRLevel.A2, label: 'A2 Elementary' },
  { value: CEFRLevel.B1, label: 'B1 Intermediate' },
  { value: CEFRLevel.B2, label: 'B2 Upper intermediate' },
  { value: CEFRLevel.C1, label: 'C1 Advanced' },
  { value: CEFRLevel.C2, label: 'C2 Mastery' },
];

export const MOTHER_LANGUAGE_OPTIONS: ProfileOption<MotherLanguage>[] = [
  { value: 'english', label: 'English' },
  { value: 'arabic', label: 'Arabic' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
  { value: 'turkish', label: 'Turkish' },
  { value: 'italian', label: 'Italian' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'russian', label: 'Russian' },
  { value: 'polish', label: 'Polish' },
  { value: 'other', label: 'Other' },
];

export const LEARNING_FOCUS_OPTIONS: ProfileOption<LearningFocus>[] = [
  { value: 'daily-life', label: 'Daily life' },
  { value: 'exam', label: 'Exam preparation' },
  { value: 'work', label: 'Work' },
  { value: 'study', label: 'Study' },
  { value: 'travel', label: 'Travel' },
  { value: 'conversation', label: 'Conversation' },
];

export const TARGET_EXAM_OPTIONS: ProfileOption<TargetExam>[] = [
  { value: 'none', label: 'No exam target' },
  { value: 'goethe-a1', label: 'Goethe A1' },
  { value: 'goethe-a2', label: 'Goethe A2' },
  { value: 'goethe-b1', label: 'Goethe B1' },
  { value: 'goethe-b2', label: 'Goethe B2' },
  { value: 'telc-b1', label: 'telc B1' },
  { value: 'telc-b2', label: 'telc B2' },
  { value: 'testdaf', label: 'TestDaF' },
];

export const DAILY_GOAL_OPTIONS: ProfileOption<number>[] = [
  { value: 10, label: '10 minutes' },
  { value: 20, label: '20 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
  { value: 90, label: '90 minutes' },
];

export const REVIEW_INTENSITY_OPTIONS: ProfileOption<ReviewIntensity>[] = [
  { value: 'light', label: 'Light' },
  { value: 'steady', label: 'Steady' },
  { value: 'intensive', label: 'Intensive' },
];

export const TUTOR_STYLE_OPTIONS: ProfileOption<TutorStyle>[] = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'direct', label: 'Direct corrections' },
  { value: 'supportive', label: 'Supportive coach' },
  { value: 'examiner', label: 'Examiner mode' },
];

export const VOICE_PREFERENCE_OPTIONS: ProfileOption<VoicePreference>[] = [
  { value: 'standard', label: 'Standard German' },
  { value: 'austrian', label: 'Austrian German' },
  { value: 'swiss', label: 'Swiss German' },
];

type MaybePromise<T> = T | Promise<T>;

export interface ProfileStorage {
  getItem(key: string): MaybePromise<string | null>;
  setItem(key: string, value: string): MaybePromise<void>;
  removeItem(key: string): MaybePromise<void>;
}

export interface ProfileRepository {
  loadProfile(): Promise<LearnerProfile>;
  saveProfile(profile: LearnerProfile): Promise<LearnerProfile>;
  updateProfile(updater: (profile: LearnerProfile) => LearnerProfile): Promise<LearnerProfile>;
  resetProfile(): Promise<LearnerProfile>;
}

interface StorageProfileRepositoryOptions {
  storage: ProfileStorage;
  key?: string;
  now?: () => string;
}

export function createDefaultLearnerProfile(
  updatedAt = new Date().toISOString()
): LearnerProfile {
  return {
    id: 'local-learner',
    currentLevel: CEFRLevel.A1,
    targetLevel: CEFRLevel.B1,
    motherLanguage: 'english',
    learningFocus: 'daily-life',
    targetExam: 'none',
    dailyGoalMinutes: 30,
    reviewIntensity: 'steady',
    tutorStyle: 'balanced',
    voicePreference: 'standard',
    studyStreak: 0,
    totalStudyTimeMinutes: 0,
    updatedAt,
  };
}

export function createStorageProfileRepository(
  options: StorageProfileRepositoryOptions
): ProfileRepository {
  const key = options.key ?? DEFAULT_LEARNER_PROFILE_STORAGE_KEY;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async loadProfile(): Promise<LearnerProfile> {
      return loadFromStorage(options.storage, key, now);
    },
    async saveProfile(profile: LearnerProfile): Promise<LearnerProfile> {
      const normalized = normalizeLearnerProfile(profile, now);
      await options.storage.setItem(key, JSON.stringify(normalized));
      return normalized;
    },
    async updateProfile(updater: (profile: LearnerProfile) => LearnerProfile): Promise<LearnerProfile> {
      const current = await loadFromStorage(options.storage, key, now);
      return this.saveProfile(updater(current));
    },
    async resetProfile(): Promise<LearnerProfile> {
      await options.storage.removeItem(key);
      return createDefaultLearnerProfile(now());
    },
  };
}

async function loadFromStorage(
  storage: ProfileStorage,
  key: string,
  now: () => string
): Promise<LearnerProfile> {
  const stored = await storage.getItem(key);

  if (!stored) {
    return createDefaultLearnerProfile(now());
  }

  try {
    return normalizeLearnerProfile(JSON.parse(stored), now);
  } catch {
    await storage.removeItem(key);
    return createDefaultLearnerProfile(now());
  }
}

function normalizeLearnerProfile(value: unknown, now: () => string): LearnerProfile {
  const defaults = createDefaultLearnerProfile(now());
  const root = asRecord(value);
  const updatedAt = normalizeString(root.updatedAt, defaults.updatedAt);

  return {
    id: 'local-learner',
    currentLevel: normalizeOption(root.currentLevel, CEFR_LEVEL_OPTIONS, defaults.currentLevel),
    targetLevel: normalizeOption(root.targetLevel, CEFR_LEVEL_OPTIONS, defaults.targetLevel),
    motherLanguage: normalizeOption(root.motherLanguage, MOTHER_LANGUAGE_OPTIONS, defaults.motherLanguage),
    learningFocus: normalizeOption(root.learningFocus, LEARNING_FOCUS_OPTIONS, defaults.learningFocus),
    targetExam: normalizeOption(root.targetExam, TARGET_EXAM_OPTIONS, defaults.targetExam),
    dailyGoalMinutes: normalizeNumberOption(root.dailyGoalMinutes, DAILY_GOAL_OPTIONS, defaults.dailyGoalMinutes),
    reviewIntensity: normalizeOption(root.reviewIntensity, REVIEW_INTENSITY_OPTIONS, defaults.reviewIntensity),
    tutorStyle: normalizeOption(root.tutorStyle, TUTOR_STYLE_OPTIONS, defaults.tutorStyle),
    voicePreference: normalizeOption(root.voicePreference, VOICE_PREFERENCE_OPTIONS, defaults.voicePreference),
    studyStreak: normalizeNonNegativeNumber(root.studyStreak, defaults.studyStreak),
    totalStudyTimeMinutes: normalizeNonNegativeNumber(
      root.totalStudyTimeMinutes,
      defaults.totalStudyTimeMinutes
    ),
    updatedAt,
  };
}

function normalizeOption<Value extends string>(
  value: unknown,
  options: Array<ProfileOption<Value>>,
  fallback: Value
): Value {
  return typeof value === 'string' && options.some(option => option.value === value)
    ? (value as Value)
    : fallback;
}

function normalizeNumberOption(
  value: unknown,
  options: Array<ProfileOption<number>>,
  fallback: number
): number {
  return typeof value === 'number' && options.some(option => option.value === value) ? value : fallback;
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
