import { shuffle } from '@/lib/utils/string';
import type { Mistake } from '@/types/progress';
import {
  type BookCardType,
  type BookDifficulty,
  type BookPracticeCard,
  getBookPracticeCards,
  getBookSections,
} from '@/lib/book/flashcards';

export type LearningMode = 'sequential' | 'random' | 'topic' | 'difficulty';
export type ExerciseOrder = 'sequential' | 'random';
export type DesiredDifficulty = 'adaptive' | BookDifficulty;
export type CardMix = 'mixed' | BookCardType;

export interface LearningSettings {
  mode: LearningMode;
  cardMix: CardMix;
  topicId: string | null;
  desiredDifficulty: DesiredDifficulty;
  order: ExerciseOrder;
  includeGenerated: boolean;
  timeMinutes: number;
  exerciseCount: number;
}

export interface PlannedExercise {
  id: string;
  card: BookPracticeCard;
  difficulty: BookDifficulty;
  heuristicDifficulty: BookDifficulty;
  complexityScore: number;
  estimatedSeconds: number;
  priorityScore: number;
}

interface CardWithMetrics {
  card: BookPracticeCard;
  complexityScore: number;
  heuristicDifficulty: BookDifficulty;
  mistakeWeight: number;
}

interface MistakeSignal {
  bySectionTag: Map<string, number>;
  bySectionId: Map<string, number>;
  byDifficulty: Map<BookDifficulty, number>;
}

const difficultyOrder: BookDifficulty[] = ['level_1', 'level_2', 'level_3'];
const difficultyIndex: Record<BookDifficulty, number> = {
  level_1: 0,
  level_2: 1,
  level_3: 2,
};

export function getLearningTopics() {
  return getBookSections();
}

export function getCardPoolForSettings(settingsInput: Partial<LearningSettings>): BookPracticeCard[] {
  const settings = sanitizeLearningSettings(settingsInput);
  let cards = getCardsByMix(settings.cardMix, settings.includeGenerated);

  if (settings.mode === 'topic' && settings.topicId) {
    cards = cards.filter((card) => card.sectionId === settings.topicId);
  }

  return cards;
}
export function defaultLearningSettings(): LearningSettings {
  return {
    mode: 'sequential',
    cardMix: 'mixed',
    topicId: null,
    desiredDifficulty: 'adaptive',
    order: 'sequential',
    includeGenerated: true,
    timeMinutes: 20,
    exerciseCount: 25,
  };
}

export function sanitizeLearningSettings(input: Partial<LearningSettings>): LearningSettings {
  const defaults = defaultLearningSettings();

  const mode: LearningMode = ['sequential', 'random', 'topic', 'difficulty'].includes(input.mode ?? '')
    ? (input.mode as LearningMode)
    : defaults.mode;

  const cardMix: CardMix = ['mixed', 'word', 'sentence'].includes(input.cardMix ?? '')
    ? (input.cardMix as CardMix)
    : defaults.cardMix;

  const desiredDifficulty: DesiredDifficulty = ['adaptive', 'level_1', 'level_2', 'level_3'].includes(
    input.desiredDifficulty ?? ''
  )
    ? (input.desiredDifficulty as DesiredDifficulty)
    : defaults.desiredDifficulty;

  const order: ExerciseOrder = ['random', 'sequential'].includes(input.order ?? '')
    ? (input.order as ExerciseOrder)
    : defaults.order;

  return {
    mode,
    cardMix,
    topicId: input.topicId ?? null,
    desiredDifficulty,
    order,
    includeGenerated: input.includeGenerated ?? defaults.includeGenerated,
    timeMinutes: clampNumber(input.timeMinutes, 5, 120, defaults.timeMinutes),
    exerciseCount: clampNumber(input.exerciseCount, 5, 200, defaults.exerciseCount),
  };
}

