export type FlashcardSessionMode = 'topic' | 'random' | 'difficulty' | 'custom';
export type FlashcardLimitType = 'count' | 'time';
export type FlashcardPracticeType = 'vocabulary' | 'sentences';

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
  createdAt: number;
  updatedAt: number;
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
