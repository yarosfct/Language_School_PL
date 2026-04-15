import { promises as fs } from 'fs';
import path from 'path';
import type { HandpickedExercise } from '@/types/curation';
import type { FillBlankPoolResponse, FillBlankPoolSource, PooledFillBlankExercise } from '@/types/fillBlanks';

const root = process.cwd();

export const FILL_BLANK_PATHS = {
  handpicked: path.join(root, 'content/curated_exercises/handpicked_exercises.json'),
  ai_picked: path.join(root, 'content/curated_exercises/AI_picked_exercises.json'),
} satisfies Record<FillBlankPoolSource, string>;

export async function readFillBlankPool(): Promise<FillBlankPoolResponse> {
  const [handpicked, aiPicked] = await Promise.all([
    readExerciseArray(FILL_BLANK_PATHS.handpicked, 'handpicked'),
    readExerciseArray(FILL_BLANK_PATHS.ai_picked, 'ai_picked'),
  ]);
  const exercises = [...handpicked, ...aiPicked];

  return {
    exercises,
    stats: {
      total: exercises.length,
      handpicked: handpicked.length,
      aiPicked: aiPicked.length,
      categories: countBy(exercises, (exercise) => exercise.category),
      difficulties: countBy(exercises, (exercise) => exercise.difficulty),
    },
  };
}

async function readExerciseArray(filePath: string, source: FillBlankPoolSource): Promise<PooledFillBlankExercise[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error(`${path.relative(root, filePath)} must contain a top-level array.`);
    }

    return (parsed as HandpickedExercise[]).map((exercise) => ({
      ...exercise,
      poolSource: source,
      poolId: `${source}:${exercise.id}`,
    }));
  } catch (error) {
    if (isFileNotFound(error) && source === 'ai_picked') {
      return [];
    }

    throw error;
  }
}

function countBy<T>(items: T[], getter: (item: T) => string | undefined): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of items) {
    const key = getter(item) || 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
