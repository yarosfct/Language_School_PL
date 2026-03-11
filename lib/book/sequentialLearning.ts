import {
  type BookDifficulty,
  type BookSentenceCard,
  getBookPracticeCards,
  getBookSections,
} from '@/lib/book/flashcards';
import type { AttemptWithId } from '@/lib/db';
import type { Mistake } from '@/types/progress';

export const DIFFICULTY_SEQUENCE: BookDifficulty[] = ['level_1', 'level_2', 'level_3'];

interface SectionMistakeStat {
  sectionId: string;
  sectionLabel: string;
  count: number;
}

interface ExerciseMistakeStat {
  exerciseId: string;
  count: number;
}

const sentencePool = getBookPracticeCards({ cardType: 'sentence', includeGenerated: false }).filter(
  isSentenceCard
);
const sequentialSections = [...getBookSections()].sort((a, b) => a.sectionNumber - b.sectionNumber);
const sentenceCardsBySection = buildSentenceCardsBySection(sentencePool);

export function getSequentialSections() {
  return sequentialSections;
}

export function getSectionCards(sectionId: string): BookSentenceCard[] {
  return sentenceCardsBySection.get(sectionId) ?? [];
}

export function getSectionMastery(
  sectionId: string,
  difficulty: BookDifficulty,
  attempts: AttemptWithId[]
): {
  total: number;
  mastered: number;
  pendingCards: BookSentenceCard[];
} {
  const cards = getSectionCards(sectionId);
  const masteredExerciseIds = new Set(
    attempts.filter((attempt) => attempt.correct).map((attempt) => attempt.exerciseId)
  );

  const pendingCards: BookSentenceCard[] = [];

  for (const card of cards) {
    const exerciseId = buildSentenceExerciseId(card.id, difficulty);

    if (!masteredExerciseIds.has(exerciseId)) {
      pendingCards.push(card);
    }
  }

  return {
    total: cards.length,
    mastered: cards.length - pendingCards.length,
    pendingCards,
  };
}

export function getOverallMastery(
  difficulty: BookDifficulty,
  attempts: AttemptWithId[]
): {
  total: number;
  mastered: number;
  masteredSections: number;
  totalSections: number;
} {
  const sections = getSequentialSections();
  const masteredExerciseIds = new Set(
    attempts
      .filter((attempt) => attempt.correct && extractDifficultyFromExerciseId(attempt.exerciseId) === difficulty)
      .map((attempt) => attempt.exerciseId)
  );

  let total = 0;
  let mastered = 0;
  let masteredSections = 0;

  for (const section of sections) {
    const cards = getSectionCards(section.id);
    let sectionMastered = 0;

    for (const card of cards) {
      if (masteredExerciseIds.has(buildSentenceExerciseId(card.id, difficulty))) {
        sectionMastered += 1;
      }
    }

    total += cards.length;
    mastered += sectionMastered;

    if (cards.length === 0 || sectionMastered === cards.length) {
      masteredSections += 1;
    }
  }

  return {
    total,
    mastered,
    masteredSections,
    totalSections: sections.length,
  };
}

export function getDifficultySuccessRate(difficulty: BookDifficulty, attempts: AttemptWithId[]): number {
  const filtered = attempts.filter((attempt) => extractDifficultyFromExerciseId(attempt.exerciseId) === difficulty);

  if (filtered.length === 0) {
    return 0;
  }

  const correctCount = filtered.filter((attempt) => attempt.correct).length;
  return Math.round((correctCount / filtered.length) * 100);
}

export function getLatestMistakes(mistakes: Mistake[], limit = 5): Mistake[] {
  return [...mistakes].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

export function getHardestSections(mistakes: Mistake[], limit = 5): SectionMistakeStat[] {
  const sectionMap = new Map<string, number>();

  for (const mistake of mistakes) {
    if (!mistake.topicId) {
      continue;
    }

    sectionMap.set(mistake.topicId, (sectionMap.get(mistake.topicId) ?? 0) + 1);
  }

  const sectionsById = new Map(getSequentialSections().map((section) => [section.id, section]));

  return [...sectionMap.entries()]
    .map(([sectionId, count]) => {
      const section = sectionsById.get(sectionId);
      return {
        sectionId,
        sectionLabel: section ? section.label : sectionId,
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getHardestExercises(mistakes: Mistake[], limit = 5): ExerciseMistakeStat[] {
  const exerciseMap = new Map<string, number>();

  for (const mistake of mistakes) {
    exerciseMap.set(mistake.exerciseId, (exerciseMap.get(mistake.exerciseId) ?? 0) + 1);
  }

  return [...exerciseMap.entries()]
    .map(([exerciseId, count]) => ({ exerciseId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getNextSectionId(currentSectionId: string | null): string | null {
  const sections = getSequentialSections();

  if (!currentSectionId) {
    return sections[0]?.id ?? null;
  }

  const index = sections.findIndex((section) => section.id === currentSectionId);
  if (index === -1 || index >= sections.length - 1) {
    return null;
  }

  return sections[index + 1].id;
}

export function getNextDifficulty(currentDifficulty: BookDifficulty): BookDifficulty | null {
  const index = DIFFICULTY_SEQUENCE.indexOf(currentDifficulty);
  if (index === -1 || index >= DIFFICULTY_SEQUENCE.length - 1) {
    return null;
  }

  return DIFFICULTY_SEQUENCE[index + 1];
}

export function extractDifficultyFromExerciseId(exerciseId: string): BookDifficulty | null {
  const match = exerciseId.match(/(level_[123])$/);
  if (!match) {
    return null;
  }

  const difficulty = match[1];
  if (difficulty === 'level_1' || difficulty === 'level_2' || difficulty === 'level_3') {
    return difficulty;
  }

  return null;
}

function extractNumericSuffix(value: string): number {
  const match = value.match(/-(\d+)$/);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(match[1]);
}

function buildSentenceExerciseId(cardId: string, difficulty: BookDifficulty): string {
  return `book-sentence-${cardId}-${difficulty}`;
}

function buildSentenceCardsBySection(cards: BookSentenceCard[]): Map<string, BookSentenceCard[]> {
  const bySection = new Map<string, BookSentenceCard[]>();

  for (const card of cards) {
    const sectionCards = bySection.get(card.sectionId);
    if (sectionCards) {
      sectionCards.push(card);
    } else {
      bySection.set(card.sectionId, [card]);
    }
  }

  for (const sectionCards of bySection.values()) {
    sectionCards.sort((a, b) => {
      const aIndex = extractNumericSuffix(a.id);
      const bIndex = extractNumericSuffix(b.id);
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      return a.id.localeCompare(b.id);
    });
  }

  return bySection;
}

function isSentenceCard(card: unknown): card is BookSentenceCard {
  return typeof card === 'object' && card !== null && (card as { type?: string }).type === 'sentence';
}
