import { promises as fs } from 'fs';
import path from 'path';
import type {
  CuratedSourceExercise,
  CurationSource,
  HandpickedExercise,
} from '@/types/curation';

const root = process.cwd();

export const CURATION_PATHS = {
  book_exercises: path.join(root, 'content/curated_exercises/exercises.json'),
  sentence_candidates: path.join(root, 'content/curated_exercises/sentence_candidates.json'),
  handpicked: path.join(root, 'content/curated_exercises/handpicked_exercises.json'),
} satisfies Record<CurationSource | 'handpicked', string>;

export const CURATION_SOURCES = ['book_exercises', 'sentence_candidates'] as const satisfies CurationSource[];

export function parseCurationSource(value: unknown): CurationSource {
  return value === 'sentence_candidates' ? 'sentence_candidates' : 'book_exercises';
}

export function assertCurationWritesAllowed(): void {
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  if (process.env.ENABLE_CURATION_WRITES === 'true') {
    return;
  }

  throw new Error('Curation writes are disabled outside development. Set ENABLE_CURATION_WRITES=true to enable them.');
}

export async function readSourceExercises(source: CurationSource): Promise<CuratedSourceExercise[]> {
  return readJsonArray<CuratedSourceExercise>(CURATION_PATHS[source]);
}

export async function writeSourceExercises(
  source: CurationSource,
  items: CuratedSourceExercise[]
): Promise<void> {
  await writeJsonAtomic(CURATION_PATHS[source], items);
}

export async function readHandpickedExercises(): Promise<HandpickedExercise[]> {
  try {
    return await readJsonArray<HandpickedExercise>(CURATION_PATHS.handpicked);
  } catch (error) {
    if (isFileNotFound(error)) {
      return [];
    }

    throw error;
  }
}

export async function writeHandpickedExercises(items: HandpickedExercise[]): Promise<void> {
  await writeJsonAtomic(CURATION_PATHS.handpicked, items);
}

export async function updateSourceHandpickedFlag(
  source: CurationSource,
  sourceId: string,
  handpicked: boolean
): Promise<CuratedSourceExercise> {
  const sourceItems = await readSourceExercises(source);
  const index = sourceItems.findIndex((item) => item.id === sourceId);

  if (index === -1) {
    throw new Error(`Source item not found: ${source}:${sourceId}`);
  }

  const updated = {
    ...sourceItems[index],
    handpicked,
  };

  sourceItems[index] = updated;
  await writeSourceExercises(source, sourceItems);
  return updated;
}

export function handpickedIdFor(source: CurationSource, sourceId: string): string {
  if (source === 'book_exercises') {
    return `handpicked-${sourceId}`;
  }

  return `handpicked-${sourceId}`;
}

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  const content = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`${path.relative(root, filePath)} must contain a top-level array.`);
  }

  return parsed as T[];
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(tempPath, filePath);
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
