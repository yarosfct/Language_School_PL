// IndexedDB setup with Dexie.js

import Dexie, { Table } from 'dexie';
import { 
  AttemptRecord, 
  ReviewCard, 
  Mistake, 
  UserProgress,
  BookPathProgress,
  TopicProgress,
  VocabReviewCard,
  UserPreferences,
  DailyStats
} from '@/types/progress';
import type { CustomFlashcardSet, FlashcardLearningRecord, FlashcardPracticeType } from '@/types/flashcards';
import type {
  FillBlankAttemptRecord,
  FillBlankFavorite,
  FillBlankPoolTarget,
  FillBlankSentenceStats,
  FillBlankWordStats,
} from '@/types/fillBlanks';
import type { NotebookEntry } from '@/types/notebook';
import type { UserWordOverride } from '@/types/translations';
import { calculateMasteryScore, nextDueAt, sentenceStatId } from '@/lib/fillBlanks/planner';

export interface AttemptWithId extends AttemptRecord {
  id?: number;
  exerciseId: string;
  topicId?: string;
}

export interface ProgressRecord {
  id: string;
  data: UserProgress;
}

export interface PreferencesRecord {
  id: string;
  data: UserPreferences;
}

export class PolskiOdZeraDB extends Dexie {
  attempts!: Table<AttemptWithId, number>;
  mistakes!: Table<Mistake, string>;
  reviewCards!: Table<ReviewCard, string>;
  progress!: Table<ProgressRecord, string>;
  topicProgress!: Table<TopicProgress, string>;
  vocabReviewCards!: Table<VocabReviewCard, string>;
  preferences!: Table<PreferencesRecord, string>;
  dailyStats!: Table<DailyStats, string>;
  customFlashcardSets!: Table<CustomFlashcardSet, string>;
  flashcardLearning!: Table<FlashcardLearningRecord, string>;
  notebookEntries!: Table<NotebookEntry, string>;
  userWordOverrides!: Table<UserWordOverride, string>;
  fillBlankAttempts!: Table<FillBlankAttemptRecord, number>;
  fillBlankWordStats!: Table<FillBlankWordStats, string>;
  fillBlankSentenceStats!: Table<FillBlankSentenceStats, string>;
  fillBlankFavorites!: Table<FillBlankFavorite, string>;
  fillBlankPoolTargets!: Table<FillBlankPoolTarget, string>;
  
