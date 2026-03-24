import type { BookSectionOption, BookSentenceCard, BookWordCard } from '@/lib/book/flashcards';
import { getBookPracticeCards, getBookSections } from '@/lib/book/flashcards';
import {
  getAllCustomFlashcardSets,
  getFlashcardLearningRecord,
  getFlashcardLearningRecordsByPracticeType,
  saveFlashcardLearningRecord,
} from '@/lib/db';
import { evaluateTypedAnswer } from '@/lib/exercises/evaluators';
import { levenshteinDistance, removeDiacritics, shuffle } from '@/lib/utils/string';
import type {
  CustomFlashcardCard,
  CustomFlashcardSet,
  FlashcardAnswerErrorType,
  FlashcardDifficultyBucket,
  FlashcardLearningRecord,
  FlashcardLimitType,
  FlashcardPracticeCard,
  FlashcardPracticeType,
  FlashcardSessionMode,
} from '@/types/flashcards';
import type { TypedAnswerData } from '@/types/curriculum';

export interface FlashcardSessionConfig {
  mode: FlashcardSessionMode;
  practiceType: FlashcardPracticeType;
  topicId?: string;
  customSetId?: string;
  difficultyBucket?: FlashcardDifficultyBucket;
  limitType: FlashcardLimitType;
  targetCount?: number;
  timeLimitMinutes?: number;
}

export interface FlashcardAnswerResult {
  correct: boolean;
  partialCorrect: boolean;
  feedback?: string;
  errorType?: FlashcardAnswerErrorType;
}

type FlashcardLearningOutcome =
  | 'exact-correct'
  | 'accepted-diacritics'
  | 'accepted-spelling'
  | 'wrong-close'
  | 'wrong-other';

interface WordCardWithSection extends BookWordCard {
  type: 'word';
}

const SUBJECT_PRONOUNS = ['ja', 'ty', 'on', 'ona', 'ono', 'my', 'wy', 'oni', 'one'] as const;
const ENGLISH_SUBJECT_TO_PRONOUN: Record<string, string[]> = {
  i: ['ja'],
  you: ['ty'],
  he: ['on'],
  she: ['ona'],
  it: ['ono'],
  we: ['my'],
  they: ['oni', 'one'],
};
const LEARNING_SCORE_BY_OUTCOME: Record<FlashcardLearningOutcome, number> = {
  'exact-correct': 1,
  'accepted-diacritics': 0.85,
  'accepted-spelling': 0.75,
  'wrong-close': 0.35,
  'wrong-other': 0,
};
const MAX_RECENT_SCORES = 8;

const allBookSections = getBookSections();
const allBookWordCards = getBookPracticeCards({ cardType: 'word', includeGenerated: false }).filter(
  isWordCard
);
const sectionById = new Map(allBookSections.map((section) => [section.id, section]));
const genderByCardId = buildGenderByCardId(allBookWordCards);
const promptGroups = buildPromptGroups(allBookWordCards);

export function buildFlashcardLearningKey(
  practiceType: FlashcardPracticeType,
  cardId: string
): string {
  return `${practiceType}:${cardId}`;
}

export function getFlashcardTopics(): BookSectionOption[] {
  return allBookSections;
}

export function getAllBookFlashcards(practiceType: FlashcardPracticeType = 'vocabulary'): FlashcardPracticeCard[] {
  if (practiceType === 'sentences') {
    return getSentenceFlashcards();
  }

  return mapWordCardsToPractice(allBookWordCards);
}

export function getTopicFlashcards(
  topicId: string,
  practiceType: FlashcardPracticeType = 'vocabulary'
): FlashcardPracticeCard[] {
  if (practiceType === 'sentences') {
    return getSentenceFlashcards().filter((card) => card.topicId === topicId);
  }

  return mapWordCardsToPractice(allBookWordCards.filter((card) => card.sectionId === topicId));
}

export function mapCustomSetToPracticeCards(set: CustomFlashcardSet): FlashcardPracticeCard[] {
  return set.cards.map((card: CustomFlashcardCard) => ({
    id: `custom-${set.id}-${card.id}`,
    source: 'custom',
    prompt: card.prompt,
    answer: card.answer,
    topicId: `custom-${set.id}`,
    topicLabel: set.name,
  }));
}

export async function getAllAvailableFlashcards(
  practiceType: FlashcardPracticeType = 'vocabulary'
): Promise<FlashcardPracticeCard[]> {
  const customSets = await getAllCustomFlashcardSets();

  return [
    ...getAllBookFlashcards(practiceType),
    ...customSets.flatMap((set) => mapCustomSetToPracticeCards(set)),
  ];
}

