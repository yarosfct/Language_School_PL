import bookData from '@/content/book/book_data.json';
import wordOverridesData from '@/content/book/word_overrides.json';
import type { BookSentenceCard } from '@/lib/book/flashcards';

export interface SectionUsefulWord {
  id: string;
  polish: string;
  english: string[];
  partOfSpeech: string;
}

export interface SectionTip {
  id: string;
  sourceId?: number | string;
  topic: string;
  content: string;
  examples: string[];
}

export interface SectionContent {
  sectionId: string;
  usefulWords: SectionUsefulWord[];
  tips: SectionTip[];
}

export interface SectionWordInsight {
  token: string;
  normalizedToken: string;
  polish: string;
  english: string[];
  partOfSpeech: string;
  isFallback?: boolean;
  source?:
    | 'book-section'
    | 'book-global'
    | 'static-section-override'
    | 'static-global-override'
    | 'local-section-override'
    | 'local-global-override'
    | 'fallback'
    | 'context-heuristic';
}

interface RawBookData {
  entries?: Record<string, RawBookEntry>;
}

interface RawBookEntry {
  data?: unknown;
}

interface RawWordOverrides {
  global?: Record<string, RawWordOverrideEntry>;
  bySection?: Record<string, Record<string, RawWordOverrideEntry>>;
}

interface RawWordOverrideEntry {
  polish?: unknown;
  english?: unknown;
  partOfSpeech?: unknown;
}

const parsedBookData = bookData as RawBookData;
const parsedWordOverrides = wordOverridesData as RawWordOverrides;
const sectionContentById = buildSectionContentById(parsedBookData.entries ?? {});
const globalUsefulWords = [...sectionContentById.values()].flatMap((section) => section.usefulWords);
const wordOverrides = buildWordOverrides(parsedWordOverrides);
const commonWordFallbacks: Record<string, Omit<SectionWordInsight, 'token' | 'normalizedToken'>> = {
  'jest': { polish: 'jest', english: ['is'], partOfSpeech: 'verb', isFallback: true },
  'jestes': { polish: 'jesteś', english: ['you are'], partOfSpeech: 'verb', isFallback: true },
  'byl': { polish: 'był', english: ['was'], partOfSpeech: 'verb', isFallback: true },
  'byla': { polish: 'była', english: ['was'], partOfSpeech: 'verb', isFallback: true },
  'bylo': { polish: 'było', english: ['was'], partOfSpeech: 'verb', isFallback: true },
  'sa': { polish: 'są', english: ['are'], partOfSpeech: 'verb', isFallback: true },
  'nadal': { polish: 'nadal', english: ['still'], partOfSpeech: 'adverb', isFallback: true },
  'bardzo': { polish: 'bardzo', english: ['very'], partOfSpeech: 'adverb', isFallback: true },
  'nie': { polish: 'nie', english: ['not'], partOfSpeech: 'particle', isFallback: true },
  'to': { polish: 'to', english: ['this', 'it'], partOfSpeech: 'pronoun', isFallback: true },
  'w': { polish: 'w', english: ['in'], partOfSpeech: 'preposition', isFallback: true },
  'na': { polish: 'na', english: ['on', 'for'], partOfSpeech: 'preposition', isFallback: true },
  'z': { polish: 'z', english: ['with', 'from'], partOfSpeech: 'preposition', isFallback: true },
  'i': { polish: 'i', english: ['and'], partOfSpeech: 'conjunction', isFallback: true },
  'ale': { polish: 'ale', english: ['but'], partOfSpeech: 'conjunction', isFallback: true },
  'czy': { polish: 'czy', english: ['whether', 'is/does ...?'], partOfSpeech: 'particle', isFallback: true },
  'sie': { polish: 'się', english: ['oneself', 'reflexive particle'], partOfSpeech: 'particle', isFallback: true },
};

export function getSectionContent(sectionId: string): SectionContent {
  return sectionContentById.get(sectionId) ?? {
    sectionId,
    usefulWords: [],
    tips: [],
  };
}

