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

  return allBookWordCards.map((card) => {
    const section = sectionById.get(card.sectionId);

    return {
      id: `book-word-${card.id}`,
      source: 'book',
      prompt: card.english[0] ?? card.polish,
      answer: card.polish,
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
    acceptedAnswers: [card.answer],
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
