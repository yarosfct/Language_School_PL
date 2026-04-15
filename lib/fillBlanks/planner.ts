import type { CurationToken } from '@/types/curation';
import type {
  FillBlankEvaluationResult,
  FillBlankFavorite,
  FillBlankPoolTarget,
  FillBlankPracticeMode,
  FillBlankPracticeUnit,
  FillBlankSentenceStats,
  FillBlankWordStats,
  PooledFillBlankExercise,
} from '@/types/fillBlanks';
import { levenshteinDistance, removeDiacritics } from '@/lib/utils/string';

const COMMON_EASY_TERMS = new Set([
  'a',
  'ale',
  'bo',
  'być',
  'co',
  'czy',
  'dla',
  'do',
  'gdzie',
  'i',
  'ja',
  'jak',
  'jest',
  'już',
  'kiedy',
  'kto',
  'lub',
  'ma',
  'mam',
  'masz',
  'mieć',
  'my',
  'na',
  'nie',
  'o',
  'on',
  'ona',
  'one',
  'oni',
  'oraz',
  'po',
  'proszę',
  'są',
  'tak',
  'tam',
  'też',
  'to',
  'tu',
  'ty',
  'w',
  'wy',
  'z',
]);

const EASY_PARTS_OF_SPEECH = ['conjunction', 'particle', 'preposition', 'pronoun', 'question'];
const HARDER_PARTS_OF_SPEECH = ['adjective', 'noun', 'verb'];
const DIFFICULTY_TIE_BREAKER: Record<string, number> = {
  A1: 0,
  A2: 6,
  B1: 14,
  B2: 22,
};

export function buildFillBlankPracticeUnits(
  exercises: PooledFillBlankExercise[],
  options: {
    wordStats?: FillBlankWordStats[];
    sentenceStats?: FillBlankSentenceStats[];
    favorites?: FillBlankFavorite[];
    poolTargets?: FillBlankPoolTarget[];
  } = {}
): FillBlankPracticeUnit[] {
  const frequency = buildTokenFrequency(exercises);
  const wordStatsByKey = indexBy(options.wordStats ?? [], (stat) => stat.key);
  const sentenceStatsById = indexBy(options.sentenceStats ?? [], (stat) => stat.id);
  const favorites = options.favorites ?? [];
  const poolTargets = options.poolTargets ?? [];
  const difficultyLimit = determineDifficultyLimit(exercises, wordStatsByKey, frequency);
  const units: FillBlankPracticeUnit[] = [];

  for (const exercise of exercises) {
    const blankableTokens = getBlankablePolishTokens(exercise);
    if (blankableTokens.length === 0) {
      continue;
    }

    for (const token of blankableTokens) {
      units.push(
        createUnit({
          exercise,
          mode: 'easy',
          blankTokens: [token],
          targetTokens: [token],
          frequency,
          wordStatsByKey,
          sentenceStatsById,
          favorites,
          poolTargets,
          difficultyLimit,
        })
      );
    }

    if (blankableTokens.length > 1) {
      units.push(
        createUnit({
          exercise,
          mode: 'medium',
          blankTokens: blankableTokens,
          targetTokens: blankableTokens,
          frequency,
          wordStatsByKey,
          sentenceStatsById,
          favorites,
          poolTargets,
          difficultyLimit,
        })
      );
    }

    units.push(
      createUnit({
        exercise,
        mode: 'hard',
        blankTokens: exercise.polishTokens,
        targetTokens: exercise.polishTokens,
        frequency,
        wordStatsByKey,
        sentenceStatsById,
        favorites,
        poolTargets,
        difficultyLimit,
      })
    );
  }

  return units;
}