export async function getLearnedFlashcards(
  practiceType: FlashcardPracticeType,
  difficultyBucket?: FlashcardDifficultyBucket
): Promise<FlashcardPracticeCard[]> {
  const [records, availableCards] = await Promise.all([
    getFlashcardLearningRecordsByPracticeType(practiceType),
    getAllAvailableFlashcards(practiceType),
  ]);

  const availableByCardId = new Map(availableCards.map((card) => [card.id, card]));

  return records
    .filter((record) => {
      if (!availableByCardId.has(record.cardId)) {
        return false;
      }

      if (!difficultyBucket) {
        return true;
      }

      return getFlashcardDifficultyBucket(record) === difficultyBucket;
    })
    .map((record) => availableByCardId.get(record.cardId))
    .filter((card): card is FlashcardPracticeCard => !!card);
}

export function getInitialDeck(
  config: FlashcardSessionConfig,
  availableCards: FlashcardPracticeCard[]
): FlashcardPracticeCard[] {
  if (availableCards.length === 0) {
    return [];
  }

  const randomized = shuffle(availableCards);

  if (config.mode === 'practice') {
    return randomized;
  }

  if (config.limitType === 'full-topic') {
    return randomized;
  }

  if (config.limitType === 'count') {
    const requested = Math.max(1, config.targetCount ?? 20);
    const initialCount = Math.min(requested, randomized.length);
    return randomized.slice(0, initialCount);
  }

  return randomized;
}

export function shouldEndSession(
  config: FlashcardSessionConfig,
  shownCount: number,
  timeLeftMs: number
): boolean {
  if (config.mode === 'practice') {
    return false;
  }

  if (config.limitType === 'time') {
    return timeLeftMs <= 0;
  }

  if (config.limitType === 'full-topic') {
    return true;
  }

  const target = Math.max(1, config.targetCount ?? 20);
  return shownCount >= target;
}

export function evaluateFlashcardWriting(
  answer: string,
  card: FlashcardPracticeCard
): FlashcardAnswerResult {
  const typedData: TypedAnswerData = {
    acceptedAnswers: card.acceptedAnswers?.length ? card.acceptedAnswers : [card.answer],
    evaluationRules: {
      allowDiacriticErrors: true,
      allowTypos: true,
      caseSensitive: false,
    },
  };

  const result = evaluateTypedAnswer(typedData, answer);
  return {
    correct: result.correct,
    partialCorrect: result.partialCorrect ?? false,
    feedback: result.feedback,
    errorType: result.errorType,
  };
}

export async function recordFlashcardAttempt(
  card: FlashcardPracticeCard,
  practiceType: FlashcardPracticeType,
  answer: string,
  result: FlashcardAnswerResult,
  timestamp: number
): Promise<FlashcardLearningRecord> {
  const learningKey = buildFlashcardLearningKey(practiceType, card.id);
  const existing = await getFlashcardLearningRecord(learningKey);
  const outcome = classifyLearningOutcome(answer, card, result);
  const nextRecentScores = [...(existing?.recentScores ?? []), LEARNING_SCORE_BY_OUTCOME[outcome]].slice(
    -MAX_RECENT_SCORES
  );
  const errorTypeCounts = { ...(existing?.errorTypeCounts ?? {}) };
  const isExactCorrect = outcome === 'exact-correct';
  const isCorrect = result.correct;

  if (outcome === 'accepted-diacritics') {
    errorTypeCounts.diacritics = (errorTypeCounts.diacritics ?? 0) + 1;
  } else if (outcome === 'accepted-spelling' || outcome === 'wrong-close') {
    errorTypeCounts.spelling = (errorTypeCounts.spelling ?? 0) + 1;
  } else if (result.errorType) {
    errorTypeCounts[result.errorType] = (errorTypeCounts[result.errorType] ?? 0) + 1;
  }

  const nextRecord: FlashcardLearningRecord = {
    learningKey,
    cardId: card.id,
    practiceType,
    source: card.source,
    topicId: card.topicId,
    topicLabel: card.topicLabel,
    prompt: card.prompt,
    answer: card.answer,
    firstSeenAt: existing?.firstSeenAt ?? timestamp,
    lastSeenAt: timestamp,
    lastAttemptAt: timestamp,
    attempts: (existing?.attempts ?? 0) + 1,
    correctAttempts: (existing?.correctAttempts ?? 0) + (isCorrect ? 1 : 0),
    exactCorrectAttempts: (existing?.exactCorrectAttempts ?? 0) + (isExactCorrect ? 1 : 0),
    partialCorrectAttempts: (existing?.partialCorrectAttempts ?? 0) + (result.partialCorrect ? 1 : 0),
    wrongAttempts: (existing?.wrongAttempts ?? 0) + (isCorrect ? 0 : 1),
    errorTypeCounts,
    recentScores: nextRecentScores,
    currentCorrectStreak: isCorrect ? (existing?.currentCorrectStreak ?? 0) + 1 : 0,
    currentExactStreak: isExactCorrect ? (existing?.currentExactStreak ?? 0) + 1 : 0,
  };

  await saveFlashcardLearningRecord(nextRecord);
  return nextRecord;
}

