// IndexedDB setup with Dexie.js

import Dexie, { Table } from 'dexie';
import { 
  AttemptRecord, 
  ReviewCard, 
  Mistake, 
  UserProgress,
  TopicProgress,
  VocabReviewCard,
  UserPreferences,
  DailyStats
} from '@/types/progress';

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
  
  constructor() {
    super('PolskiOdZeraDB');
    
    // Version 2: Add topic-related tables
    this.version(2).stores({
      attempts: '++id, exerciseId, topicId, timestamp',
      mistakes: 'id, exerciseId, topicId, timestamp, reviewed, errorType',
      reviewCards: 'id, exerciseId, topicId, vocabId, cardType, due',
      progress: 'id',
      topicProgress: 'id, topicId, lastAccessed',
      vocabReviewCards: 'id, topicId, due, state',
      preferences: 'id',
      dailyStats: 'date'
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
      progress: 'id'
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
  ttsRate: 1.0,
  ttsPitch: 1.0,
  showDiacriticsHelper: true,
  autoPlayTTS: false,
  darkMode: 'system',
};

export async function getUserProgress(): Promise<UserProgress> {
  const record = await db.progress.get('main');
  if (record) {
    // Ensure new fields exist
    return {
      ...record.data,
      topicsStarted: record.data.topicsStarted ?? [],
      topicsCompleted: record.data.topicsCompleted ?? [],
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
  };
  
  await db.progress.put({ id: 'main', data: defaultProgress });
  return defaultProgress;
}

export async function saveUserProgress(progress: UserProgress): Promise<void> {
  await db.progress.put({ id: 'main', data: progress });
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
}

export async function exportData(): Promise<{
  attempts: AttemptWithId[];
  mistakes: Mistake[];
  reviewCards: ReviewCard[];
  progress: UserProgress;
  topicProgress: TopicProgress[];
  preferences: UserPreferences;
}> {
  return {
    attempts: await db.attempts.toArray(),
    mistakes: await db.mistakes.toArray(),
    reviewCards: await db.reviewCards.toArray(),
    progress: await getUserProgress(),
    topicProgress: await getAllTopicProgress(),
    preferences: await getUserPreferences(),
  };
}