export function planFillBlankBatch(
  exercises: PooledFillBlankExercise[],
  options: {
    batchSize: number;
    wordStats?: FillBlankWordStats[];
    sentenceStats?: FillBlankSentenceStats[];
    favorites?: FillBlankFavorite[];
    poolTargets?: FillBlankPoolTarget[];
  }
): FillBlankPracticeUnit[] {
  const units = buildFillBlankPracticeUnits(exercises, options);
  const activePoolTargets = (options.poolTargets ?? []).filter((target) => target.active);
  const sorted = units
    .filter((unit) => isUnitEligible(unit, activePoolTargets))
    .sort(compareUnits);
  const selected: FillBlankPracticeUnit[] = [];
  const usedSentences = new Set<string>();

  for (const unit of sorted) {
    const sentenceKey = sentenceStatId(unit.poolSource, unit.exerciseId);
    if (usedSentences.has(sentenceKey)) {
      continue;
    }

    selected.push(unit);
    usedSentences.add(sentenceKey);

    if (selected.length >= options.batchSize) {
      return selected;
    }
  }

  for (const unit of sorted) {
    if (selected.some((candidate) => candidate.id === unit.id)) {
      continue;
    }

    selected.push(unit);

    if (selected.length >= options.batchSize) {
      return selected;
    }
  }

  return selected;
}

export function evaluateFillBlankPracticeAnswer(
  unit: FillBlankPracticeUnit,
  answers: string[]
): FillBlankEvaluationResult {
  if (unit.mode === 'hard') {
    return evaluateSingleAnswer(answers[0] ?? '', unit.pl);
  }

  if (answers.length !== unit.targetTexts.length) {
    return {
      kind: 'wrong',
      message: 'Fill every blank before submitting.',
      errorType: 'wrong',
    };
  }

  const results = unit.targetTexts.map((target, index) => evaluateSingleAnswer(answers[index] ?? '', target));
  const wrong = results.find((result) => result.kind === 'wrong');
  if (wrong) {
    return wrong;
  }

  const warning = results.find((result) => result.kind === 'warning');
  if (warning) {
    return warning;
  }

  return {
    kind: 'correct',
    message: 'Correct.',
  };
}

export function tokenPracticeKey(token: CurationToken): string {
  return normalizePracticeText(token.lemma || token.normalized || token.text);
}