export function getFlashcardDifficultyBucket(record: FlashcardLearningRecord): FlashcardDifficultyBucket {
  const successRate = record.attempts > 0 ? record.correctAttempts / record.attempts : 0;
  const exactnessRate = record.correctAttempts > 0 ? record.exactCorrectAttempts / record.correctAttempts : 0;
  const recentAverage = average(record.recentScores);

  if (record.attempts < 3) {
    return recentAverage < 0.45 ? 'hard' : 'medium';
  }

  const difficultyScore = recentAverage * 70 + successRate * 20 + exactnessRate * 10;

  if (difficultyScore >= 85) {
    return 'easy';
  }

  if (difficultyScore >= 60) {
    return 'medium';
  }

  return 'hard';
}

function isWordCard(card: unknown): card is WordCardWithSection {
  return typeof card === 'object' && card !== null && (card as { type?: string }).type === 'word';
}

function formatPrompt(prompt: string, gender?: 'masculine' | 'feminine'): string {
  if (!gender) {
    return prompt;
  }

  return `${prompt} (${gender === 'feminine' ? 'female' : 'male'})`;
}

function mapWordCardsToPractice(cards: WordCardWithSection[]): FlashcardPracticeCard[] {
  return cards.map((card) => {
    const section = sectionById.get(card.sectionId);
    const basePrompt = card.english[0] ?? card.polish;
    const groupKey = `${card.sectionId}|${normalizePromptKey(basePrompt)}`;
    const cardsWithSamePrompt = promptGroups.get(groupKey) ?? [];
    const distinctAnswers = new Set(cardsWithSamePrompt.map((item) => normalizeSpacing(item.polish.toLowerCase())));
    const shouldDisambiguate = distinctAnswers.size > 1;
    const gender = genderByCardId.get(card.id);
    const prompt = shouldDisambiguate
      ? formatPrompt(buildDisambiguatedPrompt(card, basePrompt), gender)
      : basePrompt;

    return {
      id: `book-word-${card.id}`,
      source: 'book',
      prompt,
      answer: card.polish,
      acceptedAnswers: buildAcceptedAnswers(card.polish),
      gender,
      topicId: card.sectionId,
      topicLabel: section?.label ?? card.topicEn,
    };
  });
}

function buildAcceptedAnswers(primaryAnswer: string): string[] {
  const variants = new Set<string>();
  const addVariant = (value: string) => {
    const normalized = normalizeSpacing(value);
    if (normalized) {
      variants.add(normalized);
    }
  };

  const noTrailingPunctuation = primaryAnswer.replace(/[.,!?;:…]+$/g, '');
  const withoutOptionalWords = primaryAnswer.replace(/\([^)]*\)/g, ' ');
  const withOptionalWords = primaryAnswer.replace(/\(([^)]*)\)/g, ' $1 ');

  addVariant(primaryAnswer);
  addVariant(noTrailingPunctuation);
  addVariant(withoutOptionalWords);
  addVariant(withOptionalWords);
  addVariant(withoutOptionalWords.replace(/[.,!?;:…]+$/g, ''));
  addVariant(withOptionalWords.replace(/[.,!?;:…]+$/g, ''));

  return [...variants];
}

function buildDisambiguatedPrompt(card: WordCardWithSection, basePrompt: string): string {
  if (normalizePromptKey(basePrompt) === 'short') {
    const englishHints = card.english.map((value) => normalizePromptKey(value));

    if (englishHints.some((value) => value.includes('not long'))) {
      return 'short - length';
    }

    if (englishHints.some((value) => value.includes('not tall/high') || value === 'low')) {
      return 'short - height';
    }
  }

  const secondaryHint = card.english
    .slice(1)
    .map((value) => normalizeSpacing(value))
    .find(Boolean);

  if (secondaryHint) {
    return `${basePrompt} - ${secondaryHint}`;
  }

  if (card.contextSentence?.en) {
    return `${basePrompt} - ${card.contextSentence.en}`;
  }

  return basePrompt;
}

