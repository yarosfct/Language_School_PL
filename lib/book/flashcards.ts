import bookData from '@/content/book/book_data.json';
import { shuffle } from '@/lib/utils/string';
import type { Exercise, MCQData, OrderingData, Tag, TypedAnswerData } from '@/types/curriculum';

export type BookCardType = 'word' | 'sentence';
export type BookDifficulty = 'level_1' | 'level_2' | 'level_3';
export type BookCardSource = 'book' | 'generated';

export interface BookSectionOption {
  id: string;
  sectionNumber: number;
  topicEn: string;
  topicPl: string;
  label: string;
}

interface BookCardBase {
  id: string;
  type: BookCardType;
  source: BookCardSource;
  sectionId: string;
  sectionNumber: number;
  topicEn: string;
  topicPl: string;
}

export interface BookWordCard extends BookCardBase {
  type: 'word';
  polish: string;
  english: string[];
  partOfSpeech: string;
  contextSentence?: {
    en: string;
    pl: string;
  };
}

export interface BookSentenceCard extends BookCardBase {
  type: 'sentence';
  promptEn: string;
  answerPl: string;
  acceptedAnswers: string[];
  englishAlternatives: string[];
  grammarTags: string[];
  presetWordBank?: string[];
}

export type BookPracticeCard = BookWordCard | BookSentenceCard;

export interface GetBookCardsOptions {
  cardType: BookCardType;
  sectionId?: string;
  includeGenerated?: boolean;
}

export interface BuildExerciseOptions {
  difficulty: BookDifficulty;
  availableCards?: BookPracticeCard[];
}

interface RawBookData {
  entries?: Record<string, RawBookEntry>;
  indexes?: {
    by_kind?: {
      sections?: string[];
    };
  };
}

interface RawBookEntry {
  id?: unknown;
  section_number?: unknown;
  topic_en?: unknown;
  topic_pl?: unknown;
  data?: unknown;
}

interface Catalog {
  sections: BookSectionOption[];
  words: BookWordCard[];
  sentences: BookSentenceCard[];
}

interface ExtractedSentence {
  promptEn: string;
  answerPl: string;
  acceptedAnswers: string[];
  englishAlternatives: string[];
  grammarTags: string[];
}

interface ExtractedGeneratedSentence {
  promptEn: string;
  answerPl: string;
  acceptedAnswers: string[];
  wordBank?: string[];
}

interface ExtractedWord {
  polish: string;
  english: string[];
  partOfSpeech: string;
}

const DEFAULT_SECTION_NUMBER = 999;
const FALLBACK_TOPIC = 'Untitled Section';
const parsedBookData = bookData as RawBookData;

let cachedCatalog: Catalog | null = null;

export const BOOK_DIFFICULTY_LABELS: Record<BookDifficulty, string> = {
  level_1: 'Level 1 - Multiple Choice',
  level_2: 'Level 2 - Word Bank',
  level_3: 'Level 3 - Write It Yourself',
};

export function getBookSections(): BookSectionOption[] {
  return getCatalog().sections;
}

export function getBookPracticeCards(options: GetBookCardsOptions): BookPracticeCard[] {
  const catalog = getCatalog();
  const sectionId = options.sectionId ?? 'all';
  const includeGenerated = options.includeGenerated ?? true;

  const allCards = options.cardType === 'word' ? catalog.words : catalog.sentences;

  return allCards.filter((card) => {
    if (!includeGenerated && card.source !== 'book') {
      return false;
    }

    if (sectionId !== 'all' && card.sectionId !== sectionId) {
      return false;
    }

    return true;
  });
}

export function getBookCardCounts(includeGenerated = true): {
  wordCount: number;
  sentenceCount: number;
} {
  return {
    wordCount: getBookPracticeCards({ cardType: 'word', includeGenerated }).length,
    sentenceCount: getBookPracticeCards({ cardType: 'sentence', includeGenerated }).length,
  };
}

export function buildExerciseFromBookCard(card: BookPracticeCard, options: BuildExerciseOptions): Exercise {
  const availableCards = options.availableCards ?? getBookPracticeCards({ cardType: card.type, includeGenerated: true });

  if (card.type === 'word') {
    return buildWordExercise(card, options.difficulty, availableCards.filter(isWordCard));
  }

  return buildSentenceExercise(card, options.difficulty, availableCards.filter(isSentenceCard));
}