export function getWordInsightForToken(sectionId: string, token: string): SectionWordInsight | null {
  const normalizedToken = normalize(token);

  if (!normalizedToken) {
    return null;
  }

  const sectionOverride = wordOverrides.bySection.get(sectionId)?.get(normalizedToken);
  if (sectionOverride) {
    return toInsight(token, normalizedToken, sectionOverride, 'static-section-override');
  }

  const globalOverride = wordOverrides.global.get(normalizedToken);
  if (globalOverride) {
    return toInsight(token, normalizedToken, globalOverride, 'static-global-override');
  }

  const section = getSectionContent(sectionId);
  const sectionMatch = findBestWordMatch(section.usefulWords, normalizedToken);
  if (sectionMatch) {
    return toInsight(token, normalizedToken, sectionMatch, 'book-section');
  }

  const globalMatch = findBestWordMatch(globalUsefulWords, normalizedToken);
  if (globalMatch) {
    return toInsight(token, normalizedToken, globalMatch, 'book-global');
  }

  const fallback = commonWordFallbacks[normalizedToken];
  if (fallback) {
    return {
      token,
      normalizedToken,
      ...fallback,
      source: 'fallback',
    };
  }

  return {
    token,
    normalizedToken,
    polish: token,
    english: ['Translation not found yet'],
    partOfSpeech: 'unknown',
    isFallback: true,
    source: 'fallback',
  };
}