export function normalizePracticeText(value: string): string {
  return value
    .toLocaleLowerCase('pl-PL')
    .replace(/[“”‘’"'.,!?;:()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sentenceStatId(poolSource: string, exerciseId: string): string {
  return `${poolSource}:${exerciseId}`;
}

export function isWordMastered(stat: FillBlankWordStats | undefined): boolean {
  if (!stat || stat.attempts < 3) {
    return false;
  }

  return stat.correct / stat.attempts >= 0.8 && stat.hintsUsed / stat.attempts <= 0.5 && stat.streakWrong === 0;
}

export function calculateMasteryScore(input: {
  attempts: number;
  correct: number;
  failures: number;
  warnings: number;
  hintsUsed: number;
}): number {
  if (input.attempts <= 0) {
    return 0;
  }

  const successRate = input.correct / input.attempts;
  const hintPenalty = Math.min(0.35, input.hintsUsed / input.attempts / 3);
  const warningPenalty = Math.min(0.2, input.warnings / input.attempts / 3);
  const failurePenalty = Math.min(0.35, input.failures / input.attempts / 2);
  return clamp(Math.round((successRate - hintPenalty - warningPenalty - failurePenalty) * 100), 0, 100);
}

export function nextDueAt(input: {
  correct: boolean;
  failed: boolean;
  learned: boolean;
  hintsUsed: number;
  warnings: number;
  streakCorrect: number;
  now: number;
}): number {
  if (input.failed || input.learned || !input.correct) {
    return input.now + 5 * 60 * 1000;
  }

  if (input.hintsUsed > 0 || input.warnings > 0) {
    return input.now + 12 * 60 * 60 * 1000;
  }

  const days = Math.min(7, Math.max(1, input.streakCorrect));
  return input.now + days * 24 * 60 * 60 * 1000;
}

export function getBlankablePolishTokens(exercise: PooledFillBlankExercise): CurationToken[] {
  const selected = new Set(exercise.blankablePolishTokenIds);
  return exercise.polishTokens
    .filter((token) => selected.has(token.id))
    .sort((left, right) => left.index - right.index);
}

function createUnit(input: {
  exercise: PooledFillBlankExercise;
  mode: FillBlankPracticeMode;
  blankTokens: CurationToken[];
  targetTokens: CurationToken[];
  frequency: Map<string, number>;
  wordStatsByKey: Map<string, FillBlankWordStats>;
  sentenceStatsById: Map<string, FillBlankSentenceStats>;
  favorites: FillBlankFavorite[];
  poolTargets: FillBlankPoolTarget[];
  difficultyLimit: number;
}): FillBlankPracticeUnit {
  const targetKeys = unique(input.targetTokens.map(tokenPracticeKey).filter(Boolean));
  const targetTexts = input.mode === 'hard' ? [input.exercise.pl] : input.targetTokens.map((token) => token.text);
  const baseDifficulty = calculateUnitDifficulty(input.exercise, input.targetTokens, input.frequency, input.mode);
  const priority = calculatePriority({
    ...input,
    targetKeys,
    baseDifficulty,
  });
  const blankKey = input.mode === 'hard' ? 'sentence' : input.blankTokens.map((token) => token.id).join('-');

  return {
    id: `${input.exercise.poolSource}:${input.exercise.id}:${input.mode}:${blankKey}`,
    poolSource: input.exercise.poolSource,
    exerciseId: input.exercise.id,
    mode: input.mode,
    pl: input.exercise.pl,
    en: input.exercise.en,
    category: input.exercise.category,
    difficulty: input.exercise.difficulty,
    sentenceType: input.exercise.sentenceType,
    blankTokenIds: input.blankTokens.map((token) => token.id),
    targetTokenIds: input.targetTokens.map((token) => token.id),
    targetKeys,
    targetTexts,
    baseDifficulty,
    priority,
    exercise: input.exercise,
  };
}

function calculateUnitDifficulty(
  exercise: PooledFillBlankExercise,
  targetTokens: CurationToken[],
  frequency: Map<string, number>,
  mode: FillBlankPracticeMode
): number {
  const tokenScores = targetTokens.map((token) => calculateTokenDifficulty(token, exercise, frequency));
  const average = tokenScores.reduce((sum, score) => sum + score, 0) / Math.max(tokenScores.length, 1);
  const modePenalty = mode === 'hard' ? 28 : mode === 'medium' ? 12 : 0;
  return clamp(Math.round(average + modePenalty), 1, 100);
}

function calculateTokenDifficulty(
  token: CurationToken,
  exercise: PooledFillBlankExercise,
  frequency: Map<string, number>
): number {
  const key = tokenPracticeKey(token);
  const normalized = normalizePracticeText(token.normalized || token.text);
  const plain = removeDiacritics(normalized);
  const lengthScore = plain.length * 6;
  const frequencyBoost = Math.min(20, (frequency.get(key) ?? 0) * 3);
  const commonBoost = COMMON_EASY_TERMS.has(key) || COMMON_EASY_TERMS.has(normalized) ? 28 : 0;
  const partOfSpeech = (token.partOfSpeech ?? '').toLocaleLowerCase('en-US');
  const easyPartBoost = EASY_PARTS_OF_SPEECH.some((part) => partOfSpeech.includes(part)) ? 14 : 0;
  const hardPartPenalty = HARDER_PARTS_OF_SPEECH.some((part) => partOfSpeech.includes(part)) ? 10 : 0;
  const diacriticPenalty = plain !== normalized ? 8 : 0;
  const sentencePenalty = Math.min(18, exercise.polishTokens.length * 1.5);
  const sourceTieBreaker = DIFFICULTY_TIE_BREAKER[exercise.difficulty] ?? 10;

  return clamp(
    Math.round(lengthScore + hardPartPenalty + diacriticPenalty + sentencePenalty + sourceTieBreaker - frequencyBoost - commonBoost - easyPartBoost),
    1,
    100
  );
}

function calculatePriority(input: {
  exercise: PooledFillBlankExercise;
  mode: FillBlankPracticeMode;
  targetKeys: string[];
  baseDifficulty: number;
  wordStatsByKey: Map<string, FillBlankWordStats>;
  sentenceStatsById: Map<string, FillBlankSentenceStats>;
  favorites: FillBlankFavorite[];
  poolTargets: FillBlankPoolTarget[];
  difficultyLimit: number;
}): number {
  const now = Date.now();
  const sentenceId = sentenceStatId(input.exercise.poolSource, input.exercise.id);
  const sentenceStats = input.sentenceStatsById.get(sentenceId);
  const wordStats = input.targetKeys.map((key) => input.wordStatsByKey.get(key));
  const hasFavoriteWord = hasMatchingWordFavorite(input.exercise, input.targetKeys, input.favorites);
  const hasFavoriteSentence = input.favorites.some(
    (favorite) => favorite.kind === 'sentence' && favorite.exerciseId === input.exercise.id && favorite.poolSource === input.exercise.poolSource
  );
  const hasPoolTarget = hasMatchingPoolTarget(input.exercise, input.targetKeys, input.poolTargets);
  const hasDueWord = wordStats.some((stat) => stat && (stat.dueAt ?? 0) <= now);
  const hasFailurePressure = wordStats.some((stat) => stat && (stat.streakWrong > 0 || stat.failures > 0));
  const averageMastery =
    wordStats.reduce((sum, stat) => sum + (stat?.mastery ?? 0), 0) / Math.max(wordStats.length, 1);
  const componentAttemptCount = wordStats.reduce((sum, stat) => sum + (stat?.attempts ?? 0), 0);
  const mastered = input.targetKeys.every((key) => isWordMastered(input.wordStatsByKey.get(key)));
  let priority = input.baseDifficulty;

  if (input.baseDifficulty > input.difficultyLimit && !hasPoolTarget && !hasFavoriteWord && !hasFavoriteSentence && !hasFailurePressure) {
    priority += 80;
  }

  if (mastered) {
    priority += 55;
  }

  if (hasDueWord) {
    priority -= 18;
  }

  if (hasFailurePressure) {
    priority -= 24;
  }

  if (hasFavoriteWord) {
    priority -= 34;
  }

  if (hasFavoriteSentence) {
    priority -= 26;
  }

  if (hasPoolTarget) {
    priority -= 50;
  }

  if (input.mode === 'medium' && componentAttemptCount < input.targetKeys.length) {
    priority += 28;
  }

  if (input.mode === 'hard' && averageMastery < 55 && !hasFavoriteSentence) {
    priority += 44;
  }

  if (sentenceStats?.dueAt && sentenceStats.dueAt <= now) {
    priority -= 8;
  }

  if (sentenceStats?.lastAttemptAt) {
    priority += Math.max(0, 14 - Math.floor((now - sentenceStats.lastAttemptAt) / (60 * 60 * 1000)));
  }

  return priority + hashTieBreaker(`${input.exercise.poolSource}:${input.exercise.id}:${input.mode}`) / 100;
}

function determineDifficultyLimit(
  exercises: PooledFillBlankExercise[],
  wordStatsByKey: Map<string, FillBlankWordStats>,
  frequency: Map<string, number>
): number {
  const uniqueScores = new Map<string, number>();

  for (const exercise of exercises) {
    for (const token of getBlankablePolishTokens(exercise)) {
      const key = tokenPracticeKey(token);
      if (!uniqueScores.has(key)) {
        uniqueScores.set(key, calculateTokenDifficulty(token, exercise, frequency));
      }
    }
  }

  const easyKeys = [...uniqueScores.entries()].filter(([, score]) => score <= 45);
  const mediumKeys = [...uniqueScores.entries()].filter(([, score]) => score > 45 && score <= 65);
  const hardKeys = [...uniqueScores.entries()].filter(([, score]) => score > 65 && score <= 82);
  const easyMastery = ratio(easyKeys.filter(([key]) => isWordMastered(wordStatsByKey.get(key))).length, easyKeys.length);
  const mediumMastery = ratio(mediumKeys.filter(([key]) => isWordMastered(wordStatsByKey.get(key))).length, mediumKeys.length);
  const hardMastery = ratio(hardKeys.filter(([key]) => isWordMastered(wordStatsByKey.get(key))).length, hardKeys.length);

  if (hardMastery >= 0.6) {
    return 100;
  }

  if (mediumMastery >= 0.65) {
    return 82;
  }

  if (easyMastery >= 0.7 || easyKeys.length === 0) {
    return 65;
  }

  return 45;
}

function isUnitEligible(unit: FillBlankPracticeUnit, poolTargets: FillBlankPoolTarget[]): boolean {
  if (poolTargets.some((target) => target.active && exerciseMatchesTarget(unit.exercise, unit.targetKeys, target))) {
    return true;
  }

  return unit.priority < 135;
}

function compareUnits(left: FillBlankPracticeUnit, right: FillBlankPracticeUnit): number {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  if (left.baseDifficulty !== right.baseDifficulty) {
    return left.baseDifficulty - right.baseDifficulty;
  }

  return left.id.localeCompare(right.id);
}

function evaluateSingleAnswer(rawAnswer: string, rawTarget: string): FillBlankEvaluationResult {
  const answer = normalizeForEvaluation(rawAnswer);
  const target = normalizeForEvaluation(rawTarget);

  if (!answer) {
    return {
      kind: 'wrong',
      message: 'Type an answer, or use Learn to reveal it.',
      errorType: 'wrong',
    };
  }

  if (answer === target) {
    return {
      kind: 'correct',
      message: 'Correct.',
    };
  }

  if (removeDiacritics(answer) === removeDiacritics(target)) {
    return {
      kind: 'warning',
      message: 'Almost. The letters are right, but the Polish diacritics need attention.',
      errorType: 'diacritics',
      distance: 0,
    };
  }

  const distance = levenshteinDistance(removeDiacritics(answer), removeDiacritics(target));
  const threshold = typoThreshold(target);
  if (distance <= threshold) {
    return {
      kind: 'warning',
      message: `Close. You are ${distance} character${distance === 1 ? '' : 's'} off.`,
      errorType: 'spelling',
      distance,
    };
  }

  return {
    kind: 'wrong',
    message: `Not quite. You are ${distance} character${distance === 1 ? '' : 's'} off.`,
    errorType: 'wrong',
    distance,
  };
}

function normalizeForEvaluation(value: string): string {
  return normalizePracticeText(value).replace(/[^\p{L}\p{N}\s]/gu, '');
}

function typoThreshold(target: string): number {
  const compact = target.replace(/\s+/g, '');
  if (compact.length <= 3) {
    return 0;
  }

  if (compact.length <= 10) {
    return 1;
  }

  return 2;
}

function hasMatchingWordFavorite(
  exercise: PooledFillBlankExercise,
  targetKeys: string[],
  favorites: FillBlankFavorite[]
): boolean {
  return favorites.some((favorite) => {
    if (favorite.kind !== 'word' || !favorite.targetKey) {
      return false;
    }

    if (favorite.language === 'en') {
      return exercise.englishTokens.some((token) => normalizePracticeText(token.normalized || token.text) === favorite.targetKey);
    }

    return targetKeys.includes(favorite.targetKey);
  });
}

function hasMatchingPoolTarget(
  exercise: PooledFillBlankExercise,
  targetKeys: string[],
  poolTargets: FillBlankPoolTarget[]
): boolean {
  return poolTargets.some((target) => target.active && exerciseMatchesTarget(exercise, targetKeys, target));
}

function exerciseMatchesTarget(
  exercise: PooledFillBlankExercise,
  targetKeys: string[],
  target: FillBlankPoolTarget
): boolean {
  if (target.language === 'pl') {
    return (
      targetKeys.includes(target.targetKey) ||
      exercise.polishTokens.some((token) => tokenPracticeKey(token) === target.targetKey || normalizePracticeText(token.normalized) === target.normalized)
    );
  }

  return (
    exercise.englishTokens.some((token) => normalizePracticeText(token.normalized || token.text) === target.normalized) ||
    exercise.polishTokens.some((token) => normalizePracticeText(token.translation).includes(target.normalized))
  );
}

function buildTokenFrequency(exercises: PooledFillBlankExercise[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const exercise of exercises) {
    for (const token of getBlankablePolishTokens(exercise)) {
      const key = tokenPracticeKey(token);
      frequency.set(key, (frequency.get(key) ?? 0) + 1);
    }
  }

  return frequency;
}

function indexBy<T>(items: T[], getter: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>();

  for (const item of items) {
    map.set(getter(item), item);
  }

  return map;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function ratio(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashTieBreaker(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 997;
  }

  return hash;
}
