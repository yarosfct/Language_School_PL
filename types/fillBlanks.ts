import type { CurationToken, HandpickedExercise } from '@/types/curation';

export type FillBlankPoolSource = 'handpicked' | 'ai_picked';
export type FillBlankPracticeMode = 'easy' | 'medium' | 'hard';
export type FillBlankLanguage = 'pl' | 'en';
export type FillBlankFavoriteKind = 'word' | 'sentence';
export type FillBlankAttemptErrorType = 'diacritics' | 'spelling' | 'wrong' | 'learn';

export interface PooledFillBlankExercise extends HandpickedExercise {
  poolSource: FillBlankPoolSource;
  poolId: string;
}

export interface FillBlankPoolResponse {
  exercises: PooledFillBlankExercise[];
  stats: {
    total: number;
    handpicked: number;
    aiPicked: number;
    categories: Record<string, number>;
    difficulties: Record<string, number>;
  };
}

export interface FillBlankPracticeUnit {
  id: string;
  poolSource: FillBlankPoolSource;
  exerciseId: string;
  mode: FillBlankPracticeMode;
  pl: string;
  en: string;
  category: string;
  difficulty: string;
  sentenceType: string;
  blankTokenIds: string[];
  targetTokenIds: string[];
  targetKeys: string[];
  targetTexts: string[];
  baseDifficulty: number;
  priority: number;
  exercise: PooledFillBlankExercise;
}

export interface FillBlankAttemptRecord {
  id?: number;
  unitId: string;
  exerciseId: string;
  poolSource: FillBlankPoolSource;
  mode: FillBlankPracticeMode;
  targetTokenIds: string[];
  targetKeys: string[];
  answer: string[];
  correct: boolean;
  failed: boolean;
  learned: boolean;
  attempts: number;
  warnings: number;
  hintsUsed: number;
  timeSpent: number;
  timestamp: number;
  errorType?: FillBlankAttemptErrorType;
}

export interface FillBlankWordStats {
  key: string;
  normalized: string;
  lemma?: string;
  displayText: string;
  translation?: string;
  partOfSpeech?: string;
  attempts: number;
  correct: number;
  failures: number;
  learned: number;
  warnings: number;
  hintsUsed: number;
  streakCorrect: number;
  streakWrong: number;
  mastery: number;
  lastAttemptAt?: number;
  dueAt?: number;
  updatedAt: number;
}

export interface FillBlankSentenceStats {
  id: string;
  exerciseId: string;
  poolSource: FillBlankPoolSource;
  attempts: number;
  correct: number;
  failures: number;
  learned: number;
  warnings: number;
  hintsUsed: number;
  streakCorrect: number;
  streakWrong: number;
  mastery: number;
  lastAttemptAt?: number;
  dueAt?: number;
  updatedAt: number;
}

export interface FillBlankFavorite {
  id: string;
  kind: FillBlankFavoriteKind;
  language?: FillBlankLanguage;
  targetKey?: string;
  displayText: string;
  exerciseId?: string;
  poolSource?: FillBlankPoolSource;
  createdAt: number;
  updatedAt: number;
}

export interface FillBlankPoolTarget {
  id: string;
  kind: 'word';
  language: FillBlankLanguage;
  targetKey: string;
  normalized: string;
  displayText: string;
  matchCount: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FillBlankEvaluationResult {
  kind: 'correct' | 'warning' | 'wrong';
  message: string;
  errorType?: FillBlankAttemptErrorType;
  distance?: number;
}

export interface FillBlankTokenSelection {
  language: FillBlankLanguage;
  token: CurationToken;
  exercise: PooledFillBlankExercise;
}