  constructor() {
    super('PolskiOdZeraDB');

    this.version(7).stores({
      attempts: '++id, exerciseId, topicId, timestamp',
      mistakes: 'id, exerciseId, topicId, timestamp, reviewed, errorType',
      reviewCards: 'id, exerciseId, topicId, vocabId, cardType, due',
      progress: 'id',
      topicProgress: 'id, topicId, lastAccessed',
      vocabReviewCards: 'id, topicId, due, state',
      preferences: 'id',
      dailyStats: 'date',
      customFlashcardSets: 'id, name, updatedAt',
      flashcardLearning: 'learningKey, cardId, practiceType, topicId, source, lastAttemptAt',
      notebookEntries: 'id, name, updatedAt, contextKey, *categories',
      userWordOverrides: 'id, normalizedToken, sectionId, updatedAt',
      fillBlankAttempts: '++id, unitId, exerciseId, poolSource, mode, timestamp, correct, failed',
      fillBlankWordStats: 'key, normalized, lemma, lastAttemptAt, dueAt, mastery',
      fillBlankSentenceStats: 'id, exerciseId, poolSource, lastAttemptAt, dueAt, mastery',
      fillBlankFavorites: 'id, kind, targetKey, exerciseId, poolSource, language, updatedAt',
      fillBlankPoolTargets: 'id, kind, normalized, targetKey, language, active, updatedAt'
    });

    this.version(6).stores({
      attempts: '++id, exerciseId, topicId, timestamp',
      mistakes: 'id, exerciseId, topicId, timestamp, reviewed, errorType',
      reviewCards: 'id, exerciseId, topicId, vocabId, cardType, due',
      progress: 'id',
      topicProgress: 'id, topicId, lastAccessed',
      vocabReviewCards: 'id, topicId, due, state',
      preferences: 'id',
      dailyStats: 'date',
      customFlashcardSets: 'id, name, updatedAt',
      flashcardLearning: 'learningKey, cardId, practiceType, topicId, source, lastAttemptAt',
      notebookEntries: 'id, name, updatedAt, contextKey, *categories',
      userWordOverrides: 'id, normalizedToken, sectionId, updatedAt'
    });

    this.version(5).stores({
      attempts: '++id, exerciseId, topicId, timestamp',
      mistakes: 'id, exerciseId, topicId, timestamp, reviewed, errorType',
      reviewCards: 'id, exerciseId, topicId, vocabId, cardType, due',
      progress: 'id',
      topicProgress: 'id, topicId, lastAccessed',
      vocabReviewCards: 'id, topicId, due, state',
      preferences: 'id',
      dailyStats: 'date',
      customFlashcardSets: 'id, name, updatedAt',
      notebookEntries: 'id, name, updatedAt, contextKey, *categories',
      userWordOverrides: 'id, normalizedToken, sectionId, updatedAt'
    });

    // Version 4: Add local word overrides for missing translations
    this.version(4).stores({
      attempts: '++id, exerciseId, topicId, timestamp',
      mistakes: 'id, exerciseId, topicId, timestamp, reviewed, errorType',
      reviewCards: 'id, exerciseId, topicId, vocabId, cardType, due',
      progress: 'id',
      topicProgress: 'id, topicId, lastAccessed',
      vocabReviewCards: 'id, topicId, due, state',
      preferences: 'id',
      dailyStats: 'date',
      customFlashcardSets: 'id, name, updatedAt',
      notebookEntries: 'id, name, updatedAt, contextKey, *categories',
      userWordOverrides: 'id, normalizedToken, sectionId, updatedAt'
    });

    // Version 3: Add custom flashcard sets
    this.version(3).stores({
      attempts: '++id, exerciseId, topicId, timestamp',
      mistakes: 'id, exerciseId, topicId, timestamp, reviewed, errorType',
      reviewCards: 'id, exerciseId, topicId, vocabId, cardType, due',
      progress: 'id',
      topicProgress: 'id, topicId, lastAccessed',
      vocabReviewCards: 'id, topicId, due, state',
      preferences: 'id',
      dailyStats: 'date',
      customFlashcardSets: 'id, name, updatedAt',
      notebookEntries: 'id, name, updatedAt, contextKey, *categories'
    });
    
    // Version 2: Add topic-related tables
    this.version(2).stores({
      attempts: '++id, exerciseId, topicId, timestamp',
      mistakes: 'id, exerciseId, topicId, timestamp, reviewed, errorType',
      reviewCards: 'id, exerciseId, topicId, vocabId, cardType, due',
      progress: 'id',
      topicProgress: 'id, topicId, lastAccessed',
      vocabReviewCards: 'id, topicId, due, state',
      preferences: 'id',
      dailyStats: 'date',
      customFlashcardSets: 'id, name, updatedAt',
      notebookEntries: 'id, name, updatedAt, contextKey, *categories'
    }).upgrade(tx => {
      // Migration: add default cardType to existing review cards
      return tx.table('reviewCards').toCollection().modify(card => {
        if (!card.cardType) {
          card.cardType = 'exercise';
        }
      });
    });
    
    // Keep version 1 for backwards compatibility
    this.version(1).stores({
      attempts: '++id, exerciseId, timestamp',
      mistakes: 'id, exerciseId, timestamp, reviewed',
      reviewCards: 'id, exerciseId, due',
      progress: 'id',
      customFlashcardSets: 'id, name, updatedAt',
      notebookEntries: 'id, name, updatedAt, contextKey, *categories'
    });
  }
}

export const db = new PolskiOdZeraDB();

// ============================================
// ATTEMPT HELPERS
// ============================================

