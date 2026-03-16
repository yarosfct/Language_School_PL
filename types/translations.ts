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

export interface TranslationLookupResponse {
  translation: string;
  provider: 'mymemory' | 'libretranslate' | 'context-heuristic';
}
