// Core curriculum types for PolskiOdZera

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type CEFRSublevel = 'A1.1' | 'A1.2' | 'A2.1' | 'A2.2' | 'B1.1' | 'B1.2' | 'B2.1' | 'B2.2' | 'C1.1' | 'C1.2' | 'C2.1' | 'C2.2';

export type ExerciseType = 
  | 'mcq' 
  | 'match' 
  | 'fill-blank' 
  | 'typed-answer' 
  | 'ordering' 
  | 'connect' 
  | 'dictation' 
  | 'listening-mcq' 
  | 'dialogue-builder'
  // New exercise types
  | 'flashcard'
  | 'image-match'
  | 'listening-choice'
  | 'dialogue-comp';

export interface Tag {
  type: 'grammar' | 'topic' | 'difficulty' | 'error-type';
  value: string; // e.g., "case:genitive", "food", "A1", "diacritics"
}

export interface Unit {
  id: string; // "unit-01"
  title: string; // "Wprowadzenie (Introduction)"
  description: string;
  level: CEFRLevel;
  order: number;
  lessons: Lesson[];
}

export interface Lesson {
  id: string; // "lesson-01-01"
  unitId: string;
  title: string; // "Greetings and Introductions"
  description: string;
  order: number;
  exercises: Exercise[];
  grammarTopics: string[]; // References to grammar reference pages
  vocabularyIntroduced: VocabItem[];
}

export interface Exercise {
  id: string; // "ex-01-01-03" or "ex-topic-food-001"
  type: ExerciseType;
  question: string; // Markdown supported
  tags: Tag[];
  data: ExerciseData; // Type-specific payload
  solution: Solution; // Type-specific correct answer(s)
  explanation?: string; // Shown after submission
  hints?: string[];
  audio?: AudioAsset;
  topicId?: string; // Reference to parent topic (for topic-based exercises)
  estimatedSeconds?: number; // Expected time to complete
}

// ============================================
// EXISTING EXERCISE DATA STRUCTURES
// ============================================

export interface MCQData {
  question?: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
}

export interface MatchData {
  pairs: { left: string; right: string }[];
  shuffleRight: boolean;
}

export interface FillBlankData {
  template: string; // "Ja ___ student." (blanks as ___)
  blanks: {
    position: number;
    acceptedAnswers: string[]; // ["jestem"] - case-insensitive
    caseSensitive?: boolean;
  }[];
}

export interface TypedAnswerData {
  question?: string;
  acceptedAnswers: string[]; // Multiple valid forms
  evaluationRules: {
    allowDiacriticErrors: boolean;
    allowTypos: boolean; // Levenshtein distance <= 1
    caseSensitive: boolean;
  };
  feedbackHints?: {
    wrongCase?: string; // "Check the case ending"
    wrongGender?: string;
    wrongAspect?: string;
  };
}

export interface OrderingData {
  items: string[]; // Correct order
  scrambled?: string[]; // Pre-scrambled; if null, randomize
}

export interface ConnectData {
  leftItems: { id: string; text: string }[];
  rightItems: { id: string; text: string }[];
  correctPairs: { leftId: string; rightId: string }[];
}

// ============================================
// NEW EXERCISE DATA STRUCTURES
// ============================================

export interface FlashcardData {
  word: string;
  translation: string;
  pronunciation?: string; // IPA or simplified phonetic
  example?: { polish: string; english: string };
  imageAsset?: string; // Path to image/icon
  gender?: 'masculine' | 'feminine' | 'neuter';
  partOfSpeech?: string;
}

export interface ImageMatchData {
  images: { id: string; src: string; alt: string }[];
  words: { id: string; text: string }[];
  correctPairs: { imageId: string; wordId: string }[];
}

export interface ListeningChoiceData {
  audioText: string; // Text to be spoken via TTS
  options: { id: string; text: string }[];
  correctOptionId: string;
  playbackSpeed?: number; // 0.5 - 1.5, default 1.0
}

export interface DictationData {
  audioText: string; // Text to be spoken and typed
  acceptedAnswers: string[]; // Multiple valid transcriptions
  evaluationRules: TypedAnswerData['evaluationRules'];
  playbackSpeed?: number;
}

export interface DialogueCompData {
  dialogue: {
    speaker: string; // "A" or "B" or character name
    text: string; // Polish text
    translation?: string; // English translation
  }[];
  questions: {
    question: string;
    options: { id: string; text: string }[];
    correctId: string;
  }[];
}

// Unified Exercise Data type
export type ExerciseData = 
  | MCQData 
  | MatchData 
  | FillBlankData 
  | TypedAnswerData 
  | OrderingData 
  | ConnectData
  | FlashcardData
  | ImageMatchData
  | ListeningChoiceData
  | DictationData
  | DialogueCompData;

export type Solution = string | string[] | Record<string, string> | boolean;

export interface AudioAsset {
  url: string; // "/audio/lessons/01/greeting.mp3"
  transcript?: string;
  duration?: number; // seconds
}

// ============================================
// LEGACY VOCAB ITEM (for curriculum lessons)
// ============================================

export interface VocabItem {
  polish: string;
  english: string;
  partOfSpeech: string; // "noun", "verb", etc.
  gender?: 'masculine' | 'feminine' | 'neuter';
  tags: Tag[];
}

// ============================================
// TOPIC-BASED LEARNING TYPES
// ============================================

export interface Topic {
  id: string; // "topic-food", "topic-greetings"
  title: string; // "Food & Restaurant"
  description: string;
  icon: string; // Lucide icon name or emoji
  cefrLevel: CEFRLevel;
  sublevel: CEFRSublevel;
  tags: string[]; // ["food", "restaurant", "ordering"]
  estimatedMinutes: number;
  vocabularyItems: VocabularyItem[];
  exercises: Exercise[];
  checkpointExercises: Exercise[]; // Final quiz/checkpoint
  order: number; // Display order within level
}

export interface VocabularyItem {
  id: string; // "vocab-food-001"
  topicId: string;
  word: string; // Polish word
  pronunciation?: string; // IPA or simplified phonetic
  translationEN: string;
  translationPT?: string; // Optional Portuguese
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase' | 'numeral' | 'pronoun' | 'preposition' | 'conjunction' | 'interjection';
  gender?: 'masculine' | 'feminine' | 'neuter';
  plural?: string; // Plural form if applicable
  examples: { polish: string; english: string }[];
  imageAsset?: string; // Path to icon/image for visual learning
  audioAsset?: string; // Path to audio file (TTS fallback if missing)
  tags: Tag[];
  notes?: string; // Grammar notes, usage tips
}

// ============================================
// TOPIC METADATA (for _meta.json index)
// ============================================

export interface TopicMeta {
  id: string;
  title: string;
  icon: string;
  sublevel: CEFRSublevel;
  order: number;
  vocabCount: number;
  exerciseCount: number;
}

export interface TopicIndex {
  level: CEFRLevel;
  topics: TopicMeta[];
  lastUpdated: string; // ISO date
}