export async function saveAttempt(
  exerciseId: string, 
  record: AttemptRecord,
  topicId?: string
): Promise<number> {
  return await db.attempts.add({ ...record, exerciseId, topicId });
}

export async function getExerciseAttempts(exerciseId: string): Promise<AttemptWithId[]> {
  return await db.attempts.where('exerciseId').equals(exerciseId).toArray();
}

export async function getTopicAttempts(topicId: string): Promise<AttemptWithId[]> {
  return await db.attempts.where('topicId').equals(topicId).toArray();
}

export async function getAllAttempts(): Promise<AttemptWithId[]> {
  return await db.attempts.toArray();
}

// ============================================
// REVIEW CARD HELPERS
// ============================================

export async function getReviewCard(id: string): Promise<ReviewCard | undefined> {
  return await db.reviewCards.get(id);
}

export async function saveReviewCard(card: ReviewCard): Promise<string> {
  return await db.reviewCards.put(card);
}

export async function getDueReviewCards(): Promise<ReviewCard[]> {
  const now = Date.now();
  return await db.reviewCards.where('due').belowOrEqual(now).toArray();
}

export async function getDueReviewCardsByTopic(topicId: string): Promise<ReviewCard[]> {
  const now = Date.now();
  const all = await db.reviewCards.where('topicId').equals(topicId).toArray();
  return all.filter(card => card.due <= now);
}

export async function getAllReviewCards(): Promise<ReviewCard[]> {
  return await db.reviewCards.toArray();
}

export async function getReviewCardsByTopic(topicId: string): Promise<ReviewCard[]> {
  return await db.reviewCards.where('topicId').equals(topicId).toArray();
}

export async function deleteReviewCard(id: string): Promise<void> {
  await db.reviewCards.delete(id);
}

// ============================================
// VOCABULARY REVIEW CARD HELPERS
// ============================================

export async function getVocabReviewCard(id: string): Promise<VocabReviewCard | undefined> {
  return await db.vocabReviewCards.get(id);
}

export async function saveVocabReviewCard(card: VocabReviewCard): Promise<string> {
  return await db.vocabReviewCards.put(card);
}

export async function getDueVocabReviewCards(): Promise<VocabReviewCard[]> {
  const now = Date.now();
  return await db.vocabReviewCards.where('due').belowOrEqual(now).toArray();
}

export async function getDueVocabReviewCardsByTopic(topicId: string): Promise<VocabReviewCard[]> {
  const now = Date.now();
  const all = await db.vocabReviewCards.where('topicId').equals(topicId).toArray();
  return all.filter(card => card.due <= now);
}

export async function getVocabReviewCardsByState(state: VocabReviewCard['state']): Promise<VocabReviewCard[]> {
  return await db.vocabReviewCards.where('state').equals(state).toArray();
}

// ============================================
// MISTAKE HELPERS
// ============================================

export async function saveMistake(mistake: Mistake): Promise<string> {
  return await db.mistakes.put(mistake);
}

export async function getRecentMistakes(limit: number = 20): Promise<Mistake[]> {
  return await db.mistakes
    .orderBy('timestamp')
    .reverse()
    .limit(limit)
    .toArray();
}

export async function getMistakesByTag(tagString: string): Promise<Mistake[]> {
  const all = await db.mistakes.toArray();
  return all.filter(m => 
    m.tags.some(t => `${t.type}:${t.value}` === tagString)
  );
}

export async function getMistakesByTopic(topicId: string): Promise<Mistake[]> {
  return await db.mistakes.where('topicId').equals(topicId).toArray();
}

export async function getMistakesByErrorType(errorType: Mistake['errorType']): Promise<Mistake[]> {
  if (!errorType) return [];
  return await db.mistakes.where('errorType').equals(errorType).toArray();
}

export async function getAllMistakes(): Promise<Mistake[]> {
  return await db.mistakes.toArray();
}

export async function getUnreviewedMistakes(): Promise<Mistake[]> {
  return await db.mistakes.where('reviewed').equals(0).toArray();
}