function normalizeSpacing(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizePromptKey(value: string): string {
  return normalizeSpacing(value).toLowerCase();
}

function buildPromptGroups(cards: WordCardWithSection[]): Map<string, WordCardWithSection[]> {
  const groups = new Map<string, WordCardWithSection[]>();
  for (const card of cards) {
    const prompt = card.english[0] ?? card.polish;
    const key = `${card.sectionId}|${normalizePromptKey(prompt)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(card);
    } else {
      groups.set(key, [card]);
    }
  }
  return groups;
}

function buildGenderByCardId(cards: WordCardWithSection[]): Map<string, 'masculine' | 'feminine' | undefined> {
  const map = new Map<string, 'masculine' | 'feminine' | undefined>();
  for (const card of cards) {
    map.set(card.id, inferGender(card));
  }
  return map;
}

function inferGender(card: WordCardWithSection): 'masculine' | 'feminine' | undefined {
  if (card.gender) {
    return card.gender;
  }

  const englishHints = card.english.join(' ').toLowerCase();
  if (/\b(female|woman|feminine|fianc[eé]e)\b/.test(englishHints)) {
    return 'feminine';
  }
  if (/\b(male|man|masculine|fianc[eé])\b/.test(englishHints)) {
    return 'masculine';
  }

  const polish = card.polish.toLowerCase();
  const part = card.partOfSpeech.toLowerCase();

  if (part.includes('adjective')) {
    if (polish.endsWith('a')) {
      return 'feminine';
    }
    return 'masculine';
  }

  if (/(ka|anka|czyni|yni|owa)$/.test(polish)) {
    return 'feminine';
  }

  if (polish.endsWith('a')) {
    return 'feminine';
  }

  return 'masculine';
}

function getSentenceFlashcards(): FlashcardPracticeCard[] {
  const sentenceCards = getBookPracticeCards({ cardType: 'sentence', includeGenerated: false }).filter(
    (card): card is BookSentenceCard => card.type === 'sentence'
  );

  return sentenceCards.map((card) => {
    const section = sectionById.get(card.sectionId);
    return {
      id: `book-sentence-${card.id}`,
      source: 'book',
      prompt: card.promptEn,
      answer: card.answerPl,
      acceptedAnswers: buildConjugationAcceptedAnswers(card.promptEn, card.answerPl, card.acceptedAnswers),
      topicId: card.sectionId,
      topicLabel: section?.label ?? card.topicEn,
    };
  });
}

function buildConjugationAcceptedAnswers(promptEn: string, answerPl: string, acceptedAnswers: string[]): string[] {
  const variants = new Set<string>();

  for (const candidate of [answerPl, ...acceptedAnswers]) {
    for (const variant of buildAcceptedAnswers(candidate)) {
      variants.add(variant);
    }

    const words = normalizeSpacing(candidate).split(' ');
    if (words.length > 1 && isSubjectPronoun(words[0])) {
      variants.add(normalizeSpacing(words.slice(1).join(' ')));
    }
  }

  const englishStart = normalizeSpacing(promptEn).toLowerCase().split(' ')[0];
  const mappedPronouns = ENGLISH_SUBJECT_TO_PRONOUN[englishStart] ?? [];
  if (mappedPronouns.length > 0) {
    for (const pronoun of mappedPronouns) {
      variants.add(normalizeSpacing(`${pronoun} ${answerPl}`));
    }
  }

  return [...variants];
}

function isSubjectPronoun(value: string): boolean {
  return SUBJECT_PRONOUNS.includes(value.toLowerCase() as (typeof SUBJECT_PRONOUNS)[number]);
}

function classifyLearningOutcome(
  answer: string,
  card: FlashcardPracticeCard,
  result: FlashcardAnswerResult
): FlashcardLearningOutcome {
  if (result.correct && !result.partialCorrect) {
    return 'exact-correct';
  }

  if (result.correct && result.errorType === 'diacritics') {
    return 'accepted-diacritics';
  }

  if (result.correct) {
    return 'accepted-spelling';
  }

  return isCloseMiss(answer, card) ? 'wrong-close' : 'wrong-other';
}

function isCloseMiss(answer: string, card: FlashcardPracticeCard): boolean {
  const normalizedAnswer = normalizeAnswerForComparison(answer);
  if (!normalizedAnswer) {
    return false;
  }

  const acceptedAnswers = card.acceptedAnswers?.length ? card.acceptedAnswers : [card.answer];

  return acceptedAnswers.some((accepted) => {
    const normalizedTarget = normalizeAnswerForComparison(accepted);
    if (!normalizedTarget) {
      return false;
    }

    const typoThreshold = getCloseMissThreshold(normalizedTarget);
    if (levenshteinDistance(normalizedAnswer, normalizedTarget) <= typoThreshold) {
      return true;
    }

    const strippedAnswer = removeDiacritics(normalizedAnswer);
    const strippedTarget = removeDiacritics(normalizedTarget);
    return levenshteinDistance(strippedAnswer, strippedTarget) <= typoThreshold;
  });
}

function normalizeAnswerForComparison(value: string): string {
  return normalizeSpacing(value).toLowerCase();
}

function getCloseMissThreshold(target: string): number {
  const compactTarget = target.replace(/\s+/g, '');
  if (compactTarget.length <= 10) {
    return 2;
  }

  return 3;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
