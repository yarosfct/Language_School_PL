import type { BookSectionOption, BookWordCard } from '@/lib/book/flashcards';
import { getBookPracticeCards, getBookSections } from '@/lib/book/flashcards';
import { evaluateTypedAnswer } from '@/lib/exercises/evaluators';
import { shuffle } from '@/lib/utils/string';
import type {
  CustomFlashcardCard,
  CustomFlashcardSet,
  FlashcardLimitType,
  FlashcardPracticeCard,
  FlashcardSessionMode,
} from '@/types/flashcards';
import type { TypedAnswerData } from '@/types/curriculum';

export interface FlashcardSessionConfig {
  mode: FlashcardSessionMode;
  topicId?: string;
  customSetId?: string;
  limitType: FlashcardLimitType;
  targetCount?: number;
  timeLimitMinutes?: number;
}

export interface FlashcardAnswerResult {
  correct: boolean;
  partialCorrect: boolean;
  feedback?: string;
  errorType?: 'diacritics' | 'word-order' | 'wrong-form' | 'wrong-word' | 'spelling' | 'other';
}

interface WordCardWithSection extends BookWordCard {
  type: 'word';
}

const allBookSections = getBookSections();
const allBookWordCards = getBookPracticeCards({ cardType: 'word', includeGenerated: false }).filter(
  isWordCard
);

export function getFlashcardTopics(): BookSectionOption[] {
  return allBookSections;
}

export function getAllBookFlashcards(): FlashcardPracticeCard[] {
  const sectionById = new Map(allBookSections.map((section) => [section.id, section]));
  const genderByCardId = buildGenderByCardId(allBookWordCards);
  const promptGroups = buildPromptGroups(allBookWordCards);

  return allBookWordCards.map((card) => {
    const section = sectionById.get(card.sectionId);
    const basePrompt = card.english[0] ?? card.polish;
    const groupKey = `${card.sectionId}|${normalizePromptKey(basePrompt)}`;
    const cardsWithSamePrompt = promptGroups.get(groupKey) ?? [];
    const distinctAnswers = new Set(cardsWithSamePrompt.map((item) => normalizeSpacing(item.polish.toLowerCase())));
    const shouldDisambiguate = distinctAnswers.size > 1;
    const gender = genderByCardId.get(card.id);

    return {
      id: `book-word-${card.id}`,
      source: 'book',
      prompt: shouldDisambiguate ? formatPrompt(basePrompt, gender) : basePrompt,
      answer: card.polish,
      acceptedAnswers: buildAcceptedAnswers(card.polish),
      gender,
      topicId: card.sectionId,
      topicLabel: section?.label ?? card.topicEn,
    };
  });
}

export function getTopicFlashcards(topicId: string): FlashcardPracticeCard[] {
  return getAllBookFlashcards().filter((card) => card.topicId === topicId);
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

export function getInitialDeck(
  config: FlashcardSessionConfig,
  availableCards: FlashcardPracticeCard[]
): FlashcardPracticeCard[] {
  if (availableCards.length === 0) {
    return [];
  }

  const randomized = shuffle(availableCards);

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
  if (config.limitType === 'time') {
    return timeLeftMs <= 0;
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

function isWordCard(card: unknown): card is WordCardWithSection {
  return typeof card === 'object' && card !== null && (card as { type?: string }).type === 'word';
}

function formatPrompt(prompt: string, gender?: 'masculine' | 'feminine'): string {
  if (!gender) {
    return prompt;
  }

  return `${prompt} (${gender === 'feminine' ? 'female' : 'male'})`;
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