export async function markMistakeReviewed(id: string): Promise<void> {
  const mistake = await db.mistakes.get(id);
  if (mistake) {
    mistake.reviewed = true;
    await db.mistakes.put(mistake);
  }
}

export async function deleteMistake(id: string): Promise<void> {
  await db.mistakes.delete(id);
}

// ============================================
// USER PROGRESS HELPERS
// ============================================

const defaultPreferences: UserPreferences = {
  dailyGoal: 20,
  reviewNotifications: true,
  soundEnabled: true,
  devModeEnabled: false,
  ttsRate: 1.0,
  ttsPitch: 1.0,
  showDiacriticsHelper: true,
  autoPlayTTS: false,
  darkMode: 'system',
};

const defaultBookPath: BookPathProgress = {
  currentSectionId: null,
  currentDifficulty: 'level_1',
  updatedAt: Date.now(),
};

export async function getUserProgress(): Promise<UserProgress> {
  const record = await db.progress.get('main');
  if (record) {
    // Ensure new fields exist
    return {
      ...record.data,
      topicsStarted: record.data.topicsStarted ?? [],
      topicsCompleted: record.data.topicsCompleted ?? [],
      bookPath: {
        ...defaultBookPath,
        ...(record.data.bookPath ?? {}),
      },
    };
  }
  
  // Initialize default progress
  const defaultProgress: UserProgress = {
    lessonsCompleted: [],
    exercisesAttempted: {},
    currentLesson: null,
    totalScore: 0,
    streak: 0,
    lastActiveDate: new Date().toISOString().split('T')[0],
    topicsStarted: [],
    topicsCompleted: [],
    bookPath: defaultBookPath,
  };
  
  await db.progress.put({ id: 'main', data: defaultProgress });
  return defaultProgress;
}

export async function saveUserProgress(progress: UserProgress): Promise<void> {
  await db.progress.put({ id: 'main', data: progress });
}

export async function getBookPathProgress(): Promise<BookPathProgress> {
  const progress = await getUserProgress();
  return progress.bookPath;
}

export async function saveBookPathProgress(bookPath: BookPathProgress): Promise<void> {
  const progress = await getUserProgress();
  progress.bookPath = {
    ...bookPath,
    updatedAt: Date.now(),
  };
  await saveUserProgress(progress);
}

export async function updateBookPathProgress(patch: Partial<BookPathProgress>): Promise<BookPathProgress> {
  const current = await getBookPathProgress();
  const next = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  await saveBookPathProgress(next);
  return next;
}

export async function markLessonComplete(lessonId: string): Promise<void> {
  const progress = await getUserProgress();
  if (!progress.lessonsCompleted.includes(lessonId)) {
    progress.lessonsCompleted.push(lessonId);
    await saveUserProgress(progress);
  }
}

export async function markTopicStarted(topicId: string): Promise<void> {
  const progress = await getUserProgress();
  if (!progress.topicsStarted.includes(topicId)) {
    progress.topicsStarted.push(topicId);
    await saveUserProgress(progress);
  }
}

export async function markTopicCompleted(topicId: string): Promise<void> {
  const progress = await getUserProgress();
  if (!progress.topicsCompleted.includes(topicId)) {
    progress.topicsCompleted.push(topicId);
    await saveUserProgress(progress);
  }
}

export async function updateStreak(): Promise<void> {
  const progress = await getUserProgress();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  if (progress.lastActiveDate === today) {
    return;
  } else if (progress.lastActiveDate === yesterday) {
    progress.streak += 1;
  } else {
    progress.streak = 1;
  }
  
  progress.lastActiveDate = today;
  await saveUserProgress(progress);
}

// ============================================
// TOPIC PROGRESS HELPERS
// ============================================

export async function getTopicProgress(topicId: string): Promise<TopicProgress | undefined> {
  return await db.topicProgress.get(topicId);
}

export async function saveTopicProgress(progress: TopicProgress): Promise<string> {
  return await db.topicProgress.put(progress);
}

export async function getAllTopicProgress(): Promise<TopicProgress[]> {
  return await db.topicProgress.toArray();
}