export function buildLearningPlan(settingsInput: Partial<LearningSettings>, mistakes: Mistake[] = []): PlannedExercise[] {
  const settings = sanitizeLearningSettings(settingsInput);

  let cards = getCardsByMix(settings.cardMix, settings.includeGenerated);
  if (settings.mode === 'topic' && settings.topicId) {
    cards = cards.filter((card) => card.sectionId === settings.topicId);
  }

  if (cards.length === 0) {
    return [];
  }

  const mistakeSignal = buildMistakeSignal(mistakes);

  let scored = cards.map((card) => {
    const complexityScore = scoreCardComplexity(card);
    const heuristicDifficulty = difficultyFromScore(complexityScore);

    return {
      card,
      complexityScore,
      heuristicDifficulty,
      mistakeWeight: scoreMistakePressure(card, heuristicDifficulty, mistakeSignal),
    };
  });

  if (settings.desiredDifficulty !== 'adaptive') {
    scored = prioritizeDifficulty(scored, settings.desiredDifficulty, settings.exerciseCount);
  }

  scored = orderByMode(scored, settings);

  if (settings.order === 'random') {
    scored = shuffle(scored);
  } else if (settings.mode !== 'difficulty') {
    scored = [...scored].sort((a, b) => {
      if (a.card.sectionNumber !== b.card.sectionNumber) {
        return a.card.sectionNumber - b.card.sectionNumber;
      }

      if (a.card.type !== b.card.type) {
        return a.card.type === 'word' ? -1 : 1;
      }

      return a.card.id.localeCompare(b.card.id);
    });
  }

  const limitedByCount = scored.slice(0, settings.exerciseCount);

  const withinTime: CardWithMetrics[] = [];
  const maxSeconds = settings.timeMinutes * 60;
  let accumulatedSeconds = 0;

  for (const item of limitedByCount) {
    const resolvedDifficulty = resolveExerciseDifficulty(item.heuristicDifficulty, settings.desiredDifficulty);
    const estimate = estimateSeconds(resolvedDifficulty);

    if (withinTime.length > 0 && accumulatedSeconds + estimate > maxSeconds) {
      break;
    }

    withinTime.push(item);
    accumulatedSeconds += estimate;
  }

  const selected = withinTime.length > 0 ? withinTime : limitedByCount.slice(0, 1);

  return selected.map((item, index) => {
    const difficulty = resolveExerciseDifficulty(item.heuristicDifficulty, settings.desiredDifficulty);

    return {
      id: `plan-${index + 1}-${item.card.id}`,
      card: item.card,
      difficulty,
      heuristicDifficulty: item.heuristicDifficulty,
      complexityScore: item.complexityScore,
      estimatedSeconds: estimateSeconds(difficulty),
      priorityScore: item.mistakeWeight + item.complexityScore,
    };
  });
}

export function parseSettingsFromSearchParams(searchParams: URLSearchParams): LearningSettings {
  return sanitizeLearningSettings({
    mode: searchParams.get('mode') as LearningMode | undefined,
    cardMix: searchParams.get('mix') as CardMix | undefined,
    topicId: searchParams.get('topic'),
    desiredDifficulty: searchParams.get('difficulty') as DesiredDifficulty | undefined,
    order: searchParams.get('order') as ExerciseOrder | undefined,
    includeGenerated: searchParams.get('generated') !== 'false',
    timeMinutes: Number(searchParams.get('minutes') ?? ''),
    exerciseCount: Number(searchParams.get('count') ?? ''),
  });
}

export function toSearchParams(settingsInput: Partial<LearningSettings>): URLSearchParams {
  const settings = sanitizeLearningSettings(settingsInput);

  const params = new URLSearchParams();
  params.set('mode', settings.mode);
  params.set('mix', settings.cardMix);
  params.set('difficulty', settings.desiredDifficulty);
  params.set('order', settings.order);
  params.set('generated', String(settings.includeGenerated));
  params.set('minutes', String(settings.timeMinutes));
  params.set('count', String(settings.exerciseCount));

  if (settings.topicId) {
    params.set('topic', settings.topicId);
  }

  return params;
}

function getCardsByMix(cardMix: CardMix, includeGenerated: boolean): BookPracticeCard[] {
  if (cardMix === 'word') {
    return getBookPracticeCards({ cardType: 'word', includeGenerated });
  }

  if (cardMix === 'sentence') {
    return getBookPracticeCards({ cardType: 'sentence', includeGenerated });
  }

  const words = getBookPracticeCards({ cardType: 'word', includeGenerated });
  const sentences = getBookPracticeCards({ cardType: 'sentence', includeGenerated });

  return [...words, ...sentences];
}

function scoreCardComplexity(card: BookPracticeCard): number {
  if (card.type === 'word') {
    const polishWords = tokenize(card.polish).length;
    const polishLength = card.polish.length;
    const englishVariants = card.english.length;
    const phraseWeight = card.partOfSpeech.toLowerCase().includes('phrase') ? 0.15 : 0;

    const score = polishLength / 24 + polishWords * 0.18 + englishVariants * 0.06 + phraseWeight;
    return clamp01(score);
  }

  const promptWords = tokenize(card.promptEn).length;
  const answerWords = tokenize(card.answerPl).length;
  const punctuationWeight = /[,;:.!?]/.test(card.answerPl) ? 0.12 : 0;
  const grammarWeight = Math.min(card.grammarTags.length, 4) * 0.08;

  const score = answerWords / 14 + promptWords / 24 + punctuationWeight + grammarWeight;
  return clamp01(score);
}

function difficultyFromScore(score: number): BookDifficulty {
  if (score <= 0.38) {
    return 'level_1';
  }

  if (score <= 0.68) {
    return 'level_2';
  }

  return 'level_3';
}

function resolveExerciseDifficulty(heuristic: BookDifficulty, desired: DesiredDifficulty): BookDifficulty {
  return desired === 'adaptive' ? heuristic : desired;
}