export function getTipsForSentenceCard(card: BookSentenceCard, tips: SectionTip[], limit = 2): SectionTip[] {
  if (tips.length === 0) {
    return [];
  }

  const cardNumber = extractNumericSuffix(card.id);
  const cardTokens = collectCardTokens(card);

  const scoredTips = tips
    .map((tip, index) => {
      let score = 0;

      if (typeof tip.sourceId === 'number' && tip.sourceId === cardNumber) {
        score += 8;
      }

      const topicTokens = tokenize(tip.topic);
      const contentTokens = tokenize(`${tip.content} ${tip.examples.join(' ')}`);

      for (const token of topicTokens) {
        if (cardTokens.has(token)) {
          score += 2;
        }
      }

      let contentMatches = 0;
      for (const token of contentTokens) {
        if (cardTokens.has(token)) {
          contentMatches += 1;
        }
      }
      score += Math.min(3, contentMatches);

      return {
        tip,
        score,
        index,
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const contextual = scoredTips.filter((item) => item.score >= 3).slice(0, limit).map((item) => item.tip);
  if (contextual.length > 0) {
    return contextual;
  }

  const fallbackIndex = Math.max(0, (cardNumber - 1) % tips.length);
  return [tips[fallbackIndex]];
}

function buildSectionContentById(entries: Record<string, RawBookEntry>): Map<string, SectionContent> {
  const output = new Map<string, SectionContent>();

  for (const [sectionId, entry] of Object.entries(entries)) {
    const data = isRecord(entry.data) ? entry.data : {};

    output.set(sectionId, {
      sectionId,
      usefulWords: extractUsefulWords(sectionId, data.vocabulary),
      tips: extractTips(sectionId, data.tips),
    });
  }

  return output;
}

function extractUsefulWords(sectionId: string, value: unknown): SectionUsefulWord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const output: SectionUsefulWord[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isRecord(item)) {
      continue;
    }

    const polish = cleanText(toString(item.pl) ?? '');
    if (!polish) {
      continue;
    }

    const english = unique(toStringArray(item.en));
    if (english.length === 0) {
      continue;
    }

    const dedupeKey = `${normalize(polish)}|${normalize(english[0] ?? '')}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    output.push({
      id: `useful-word-${sectionId}-${index + 1}`,
      polish,
      english,
      partOfSpeech: cleanText(toString(item.category) ?? 'word'),
    });
  }

  return output;
}

function extractTips(sectionId: string, value: unknown): SectionTip[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: SectionTip[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isRecord(item)) {
      continue;
    }

    const content = cleanText(toString(item.content) ?? '');
    if (!content) {
      continue;
    }

    const sourceId = toNumber(item.id) ?? toString(item.id) ?? undefined;
    output.push({
      id: `tip-${sectionId}-${index + 1}`,
      sourceId,
      topic: cleanText(toString(item.topic) ?? ''),
      content,
      examples: toStringArray(item.examples),
    });
  }

  return output;
}

function collectCardTokens(card: BookSentenceCard): Set<string> {
  const bucket = new Set<string>();

  const inputs = [card.promptEn, card.answerPl, ...card.acceptedAnswers, ...card.englishAlternatives, ...card.grammarTags];

  for (const input of inputs) {
    for (const token of tokenize(input)) {
      bucket.add(token);
    }
  }

  return bucket;
}

function extractNumericSuffix(value: string): number {
  const match = value.match(/-(\d+)$/);
  if (!match) {
    return 1;
  }

  return Number(match[1]);
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length > 1);
}

function normalize(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = normalize(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(value);
  }

  return output;
}

function findBestWordMatch(words: SectionUsefulWord[], normalizedToken: string): SectionUsefulWord | null {
  let bestMatch: SectionUsefulWord | null = null;
  let bestScore = -1;

  for (const word of words) {
    const normalizedWord = normalize(word.polish);
    if (!normalizedWord) {
      continue;
    }

    const score = getSimilarityScore(normalizedToken, normalizedWord);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = word;
    }
  }

  if (!bestMatch || bestScore < 60) {
    return null;
  }

  return bestMatch;
}

function toInsight(
  token: string,
  normalizedToken: string,
  word: SectionUsefulWord,
  source: SectionWordInsight['source']
): SectionWordInsight {
  return {
    token,
    normalizedToken,
    polish: word.polish,
    english: word.english,
    partOfSpeech: word.partOfSpeech,
    source,
  };
}

function getSharedPrefixLength(first: string, second: string): number {
  const limit = Math.min(first.length, second.length);
  let index = 0;

  while (index < limit && first[index] === second[index]) {
    index += 1;
  }

  return index;
}

function getSimilarityScore(normalizedToken: string, normalizedWord: string): number {
  if (normalizedWord === normalizedToken) {
    return 100;
  }

  const tokenStem = toComparableStem(normalizedToken);
  const wordStem = toComparableStem(normalizedWord);
  if (tokenStem.length >= 3 && tokenStem === wordStem) {
    return 82;
  }

  const sharedPrefix = getSharedPrefixLength(normalizedToken, normalizedWord);
  const minLength = Math.min(normalizedToken.length, normalizedWord.length);
  const lengthDelta = Math.abs(normalizedToken.length - normalizedWord.length);

  if (sharedPrefix >= Math.max(4, minLength - 1) && lengthDelta <= 2) {
    return 68;
  }

  return 0;
}

function toComparableStem(value: string): string {
  const endings = [
    'ami', 'ach', 'ego', 'emu', 'owej', 'owych', 'owym', 'ymi', 'ych', 'cie', 'ciej',
    'enie', 'anie', 'enie', 'esz', 'asz', 'amy', 'emy', 'cie', 'ać', 'eć', 'ić',
    'a', 'e', 'y', 'i', 'u', 'ą', 'ę', 'o'
  ];

  for (const ending of endings) {
    if (value.length - ending.length >= 3 && value.endsWith(ending)) {
      return value.slice(0, -ending.length);
    }
  }

  return value;
}

function buildWordOverrides(raw: RawWordOverrides): {
  global: Map<string, SectionUsefulWord>;
  bySection: Map<string, Map<string, SectionUsefulWord>>;
} {
  const global = new Map<string, SectionUsefulWord>();
  const bySection = new Map<string, Map<string, SectionUsefulWord>>();

  for (const [key, value] of Object.entries(raw.global ?? {})) {
    const normalizedKey = normalize(key);
    const entry = toUsefulWord(`override-global-${normalizedKey}`, value);
    if (!normalizedKey || !entry) {
      continue;
    }

    global.set(normalizedKey, entry);
  }

  for (const [sectionId, sectionEntries] of Object.entries(raw.bySection ?? {})) {
    const sectionMap = new Map<string, SectionUsefulWord>();

    for (const [key, value] of Object.entries(sectionEntries ?? {})) {
      const normalizedKey = normalize(key);
      const entry = toUsefulWord(`override-${sectionId}-${normalizedKey}`, value);
      if (!normalizedKey || !entry) {
        continue;
      }

      sectionMap.set(normalizedKey, entry);
    }

    bySection.set(sectionId, sectionMap);
  }

  return { global, bySection };
}

function toUsefulWord(id: string, value: RawWordOverrideEntry): SectionUsefulWord | null {
  const polish = cleanText(toString(value.polish) ?? '');
  const english = unique(toStringArray(value.english));
  const partOfSpeech = cleanText(toString(value.partOfSpeech) ?? 'word');

  if (!polish || english.length === 0) {
    return null;
  }

  return {
    id,
    polish,
    english,
    partOfSpeech,
  };
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => cleanText(item))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const cleaned = cleanText(value);
    return cleaned ? [cleaned] : [];
  }

  return [];
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