export async function initializeTopicProgress(topicId: string): Promise<TopicProgress> {
  const existing = await getTopicProgress(topicId);
  if (existing) return existing;
  
  const newProgress: TopicProgress = {
    id: topicId,
    topicId,
    vocabLearned: [],
    vocabToReview: [],
    exercisesCompleted: [],
    exercisesCorrect: [],
    checkpointAttempts: 0,
    lastAccessed: Date.now(),
    startedAt: Date.now(),
    totalTimeSpent: 0,
  };
  
  await saveTopicProgress(newProgress);
  await markTopicStarted(topicId);
  return newProgress;
}

export async function markVocabLearned(topicId: string, vocabId: string): Promise<void> {
  const progress = await getTopicProgress(topicId) ?? await initializeTopicProgress(topicId);
  
  if (!progress.vocabLearned.includes(vocabId)) {
    progress.vocabLearned.push(vocabId);
  }
  // Remove from review list if present
  progress.vocabToReview = progress.vocabToReview.filter(id => id !== vocabId);
  progress.lastAccessed = Date.now();
  
  await saveTopicProgress(progress);
}

export async function markVocabToReview(topicId: string, vocabId: string): Promise<void> {
  const progress = await getTopicProgress(topicId) ?? await initializeTopicProgress(topicId);
  
  if (!progress.vocabToReview.includes(vocabId)) {
    progress.vocabToReview.push(vocabId);
  }
  progress.lastAccessed = Date.now();
  
  await saveTopicProgress(progress);
}

export async function markTopicExerciseCompleted(
  topicId: string, 
  exerciseId: string, 
  wasCorrect: boolean
): Promise<void> {
  const progress = await getTopicProgress(topicId) ?? await initializeTopicProgress(topicId);
  
  if (!progress.exercisesCompleted.includes(exerciseId)) {
    progress.exercisesCompleted.push(exerciseId);
  }
  if (wasCorrect && !progress.exercisesCorrect.includes(exerciseId)) {
    progress.exercisesCorrect.push(exerciseId);
  }
  progress.lastAccessed = Date.now();
  
  await saveTopicProgress(progress);
}

export async function updateTopicCheckpointScore(topicId: string, score: number): Promise<void> {
  const progress = await getTopicProgress(topicId) ?? await initializeTopicProgress(topicId);
  
  progress.checkpointScore = score;
  progress.checkpointAttempts += 1;
  progress.lastAccessed = Date.now();
  
  // Mark topic as completed if score >= 70%
  if (score >= 70) {
    progress.completedAt = Date.now();
    await markTopicCompleted(topicId);
  }
  
  await saveTopicProgress(progress);
}

export async function addTopicTimeSpent(topicId: string, milliseconds: number): Promise<void> {
  const progress = await getTopicProgress(topicId) ?? await initializeTopicProgress(topicId);
  
  progress.totalTimeSpent += milliseconds;
  progress.lastAccessed = Date.now();
  
  await saveTopicProgress(progress);
}

// ============================================
// PREFERENCES HELPERS
// ============================================

export async function getUserPreferences(): Promise<UserPreferences> {
  const record = await db.preferences.get('main');
  if (record) {
    return { ...defaultPreferences, ...record.data };
  }
  
  await db.preferences.put({ id: 'main', data: defaultPreferences });
  return defaultPreferences;
}

export async function saveUserPreferences(prefs: Partial<UserPreferences>): Promise<void> {
  const current = await getUserPreferences();
  await db.preferences.put({ id: 'main', data: { ...current, ...prefs } });
}

// ============================================
// CUSTOM FLASHCARD SET HELPERS
// ============================================

export async function getCustomFlashcardSet(id: string): Promise<CustomFlashcardSet | undefined> {
  return await db.customFlashcardSets.get(id);
}

export async function getAllCustomFlashcardSets(): Promise<CustomFlashcardSet[]> {
  return await db.customFlashcardSets.orderBy('updatedAt').reverse().toArray();
}