function getCatalog(): Catalog {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const entries = parsedBookData.entries ?? {};
  const sectionIds = resolveSectionIds(entries);

  const sections: BookSectionOption[] = [];
  const words: BookWordCard[] = [];
  const sentences: BookSentenceCard[] = [];

  const seenWordKeys = new Set<string>();
  const seenSentenceKeys = new Set<string>();

  for (const sectionId of sectionIds) {
    const entry = entries[sectionId];
    if (!entry) {
      continue;
    }

    const sectionNumber = toNumber(entry.section_number) ?? DEFAULT_SECTION_NUMBER;
    const topicEn = cleanText(toString(entry.topic_en) ?? FALLBACK_TOPIC);
    const topicPl = cleanText(toString(entry.topic_pl) ?? topicEn);

    sections.push({
      id: sectionId,
      sectionNumber,
      topicEn,
      topicPl,
      label: `${sectionNumber}. ${topicEn}`,
    });

    const sectionData = isRecord(entry.data) ? entry.data : {};

    const baseSentences = extractBaseSentences(sectionData.sentences);
    for (let index = 0; index < baseSentences.length; index += 1) {
      const item = baseSentences[index];
      const dedupeKey = `${sectionId}|${normalizeForCompare(item.promptEn)}|${normalizeForCompare(item.answerPl)}`;
      if (seenSentenceKeys.has(dedupeKey)) {
        continue;
      }

      seenSentenceKeys.add(dedupeKey);
      sentences.push({
        id: `sentence-${sectionId}-${index + 1}`,
        type: 'sentence',
        source: 'book',
        sectionId,
        sectionNumber,
        topicEn,
        topicPl,
        promptEn: item.promptEn,
        answerPl: item.answerPl,
        acceptedAnswers: item.acceptedAnswers,
        englishAlternatives: item.englishAlternatives,
        grammarTags: item.grammarTags,
      });
    }

    const generatedSentences = extractGeneratedSentences(sectionData.generated_practice);
    for (let index = 0; index < generatedSentences.length; index += 1) {
      const item = generatedSentences[index];
      const dedupeKey = `${sectionId}|${normalizeForCompare(item.promptEn)}|${normalizeForCompare(item.answerPl)}`;
      if (seenSentenceKeys.has(dedupeKey)) {
        continue;
      }

      seenSentenceKeys.add(dedupeKey);
      sentences.push({
        id: `sentence-generated-${sectionId}-${index + 1}`,
        type: 'sentence',
        source: 'generated',
        sectionId,
        sectionNumber,
        topicEn,
        topicPl,
        promptEn: item.promptEn,
        answerPl: item.answerPl,
        acceptedAnswers: item.acceptedAnswers,
        englishAlternatives: [],
        grammarTags: [],
        presetWordBank: item.wordBank,
      });
    }

    const extractedWords = extractWords(sectionData.vocabulary);
    for (let index = 0; index < extractedWords.length; index += 1) {
      const item = extractedWords[index];
      const dedupeKey = `${sectionId}|${normalizeForCompare(item.polish)}|${normalizeForCompare(item.english[0] ?? '')}`;
      if (seenWordKeys.has(dedupeKey)) {
        continue;
      }

      seenWordKeys.add(dedupeKey);

      const contextSentence = baseSentences.find((sentence) => containsTerm(sentence.answerPl, item.polish));

      words.push({
        id: `word-${sectionId}-${index + 1}`,
        type: 'word',
        source: 'book',
        sectionId,
        sectionNumber,
        topicEn,
        topicPl,
        polish: item.polish,
        english: item.english,
        partOfSpeech: item.partOfSpeech,
        contextSentence: contextSentence
          ? {
              en: contextSentence.promptEn,
              pl: contextSentence.answerPl,
            }
          : undefined,
      });
    }
  }

  sections.sort((a, b) => a.sectionNumber - b.sectionNumber || a.topicEn.localeCompare(b.topicEn));

  cachedCatalog = {
    sections,
    words,
    sentences,
  };

  return cachedCatalog;
}

