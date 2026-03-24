export interface UserWordOverride {
  id: string;
  normalizedToken: string;
  polish: string;
  english: string[];
  partOfSpeech: string;
  sectionId?: string | null;
  source: 'manual' | 'online';
  provider?: string;
  createdAt: number;
  updatedAt: number;
}

export type TranslationLookupType = 'word' | 'phrase';

export type TranslationProvider =
  | 'mymemory'
  | 'libretranslate'
  | 'context-heuristic'
  | 'openai-context';

export type TranslationConfidence = 'high' | 'medium' | 'low';

export interface TranslationInsightHint {
  polish?: string;
  normalizedToken?: string;
  englishCandidates?: string[];
  partOfSpeech?: string;
  source?: string;
}

export interface TranslationLookupRequest {
  text: string;
  sourceLang?: string;
  targetLang?: string;
  contextText?: string;
  sectionId?: string | null;
  lookupType?: TranslationLookupType;
  insight?: TranslationInsightHint;
}

export interface TranslationLookupResponse {
  translation: string;
  provider: TranslationProvider;
  alternatives?: string[];
  confidence?: TranslationConfidence;
  note?: string;
}
