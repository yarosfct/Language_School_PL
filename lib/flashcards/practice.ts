import type { BookSectionOption, BookSentenceCard, BookWordCard } from '@/lib/book/flashcards';
import { getBookPracticeCards, getBookSections } from '@/lib/book/flashcards';
import { evaluateTypedAnswer } from '@/lib/exercises/evaluators';
import { shuffle } from '@/lib/utils/string';
import type {
  CustomFlashcardCard,
  CustomFlashcardSet,
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

const allBookSections = getBookSections();
const allBookWordCards = getBookPracticeCards({ cardType: 'word', includeGenerated: false }).filter(
  isWordCard
);

export function getFlashcardTopics(): BookSectionOption[] {
  return allBookSections;
}

export function getAllBookFlashcards(practiceType: FlashcardPracticeType = 'mixed'): FlashcardPracticeCard[] {
  if (practiceType === 'conjugation') {
    return getConjugationFlashcards();
  }

  const sectionById = new Map(allBookSections.map((section) => [section.id, section]));
  const genderByCardId = buildGenderByCardId(allBookWordCards);
  const promptGroups = buildPromptGroups(allBookWordCards);
  const verbOnly = practiceType === 'verbs';

  return allBookWordCards
    .filter((card) => (verbOnly ? isVerbCard(card) : true))
    .map((card) => {
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

export function getTopicFlashcards(topicId: string, practiceType: FlashcardPracticeType = 'mixed'): FlashcardPracticeCard[] {
  return getAllBookFlashcards(practiceType).filter((card) => card.topicId === topicId);
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

function getConjugationFlashcards(): FlashcardPracticeCard[] {
  const sentenceCards = getBookPracticeCards({ cardType: 'sentence', includeGenerated: false }).filter(
    (card): card is BookSentenceCard => card.type === 'sentence'
  );
  const sectionById = new Map(allBookSections.map((section) => [section.id, section]));

  return sentenceCards
    .filter((card) => isLikelyConjugationCard(card.promptEn, card.answerPl))
    .map((card) => {
      const section = sectionById.get(card.sectionId);
      return {
        id: `book-conjugation-${card.id}`,
        source: 'book',
        prompt: card.promptEn,
        answer: card.answerPl,
        acceptedAnswers: buildConjugationAcceptedAnswers(card.promptEn, card.answerPl, card.acceptedAnswers),
        topicId: card.sectionId,
        topicLabel: section?.label ?? card.topicEn,
      };
    });
}

function isVerbCard(card: WordCardWithSection): boolean {
  return card.partOfSpeech.toLowerCase().includes('verb');
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

function isLikelyConjugationCard(promptEn: string, answerPl: string): boolean {
  const english = promptEn.toLowerCase();
  const polish = answerPl.toLowerCase();

  const progressiveOrCopula = /\b(am|is|are|was|were)\b\s+\w+/.test(english) || /\bto\b\s+\w+/.test(english);
  const startsWithPronoun = SUBJECT_PRONOUNS.some((pronoun) => polish.startsWith(`${pronoun} `));
  const singleVerbLikeWord = /^[a-ząćęłńóśźż]+$/i.test(polish);

  return progressiveOrCopula || startsWithPronoun || singleVerbLikeWord;
}

function isSubjectPronoun(value: string): boolean {
  return SUBJECT_PRONOUNS.includes(value.toLowerCase() as (typeof SUBJECT_PRONOUNS)[number]);
}