function resolveSectionIds(entries: Record<string, RawBookEntry>): string[] {
  const indexed = parsedBookData.indexes?.by_kind?.sections ?? [];
  if (indexed.length > 0) {
    return indexed.filter((id): id is string => typeof id === 'string' && !!entries[id]);
  }

  return Object.keys(entries)
    .filter((entryId) => toNumber(entries[entryId]?.section_number) !== null)
    .sort((a, b) => {
      const aNumber = toNumber(entries[a]?.section_number) ?? DEFAULT_SECTION_NUMBER;
      const bNumber = toNumber(entries[b]?.section_number) ?? DEFAULT_SECTION_NUMBER;
      return aNumber - bNumber;
    });
}

function extractBaseSentences(value: unknown): ExtractedSentence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: ExtractedSentence[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const promptEn = cleanText(toString(item.en) ?? '');
    const answerPl = cleanText(toString(item.pl) ?? '');
    if (!promptEn || !answerPl) {
      continue;
    }

    const acceptedAnswers = uniqueByNormalized([
      answerPl,
      ...toStringArray(item.polish_alternatives),
    ]);

    output.push({
      promptEn,
      answerPl,
      acceptedAnswers,
      englishAlternatives: toStringArray(item.english_variants),
      grammarTags: toStringArray(item.grammar_tags),
    });
  }

  return output;
}

function extractGeneratedSentences(value: unknown): ExtractedGeneratedSentence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: ExtractedGeneratedSentence[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const type = cleanText(toString(item.type) ?? '');
    const promptEn = cleanText(toString(item.prompt_en) ?? '');

    if (!promptEn) {
      continue;
    }

    if (type === 'multiple_choice') {
      const answerPl = cleanText(toString(item.correct_answer) ?? '');
      if (!answerPl) {
        continue;
      }

      output.push({
        promptEn,
        answerPl,
        acceptedAnswers: [answerPl],
      });

      continue;
    }

    if (type === 'word_bank') {
      const answerPl = cleanText(toString(item.answer_pl) ?? '');
      if (!answerPl) {
        continue;
      }

      output.push({
        promptEn,
        answerPl,
        acceptedAnswers: [answerPl],
        wordBank: toStringArray(item.word_bank),
      });

      continue;
    }

    if (type === 'typed_input') {
      const acceptedAnswers = uniqueByNormalized(toStringArray(item.accepted_answers));
      if (acceptedAnswers.length === 0) {
        continue;
      }

      output.push({
        promptEn,
        answerPl: acceptedAnswers[0],
        acceptedAnswers,
      });
    }
  }

  return output;
}

function extractWords(value: unknown): ExtractedWord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: ExtractedWord[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const polish = cleanText(toString(item.pl) ?? '');
    if (!polish) {
      continue;
    }

    const english = uniqueByNormalized(toStringArray(item.en));
    if (english.length === 0) {
      continue;
    }

    output.push({
      polish,
      english,
      partOfSpeech: cleanText(toString(item.category) ?? 'word'),
    });
  }

  return output;
}

