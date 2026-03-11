// Progress tracking and spaced repetition types

import { Tag } from './curriculum';

export interface UserProgress {
  lessonsCompleted: string[]; // lesson IDs (using array for JSON serialization)
  exercisesAttempted: Record<string, AttemptRecord[]>; // exercise ID -> attempts
  currentLesson: string | null;
  totalScore: number;
  streak: number; // consecutive days
  lastActiveDate: string; // ISO date
  // Topic-based progress
  topicsStarted: string[]; // topic IDs that user has started
  topicsCompleted: string[]; // topic IDs where checkpoint was passed
  // Book-first sequential learning path
  bookPath: BookPathProgress;
}

export type BookDifficultyLevel = 'level_1' | 'level_2' | 'level_3';

export interface BookPathProgress {
  currentSectionId: string | null;
  currentDifficulty: BookDifficultyLevel;
  updatedAt: number;
}

export interface AttemptRecord {
  timestamp: number;
  correct: boolean;
  answer: unknown; // User's answer
  timeSpent: number; // milliseconds
  hintsUsed: number;
  errorTags?: string[]; // e.g., ["diacritics", "word-order"]
}

// Spaced Repetition (SM-2 variant)
export interface ReviewCard {
  id: string; // unique card ID
  exerciseId: string;
  topicId?: string; // Reference to topic (for topic-based items)
  vocabId?: string; // Reference to vocabulary item (for vocab review)
  cardType: 'exercise' | 'vocabulary'; // Type of review card
  due: number; // Unix timestamp
  interval: number; // days until next review
  easeFactor: number; // 1.3 - 2.5 (default 2.5)
  repetitions: number; // consecutive correct answers
  lastReviewed: number | null;
  createdAt: number;
}

// Mistakes Tracking
export interface Mistake {
  id: string;
  exerciseId: string;
  topicId?: string; // Reference to topic
  timestamp: number;
  userAnswer: unknown;
  correctAnswer: unknown;
  tags: Tag[]; // Copy from exercise
  errorType?: 'diacritics' | 'word-order' | 'wrong-form' | 'wrong-word' | 'spelling' | 'other';
  reviewed: boolean; // User explicitly reviewed this mistake
}

export interface MistakeAnalytics {
  tagErrorRates: Record<string, { errors: number; total: number }>;
  topicErrorRates: Record<string, { errors: number; total: number }>; // by topicId
  weakSkills: Tag[]; // Tags with >40% error rate
  weakTopics: string[]; // Topic IDs with >40% error rate
  recentMistakes: Mistake[]; // Last 20
  errorTypeBreakdown: Record<string, number>; // Count by error type
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  createdAt: number;
  preferences: UserPreferences;
}

export interface UserPreferences {
  dailyGoal: number; // exercises per day
  reviewNotifications: boolean;
  soundEnabled: boolean;
  devModeEnabled: boolean; // Temporary: bypass learning progression gates
  // TTS preferences
  ttsVoiceURI?: string; // Selected voice URI
  ttsRate: number; // 0.5 - 2.0, default 1.0
  ttsPitch: number; // 0.5 - 2.0, default 1.0
  // UI preferences
  showDiacriticsHelper: boolean;
  autoPlayTTS: boolean; // Auto-play TTS on flashcards
  darkMode: 'system' | 'light' | 'dark';
}

// ============================================
// TOPIC PROGRESS TRACKING
// ============================================

export interface TopicProgress {
  id: string; // Same as topicId for easy lookup
  topicId: string;
  vocabLearned: string[]; // VocabularyItem IDs marked as "known"
  vocabToReview: string[]; // Marked as "don't know"
  exercisesCompleted: string[]; // Exercise IDs completed
  exercisesCorrect: string[]; // Exercise IDs answered correctly first time
  checkpointScore?: number; // 0-100, undefined if not attempted
  checkpointAttempts: number;
  lastAccessed: number; // Unix timestamp
  startedAt: number; // Unix timestamp
  completedAt?: number; // Unix timestamp when checkpoint passed
  totalTimeSpent: number; // milliseconds
}

export interface TopicProgressSummary {
  topicId: string;
  vocabProgress: number; // 0-100 percentage
  exerciseProgress: number; // 0-100 percentage
  checkpointPassed: boolean;
  dueReviewCount: number; // Items due for review in this topic
  lastAccessed: number;
}

// ============================================
// VOCABULARY REVIEW TRACKING
// ============================================

export interface VocabReviewCard {
  id: string; // vocab item ID
  topicId: string;
  word: string; // Polish word for reference
  translation: string; // English translation
  due: number; // Unix timestamp
  interval: number; // days
  easeFactor: number;
  repetitions: number;
  lastReviewed: number | null;
  createdAt: number;
  // Learning state
  state: 'new' | 'learning' | 'review' | 'mastered';
}

// ============================================
// SESSION TRACKING
// ============================================

export interface LearningSession {
  id: string;
  startedAt: number;
  endedAt?: number;
  topicId?: string;
  lessonId?: string;
  exercisesAttempted: number;
  exercisesCorrect: number;
  vocabReviewed: number;
  timeSpent: number; // milliseconds
}

export interface DailyStats {
  date: string; // ISO date YYYY-MM-DD
  exercisesCompleted: number;
  exercisesCorrect: number;
  vocabLearned: number;
  vocabReviewed: number;
  timeSpent: number; // milliseconds
  topicsWorkedOn: string[];
  streakMaintained: boolean;
}