function estimateSeconds(difficulty: BookDifficulty): number {
  if (difficulty === 'level_1') {
    return 35;
  }

  if (difficulty === 'level_2') {
    return 50;
  }

  return 65;
}

function buildMistakeSignal(mistakes: Mistake[]): MistakeSignal {
  const bySectionTag = new Map<string, number>();
  const bySectionId = new Map<string, number>();
  const byDifficulty = new Map<BookDifficulty, number>();

  const sorted = [...mistakes].sort((a, b) => b.timestamp - a.timestamp).slice(0, 200);
  const max = Math.max(1, sorted.length - 1);

  sorted.forEach((mistake, index) => {
    const recency = 1 - index / max;
    const weight = 0.3 + recency * 0.7;

    if (mistake.topicId) {
      bySectionId.set(mistake.topicId, (bySectionId.get(mistake.topicId) ?? 0) + weight);
    }

    for (const tag of mistake.tags) {
      if (tag.type === 'topic') {
        if (tag.value.startsWith('section-')) {
          bySectionTag.set(tag.value, (bySectionTag.get(tag.value) ?? 0) + weight);
        } else {
          bySectionId.set(tag.value, (bySectionId.get(tag.value) ?? 0) + weight);
        }
      }

      if (tag.type === 'difficulty' && isBookDifficulty(tag.value)) {
        const difficulty = tag.value;
        byDifficulty.set(difficulty, (byDifficulty.get(difficulty) ?? 0) + weight);
      }
    }
  });

  return { bySectionTag, bySectionId, byDifficulty };
}

function scoreMistakePressure(card: BookPracticeCard, difficulty: BookDifficulty, signal: MistakeSignal): number {
  const sectionTag = `section-${card.sectionNumber}`;
  const sectionTagWeight = signal.bySectionTag.get(sectionTag) ?? 0;
  const sectionIdWeight = signal.bySectionId.get(card.sectionId) ?? 0;
  const difficultyWeight = signal.byDifficulty.get(difficulty) ?? 0;

  return sectionTagWeight + sectionIdWeight + difficultyWeight;
}

function prioritizeDifficulty(
  cards: CardWithMetrics[],
  desired: BookDifficulty,
  wantedCount: number
): CardWithMetrics[] {
  const exact = cards.filter((item) => item.heuristicDifficulty === desired);
  if (exact.length >= wantedCount) {
    return exact;
  }

  const fallback = cards
    .filter((item) => item.heuristicDifficulty !== desired)
    .sort((a, b) => {
      const aDistance = Math.abs(difficultyIndex[a.heuristicDifficulty] - difficultyIndex[desired]);
      const bDistance = Math.abs(difficultyIndex[b.heuristicDifficulty] - difficultyIndex[desired]);

      if (aDistance !== bDistance) {
        return aDistance - bDistance;
      }

      return b.complexityScore - a.complexityScore;
    });

  return [...exact, ...fallback];
}

function orderByMode(cards: CardWithMetrics[], settings: LearningSettings): CardWithMetrics[] {
  if (settings.mode === 'random') {
    return shuffle(cards);
  }

  if (settings.mode === 'difficulty') {
    return [...cards].sort((a, b) => {
      let targetBonusA = 0;
      let targetBonusB = 0;

      if (settings.desiredDifficulty !== 'adaptive') {
        const targetIndex = difficultyIndex[settings.desiredDifficulty];
        targetBonusA = 1 - Math.abs(difficultyIndex[a.heuristicDifficulty] - targetIndex) * 0.35;
        targetBonusB = 1 - Math.abs(difficultyIndex[b.heuristicDifficulty] - targetIndex) * 0.35;
      }

      const scoreA = a.mistakeWeight * 1.8 + targetBonusA + a.complexityScore * 0.35;
      const scoreB = b.mistakeWeight * 1.8 + targetBonusB + b.complexityScore * 0.35;

      return scoreB - scoreA;
    });
  }

  if (settings.mode === 'topic' && settings.topicId) {
    return [...cards].sort((a, b) => {
      if (a.card.sectionNumber !== b.card.sectionNumber) {
        return a.card.sectionNumber - b.card.sectionNumber;
      }

      return a.card.id.localeCompare(b.card.id);
    });
  }

  return [...cards].sort((a, b) => {
    if (a.card.sectionNumber !== b.card.sectionNumber) {
      return a.card.sectionNumber - b.card.sectionNumber;
    }

    if (a.card.type !== b.card.type) {
      return a.card.type === 'word' ? -1 : 1;
    }

    const aDiff = difficultyOrder.indexOf(a.heuristicDifficulty);
    const bDiff = difficultyOrder.indexOf(b.heuristicDifficulty);

    if (aDiff !== bDiff) {
      return aDiff - bDiff;
    }

    return a.card.id.localeCompare(b.card.id);
  });
}

function isBookDifficulty(value: string): value is BookDifficulty {
  return value === 'level_1' || value === 'level_2' || value === 'level_3';
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}