function buildWordExercise(card: BookWordCard, difficulty: BookDifficulty, wordPool: BookWordCard[]): Exercise {
  const baseTags: Tag[] = [
    { type: 'topic', value: 'book-exercises' },
    { type: 'topic', value: `section-${card.sectionNumber}` },
    { type: 'difficulty', value: difficulty },
  ];

  if (difficulty === 'level_1') {
    const distractors = selectWordDistractors(card, wordPool, 3);
    const optionTexts = shuffle([card.polish, ...distractors]).slice(0, 4);
    const options = optionTexts.map((text, index) => ({
      id: `option-${index + 1}`,
      text,
    }));

    const correctOptionId = options.find((option) => option.text === card.polish)?.id ?? options[0]?.id ?? 'option-1';
    const question = `Choose the best Polish translation for: "${card.english[0]}"`;

    const data: MCQData = {
      question,
      options,
      correctOptionId,
    };

    return {
      id: `book-word-${card.id}-${difficulty}`,
      type: 'mcq',
      question,
      tags: baseTags,
      data,
      solution: correctOptionId,
      explanation: `${card.english[0]} = ${card.polish}`,
      estimatedSeconds: 20,
    };
  }

  if (difficulty === 'level_2') {
    const targetPl = card.contextSentence?.pl ?? `To jest ${card.polish}.`;
    const targetEn = card.contextSentence?.en ?? `This is ${card.english[0]}.`;
    const orderedTokens = splitIntoDisplayTokens(targetPl);
    const scrambledTokens = ensureScrambled(orderedTokens);
    const question = `Build the Polish sentence: "${targetEn}"`;

    const data: OrderingData = {
      items: orderedTokens,
      scrambled: scrambledTokens,
    };

    return {
      id: `book-word-${card.id}-${difficulty}`,
      type: 'ordering',
      question,
      tags: baseTags,
      data,
      solution: orderedTokens,
      explanation: `Focus word: ${card.polish}`,
      estimatedSeconds: 35,
    };
  }

  const typedQuestion = `Type the Polish word for: "${card.english[0]}"`;
  const typedData: TypedAnswerData = {
    question: typedQuestion,
    acceptedAnswers: [card.polish],
    evaluationRules: {
      allowDiacriticErrors: true,
      allowTypos: false,
      caseSensitive: false,
    },
  };

  return {
    id: `book-word-${card.id}-${difficulty}`,
    type: 'typed-answer',
    question: typedQuestion,
    tags: baseTags,
    data: typedData,
    solution: card.polish,
    explanation: `${card.english[0]} = ${card.polish}`,
    hints: [`Part of speech: ${card.partOfSpeech}`],
    estimatedSeconds: 30,
  };
}

function buildSentenceExercise(card: BookSentenceCard, difficulty: BookDifficulty, sentencePool: BookSentenceCard[]): Exercise {
  const baseTags: Tag[] = [
    { type: 'topic', value: 'book-exercises' },
    { type: 'topic', value: `section-${card.sectionNumber}` },
    { type: 'difficulty', value: difficulty },
    ...card.grammarTags.slice(0, 3).map((grammar) => ({
      type: 'grammar' as const,
      value: grammar,
    })),
  ];

  if (difficulty === 'level_1') {
    const distractors = selectSentenceDistractors(card, sentencePool, 3);
    const optionTexts = shuffle([card.answerPl, ...distractors]).slice(0, 4);
    const options = optionTexts.map((text, index) => ({
      id: `option-${index + 1}`,
      text,
    }));

    const correctOptionId = options.find((option) => option.text === card.answerPl)?.id ?? options[0]?.id ?? 'option-1';
    const question = `Pick the best Polish translation: "${card.promptEn}"`;

    const data: MCQData = {
      question,
      options,
      correctOptionId,
    };

    return {
      id: `book-sentence-${card.id}-${difficulty}`,
      type: 'mcq',
      question,
      tags: baseTags,
      data,
      solution: correctOptionId,
      explanation: `Correct answer: ${card.answerPl}`,
      estimatedSeconds: 28,
    };
  }

  if (difficulty === 'level_2') {
    const orderedTokens = splitIntoDisplayTokens(card.answerPl);
    const wordBank = buildSentenceWordBank(orderedTokens, card, sentencePool);
    const question = `Build the Polish sentence: "${card.promptEn}"`;

    const data: OrderingData = {
      items: orderedTokens,
      scrambled: wordBank,
    };

    return {
      id: `book-sentence-${card.id}-${difficulty}`,
      type: 'ordering',
      question,
      tags: baseTags,
      data,
      solution: orderedTokens,
      explanation: `Target sentence: ${card.answerPl}`,
      estimatedSeconds: 40,
    };
  }

  const typedQuestion = `Write in Polish: "${card.promptEn}"`;
  const typedData: TypedAnswerData = {
    question: typedQuestion,
    acceptedAnswers: card.acceptedAnswers,
    evaluationRules: {
      allowDiacriticErrors: true,
      allowTypos: true,
      caseSensitive: false,
    },
  };

  return {
    id: `book-sentence-${card.id}-${difficulty}`,
    type: 'typed-answer',
    question: typedQuestion,
    tags: baseTags,
    data: typedData,
    solution: card.answerPl,
    explanation: `Primary answer: ${card.answerPl}`,
    hints: card.englishAlternatives.slice(0, 2),
    estimatedSeconds: 45,
  };
}

