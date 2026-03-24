export type FlashcardSessionMode = 'topic' | 'practice' | 'difficulty' | 'custom';
export type FlashcardLimitType = 'full-topic' | 'count' | 'time';
export type FlashcardPracticeType = 'vocabulary' | 'sentences';
export type FlashcardDifficultyBucket = 'easy' | 'medium' | 'hard';
export type FlashcardTemplateSourceType = 'book-section' | 'curated';
export type FlashcardAnswerErrorType =
  | 'diacritics'
  | 'word-order'
  | 'wrong-form'
  | 'wrong-word'
  | 'spelling'
  | 'other';

export interface CustomFlashcardCard {
  id: string;
  prompt: string;
  answer: string;
  createdAt: number;
}

export interface CustomFlashcardSet {
  id: string;
  name: string;
  description?: string;
  cards: CustomFlashcardCard[];
  sourceType?: 'user' | 'template-import';
  templateId?: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FlashcardTemplateCard {
  id: string;
  prompt: string;
  answer: string;
  acceptedAnswers?: string[];
}

export interface FlashcardTemplateDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  sourceType: FlashcardTemplateSourceType;
  sectionId?: string;
  cards?: FlashcardTemplateCard[];
}

export interface ResolvedFlashcardTemplate extends FlashcardTemplateDefinition {
  cards: FlashcardTemplateCard[];
  cardCount: number;
  previewCards: FlashcardTemplateCard[];
}

export interface FlashcardPracticeCard {
  id: string;
  source: 'book' | 'custom';
  prompt: string;
  answer: string;
  acceptedAnswers?: string[];
  gender?: 'masculine' | 'feminine';
  topicId: string;
  topicLabel: string;
}

export interface FlashcardLearningRecord {
  learningKey: string;
  cardId: string;
  practiceType: FlashcardPracticeType;
  source: FlashcardPracticeCard['source'];
  topicId: string;
  topicLabel: string;
  prompt: string;
  answer: string;
  firstSeenAt: number;
  lastSeenAt: number;
  lastAttemptAt: number;
  attempts: number;
  correctAttempts: number;
  exactCorrectAttempts: number;
  partialCorrectAttempts: number;
  wrongAttempts: number;
  errorTypeCounts: Partial<Record<FlashcardAnswerErrorType, number>>;
  recentScores: number[];
  currentCorrectStreak: number;
  currentExactStreak: number;
}