export async function saveCustomFlashcardSet(set: CustomFlashcardSet): Promise<string> {
  return await db.customFlashcardSets.put({
    ...set,
    updatedAt: Date.now(),
  });
}

export async function deleteCustomFlashcardSet(id: string): Promise<void> {
  await db.customFlashcardSets.delete(id);
}

// ============================================
// FLASHCARD LEARNING HELPERS
// ============================================

export async function getFlashcardLearningRecord(learningKey: string): Promise<FlashcardLearningRecord | undefined> {
  return await db.flashcardLearning.get(learningKey);
}

export async function getAllFlashcardLearningRecords(): Promise<FlashcardLearningRecord[]> {
  return await db.flashcardLearning.toArray();
}

export async function getFlashcardLearningRecordsByPracticeType(
  practiceType: FlashcardPracticeType
): Promise<FlashcardLearningRecord[]> {
  return await db.flashcardLearning.where('practiceType').equals(practiceType).toArray();
}

export async function saveFlashcardLearningRecord(record: FlashcardLearningRecord): Promise<string> {
  return await db.flashcardLearning.put(record);
}

// ============================================
// FILL BLANK PRACTICE HELPERS
// ============================================

export interface FillBlankWordStatInput {
  key: string;
  normalized: string;
  lemma?: string;
  displayText: string;
  translation?: string;
  partOfSpeech?: string;
}

export async function getAllFillBlankAttempts(): Promise<FillBlankAttemptRecord[]> {
  return await db.fillBlankAttempts.toArray();
}

export async function getAllFillBlankWordStats(): Promise<FillBlankWordStats[]> {
  return await db.fillBlankWordStats.toArray();
}

export async function getAllFillBlankSentenceStats(): Promise<FillBlankSentenceStats[]> {
  return await db.fillBlankSentenceStats.toArray();
}

export async function getAllFillBlankFavorites(): Promise<FillBlankFavorite[]> {
  return await db.fillBlankFavorites.toArray();
}

export async function getAllFillBlankPoolTargets(): Promise<FillBlankPoolTarget[]> {
  return await db.fillBlankPoolTargets.toArray();
}

export async function saveFillBlankAttemptWithStats(
  record: FillBlankAttemptRecord,
  wordInputs: FillBlankWordStatInput[]
): Promise<number> {
  const attemptId = await db.fillBlankAttempts.add(record);
  const uniqueWordInputs = uniqueBy(wordInputs, (input) => input.key);

  for (const wordInput of uniqueWordInputs) {
    await updateFillBlankWordStats(wordInput, record);
  }

  await updateFillBlankSentenceStats(record);
  return attemptId;
}

export async function toggleFillBlankFavorite(favorite: Omit<FillBlankFavorite, 'createdAt' | 'updatedAt'>): Promise<FillBlankFavorite | null> {
  const existing = await db.fillBlankFavorites.get(favorite.id);

  if (existing) {
    await db.fillBlankFavorites.delete(favorite.id);
    return null;
  }

  const now = Date.now();
  const next: FillBlankFavorite = {
    ...favorite,
    createdAt: now,
    updatedAt: now,
  };

  await db.fillBlankFavorites.put(next);
  return next;
}

