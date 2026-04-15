export type CurationSource = 'book_exercises' | 'sentence_candidates';
export type CurationDifficulty = 'A1' | 'A2' | 'B1' | 'B2';
export type CurationSentenceType = 'question' | 'statement' | 'command' | 'exclamation';
export type CurationLlmStatus = 'complete' | 'failed';

export interface CuratedSourceExercise {
  id: string;
  pl: string;
  en: string;
  category: string;
  sentenceType: CurationSentenceType;
  difficulty: CurationDifficulty;
  commonality: string;
  score: number;
  handpicked: boolean;
}

export interface CurationToken {
  id: string;
  index: number;
  text: string;
  normalized: string;
  translation: string;
  selectedForBlank?: boolean;
  lemma?: string;
  partOfSpeech?: string;
  start?: number;
  end?: number;
}

export interface ExerciseLevels {
  easy: {
    mode: 'single_blank_variants';
    variants: Array<{ blankTokenIds: string[] }>;
  };
  medium: {
    mode: 'multi_blank';
    blankTokenIds: string[];
  };
  hard: {
    mode: 'full_sentence';
    blankTokenIds: string[];
  };
}

export interface CurationExplanation {
  summary: string;
  usage: string;
  grammarNotes: string[];
  nuanceNotes: string[];
  examples: Array<{ pl: string; en: string; note?: string }>;
  variations: Array<{ pl: string; en: string; note?: string }>;
}

export interface HandpickedExercise {
  id: string;
  source: CurationSource;
  sourceId: string;
  pl: string;
  en: string;
  category: string;
  difficulty: CurationDifficulty;
  sentenceType: CurationSentenceType;
  handpicked: true;
  blankablePolishTokenIds: string[];
  polishTokens: CurationToken[];
  englishTokens: CurationToken[];
  exerciseLevels: ExerciseLevels;
  explanation: CurationExplanation;
  llm: {
    provider: 'openai';
    model: string;
    promptVersion: 'curation-explanation-v1';
    generatedAt: string;
    status: CurationLlmStatus;
    error?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CurationListItem extends CuratedSourceExercise {
  source: CurationSource;
  polishTokens: CurationToken[];
  englishTokens: CurationToken[];
  handpickedExercise?: HandpickedExercise;
}

export interface CurationItemsResponse {
  items: CurationListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  stats: {
    total: number;
    handpicked: number;
    categories: Record<string, number>;
    difficulties: Record<string, number>;
  };
}

export interface HandpickRequest {
  source: CurationSource;
  sourceId: string;
  selectedPolishTokenIds: string[];
}

export interface HandpickResponse {
  exercise: HandpickedExercise;
}

export interface UnhandpickResponse {
  removedId: string;
}