function selectWordDistractors(card: BookWordCard, pool: BookWordCard[], count: number): string[] {
  const candidates = pool.filter((item) => item.id !== card.id);
  if (candidates.length === 0) {
    return [];
  }

  const correctEnglishTokens = new Set(tokenize(card.english[0] ?? ''));
  const correctPolishLength = card.polish.length;

  const ranked = candidates
    .map((candidate) => {
      let score = 0;

      if (candidate.sectionId === card.sectionId) {
        score += 3;
      }

      if (candidate.partOfSpeech === card.partOfSpeech) {
        score += 2;
      }

      const candidateEnglishTokens = tokenize(candidate.english[0] ?? '');
      for (const token of candidateEnglishTokens) {
        if (correctEnglishTokens.has(token)) {
          score += 1;
        }
      }

      score += Math.max(0, 4 - Math.abs(candidate.polish.length - correctPolishLength) / 3);

      return {
        text: candidate.polish,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  return takeUniqueNormalized(ranked.map((item) => item.text), count, card.polish);
}

function selectSentenceDistractors(card: BookSentenceCard, pool: BookSentenceCard[], count: number): string[] {
  const candidates = pool.filter((item) => item.id !== card.id);
  if (candidates.length === 0) {
    return [];
  }

  const correctPromptTokens = new Set(tokenize(card.promptEn));
  const correctAnswerTokens = new Set(tokenize(card.answerPl));

  const ranked = candidates
    .map((candidate) => {
      let score = 0;

      if (candidate.sectionId === card.sectionId) {
        score += 3;
      }

      const candidatePromptTokens = tokenize(candidate.promptEn);
      for (const token of candidatePromptTokens) {
        if (correctPromptTokens.has(token)) {
          score += 1;
        }
      }

      const candidateAnswerTokens = tokenize(candidate.answerPl);
      for (const token of candidateAnswerTokens) {
        if (correctAnswerTokens.has(token)) {
          score += 1;
        }
      }

      score += Math.max(0, 5 - Math.abs(candidate.answerPl.length - card.answerPl.length) / 8);

      return {
        text: candidate.answerPl,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  return takeUniqueNormalized(ranked.map((item) => item.text), count, card.answerPl);
}

function buildSentenceWordBank(
  targetTokens: string[],
  card: BookSentenceCard,
  sentencePool: BookSentenceCard[]
): string[] {
  const candidateScores = new Map<string, number>();
  const targetNormalized = new Set(targetTokens.map((token) => normalizeForCompare(token)));
  const averageTargetLength = averageLength(targetTokens);

  for (const candidate of sentencePool) {
    if (candidate.id === card.id) {
      continue;
    }

    const proximityBonus = candidate.sectionId === card.sectionId ? 2 : 0;
    const candidateTokens = splitIntoDisplayTokens(candidate.answerPl);

    for (const candidateToken of candidateTokens) {
      const normalizedCandidateToken = normalizeForCompare(candidateToken);
      if (!normalizedCandidateToken || targetNormalized.has(normalizedCandidateToken)) {
        continue;
      }

      let score = proximityBonus;

      for (const targetToken of targetTokens) {
        if (looksSimilarToken(candidateToken, targetToken)) {
          score += 2;
        }
      }

      score += Math.max(0, 2 - Math.abs(candidateToken.length - averageTargetLength));

      const previousScore = candidateScores.get(candidateToken) ?? 0;
      candidateScores.set(candidateToken, Math.max(previousScore, score));
    }
  }

  const desiredTotalChips = Math.max(12, targetTokens.length + 4);
  const requiredDistractors = Math.max(0, desiredTotalChips - targetTokens.length);
  const uniqueNormalizedDistractors = new Set<string>();
  const distractors: string[] = [];

  const rankedCandidates = [...candidateScores.entries()].sort((a, b) => b[1] - a[1]);
  for (const [token] of rankedCandidates) {
    const normalized = normalizeForCompare(token);
    if (!normalized || uniqueNormalizedDistractors.has(normalized)) {
      continue;
    }

    uniqueNormalizedDistractors.add(normalized);
    distractors.push(token);

    if (distractors.length >= requiredDistractors) {
      break;
    }
  }

  if (distractors.length < requiredDistractors) {
    const globalFallbackTokens = getGlobalSentenceTokenPool();
    for (const token of globalFallbackTokens) {
      const normalized = normalizeForCompare(token);
      if (!normalized || targetNormalized.has(normalized) || uniqueNormalizedDistractors.has(normalized)) {
        continue;
      }

      uniqueNormalizedDistractors.add(normalized);
      distractors.push(token);
      if (distractors.length >= requiredDistractors) {
        break;
      }
    }
  }

  if (distractors.length < requiredDistractors) {
    const emergencyFallbackTokens = ['nie', 'już', 'bardzo', 'teraz', 'zawsze', 'nigdy', 'czasem', 'może', 'chyba', 'dzisiaj', 'wczoraj', 'jutro'];
    for (const token of emergencyFallbackTokens) {
      const normalized = normalizeForCompare(token);
      if (!normalized || targetNormalized.has(normalized) || uniqueNormalizedDistractors.has(normalized)) {
        continue;
      }

      uniqueNormalizedDistractors.add(normalized);
      distractors.push(token);
      if (distractors.length >= requiredDistractors) {
        break;
      }
    }
  }

  return shuffle([...targetTokens, ...distractors]);
}

function takeUniqueNormalized(values: string[], count: number, excludedValue: string): string[] {
  const excludedNormalized = normalizeForCompare(excludedValue);
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = normalizeForCompare(value);
    if (!normalized || normalized === excludedNormalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(value);
  }

  return shuffle(output).slice(0, count);
}

function uniqueByNormalized(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const cleaned = cleanText(value);
    const normalized = normalizeForCompare(cleaned);
    if (!cleaned || !normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(cleaned);
  }

  return output;
}

function splitIntoDisplayTokens(value: string): string[] {
  return cleanText(value)
    .split(/\s+/)
    .filter(Boolean);
}

function ensureScrambled(tokens: string[]): string[] {
  if (tokens.length <= 1) {
    return [...tokens];
  }

  let scrambled = shuffle(tokens);
  let attempts = 0;

  while (attempts < 5 && scrambled.join(' ') === tokens.join(' ')) {
    scrambled = shuffle(tokens);
    attempts += 1;
  }

  return scrambled;
}

function containsTerm(sentence: string, term: string): boolean {
  const normalizedSentence = normalizeForCompare(sentence);
  const normalizedTerm = normalizeForCompare(term);

  if (!normalizedSentence || !normalizedTerm) {
    return false;
  }

  if (normalizedTerm.includes(' ')) {
    return normalizedSentence.includes(normalizedTerm);
  }

  return tokenize(normalizedSentence).includes(normalizedTerm);
}

function looksSimilarToken(first: string, second: string): boolean {
  const firstNormalized = normalizeForCompare(first);
  const secondNormalized = normalizeForCompare(second);

  if (!firstNormalized || !secondNormalized) {
    return false;
  }

  if (firstNormalized === secondNormalized) {
    return true;
  }

  if (firstNormalized[0] === secondNormalized[0] && Math.abs(firstNormalized.length - secondNormalized.length) <= 2) {
    return true;
  }

  return firstNormalized.includes(secondNormalized) || secondNormalized.includes(firstNormalized);
}

function averageLength(values: string[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value.length, 0) / values.length;
}

let cachedGlobalSentenceTokenPool: string[] | null = null;

function getGlobalSentenceTokenPool(): string[] {
  if (cachedGlobalSentenceTokenPool) {
    return cachedGlobalSentenceTokenPool;
  }

  const seen = new Set<string>();
  const output: string[] = [];
  const sentenceCards = getBookPracticeCards({ cardType: 'sentence', includeGenerated: false }).filter(
    isSentenceCard
  );

  for (const sentenceCard of sentenceCards) {
    const tokens = splitIntoDisplayTokens(sentenceCard.answerPl);
    for (const token of tokens) {
      const normalized = normalizeForCompare(token);
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      output.push(token);
    }
  }

  cachedGlobalSentenceTokenPool = output;
  return output;
}

function tokenize(value: string): string[] {
  return normalizeForCompare(value)
    .split(' ')
    .filter(Boolean);
}

function normalizeForCompare(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function isWordCard(card: BookPracticeCard): card is BookWordCard {
  return card.type === 'word';
}

function isSentenceCard(card: BookPracticeCard): card is BookSentenceCard {
  return card.type === 'sentence';
}