export async function upsertFillBlankPoolTarget(input: {
  language: FillBlankPoolTarget['language'];
  targetKey: string;
  normalized: string;
  displayText: string;
  matchCount: number;
}): Promise<FillBlankPoolTarget> {
  const id = `word:${input.language}:${input.targetKey}`;
  const existing = await db.fillBlankPoolTargets.get(id);
  const now = Date.now();
  const target: FillBlankPoolTarget = {
    id,
    kind: 'word',
    language: input.language,
    targetKey: input.targetKey,
    normalized: input.normalized,
    displayText: input.displayText,
    matchCount: input.matchCount,
    active: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await db.fillBlankPoolTargets.put(target);
  return target;
}

async function updateFillBlankWordStats(
  input: FillBlankWordStatInput,
  record: FillBlankAttemptRecord
): Promise<void> {
  const existing = await db.fillBlankWordStats.get(input.key);
  const now = Date.now();
  const attempts = (existing?.attempts ?? 0) + 1;
  const correct = (existing?.correct ?? 0) + (record.correct ? 1 : 0);
  const failures = (existing?.failures ?? 0) + (record.failed ? 1 : 0);
  const learned = (existing?.learned ?? 0) + (record.learned ? 1 : 0);
  const warnings = (existing?.warnings ?? 0) + record.warnings;
  const hintsUsed = (existing?.hintsUsed ?? 0) + record.hintsUsed;
  const streakCorrect = record.correct ? (existing?.streakCorrect ?? 0) + 1 : 0;
  const streakWrong = record.correct ? 0 : (existing?.streakWrong ?? 0) + 1;
  const mastery = calculateMasteryScore({ attempts, correct, failures, warnings, hintsUsed });

  await db.fillBlankWordStats.put({
    key: input.key,
    normalized: input.normalized,
    lemma: input.lemma,
    displayText: input.displayText,
    translation: input.translation,
    partOfSpeech: input.partOfSpeech,
    attempts,
    correct,
    failures,
    learned,
    warnings,
    hintsUsed,
    streakCorrect,
    streakWrong,
    mastery,
    lastAttemptAt: record.timestamp,
    dueAt: nextDueAt({
      correct: record.correct,
      failed: record.failed,
      learned: record.learned,
      hintsUsed: record.hintsUsed,
      warnings: record.warnings,
      streakCorrect,
      now,
    }),
    updatedAt: now,
  });
}

async function updateFillBlankSentenceStats(record: FillBlankAttemptRecord): Promise<void> {
  const id = sentenceStatId(record.poolSource, record.exerciseId);
  const existing = await db.fillBlankSentenceStats.get(id);
  const now = Date.now();
  const attempts = (existing?.attempts ?? 0) + 1;
  const correct = (existing?.correct ?? 0) + (record.correct ? 1 : 0);
  const failures = (existing?.failures ?? 0) + (record.failed ? 1 : 0);
  const learned = (existing?.learned ?? 0) + (record.learned ? 1 : 0);
  const warnings = (existing?.warnings ?? 0) + record.warnings;
  const hintsUsed = (existing?.hintsUsed ?? 0) + record.hintsUsed;
  const streakCorrect = record.correct ? (existing?.streakCorrect ?? 0) + 1 : 0;
  const streakWrong = record.correct ? 0 : (existing?.streakWrong ?? 0) + 1;
  const mastery = calculateMasteryScore({ attempts, correct, failures, warnings, hintsUsed });

  await db.fillBlankSentenceStats.put({
    id,
    exerciseId: record.exerciseId,
    poolSource: record.poolSource,
    attempts,
    correct,
    failures,
    learned,
    warnings,
    hintsUsed,
    streakCorrect,
    streakWrong,
    mastery,
    lastAttemptAt: record.timestamp,
    dueAt: nextDueAt({
      correct: record.correct,
      failed: record.failed,
      learned: record.learned,
      hintsUsed: record.hintsUsed,
      warnings: record.warnings,
      streakCorrect,
      now,
    }),
    updatedAt: now,
  });
}

function uniqueBy<T>(items: T[], getter: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getter(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

// ============================================
// NOTEBOOK HELPERS
// ============================================

export async function getNotebookEntry(id: string): Promise<NotebookEntry | undefined> {
  return await db.notebookEntries.get(id);
}

export async function getAllNotebookEntries(): Promise<NotebookEntry[]> {
  return await db.notebookEntries.orderBy('updatedAt').reverse().toArray();
}

export async function saveNotebookEntry(entry: NotebookEntry): Promise<string> {
  return await db.notebookEntries.put({
    ...entry,
    categories: [...new Set(entry.categories.map((category) => category.trim()).filter(Boolean))],
    updatedAt: Date.now(),
  });
}

export async function deleteNotebookEntry(id: string): Promise<void> {
  await db.notebookEntries.delete(id);
}

// ============================================
// LOCAL WORD OVERRIDE HELPERS
// ============================================

export async function getAllUserWordOverrides(): Promise<UserWordOverride[]> {
  return await db.userWordOverrides.toArray();
}

export async function saveUserWordOverride(
  override: Omit<UserWordOverride, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> {
  const normalizedToken = override.normalizedToken.trim();
  const english = override.english
    .map((entry) => entry.trim())
    .filter((entry) => /[\p{L}\p{N}]/u.test(entry));
  const sectionPrefix = override.sectionId ? override.sectionId : 'global';
  const id = override.id ?? `${sectionPrefix}:${normalizedToken}`;
  const existing = await db.userWordOverrides.get(id);
  const now = Date.now();

  await db.userWordOverrides.put({
    ...existing,
    ...override,
    id,
    normalizedToken,
    english,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  return id;
}

export async function deleteUserWordOverride(id: string): Promise<void> {
  await db.userWordOverrides.delete(id);
}

// ============================================
// DAILY STATS HELPERS
// ============================================

export async function getTodayStats(): Promise<DailyStats> {
  const today = new Date().toISOString().split('T')[0];
  const existing = await db.dailyStats.get(today);
  
  if (existing) return existing;
  
  const newStats: DailyStats = {
    date: today,
    exercisesCompleted: 0,
    exercisesCorrect: 0,
    vocabLearned: 0,
    vocabReviewed: 0,
    timeSpent: 0,
    topicsWorkedOn: [],
    streakMaintained: false,
  };
  
  await db.dailyStats.put(newStats);
  return newStats;
}

export async function updateTodayStats(updates: Partial<DailyStats>): Promise<void> {
  const stats = await getTodayStats();
  await db.dailyStats.put({ ...stats, ...updates });
}

export async function incrementTodayExercise(correct: boolean, topicId?: string): Promise<void> {
  const stats = await getTodayStats();
  stats.exercisesCompleted += 1;
  if (correct) stats.exercisesCorrect += 1;
  if (topicId && !stats.topicsWorkedOn.includes(topicId)) {
    stats.topicsWorkedOn.push(topicId);
  }
  await db.dailyStats.put(stats);
}

export async function getStatsForDateRange(startDate: string, endDate: string): Promise<DailyStats[]> {
  return await db.dailyStats
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}

// ============================================
// DATABASE INITIALIZATION
// ============================================

export async function initializeDatabase(): Promise<void> {
  await getUserProgress();
  await getUserPreferences();
  await getTodayStats();
}

// ============================================
// DATABASE UTILITIES
// ============================================

export async function clearAllData(): Promise<void> {
  await db.attempts.clear();
  await db.mistakes.clear();
  await db.reviewCards.clear();
  await db.progress.clear();
  await db.topicProgress.clear();
  await db.vocabReviewCards.clear();
  await db.preferences.clear();
  await db.dailyStats.clear();
  await db.customFlashcardSets.clear();
  await db.flashcardLearning.clear();
  await db.notebookEntries.clear();
  await db.userWordOverrides.clear();
}

export async function exportData(): Promise<{
  attempts: AttemptWithId[];
  mistakes: Mistake[];
  reviewCards: ReviewCard[];
  progress: UserProgress;
  topicProgress: TopicProgress[];
  preferences: UserPreferences;
  customFlashcardSets: CustomFlashcardSet[];
  flashcardLearning: FlashcardLearningRecord[];
  notebookEntries: NotebookEntry[];
  userWordOverrides: UserWordOverride[];
}> {
  return {
    attempts: await db.attempts.toArray(),
    mistakes: await db.mistakes.toArray(),
    reviewCards: await db.reviewCards.toArray(),
    progress: await getUserProgress(),
    topicProgress: await getAllTopicProgress(),
    preferences: await getUserPreferences(),
    customFlashcardSets: await getAllCustomFlashcardSets(),
    flashcardLearning: await getAllFlashcardLearningRecords(),
    notebookEntries: await getAllNotebookEntries(),
    userWordOverrides: await getAllUserWordOverrides(),
  };
}
