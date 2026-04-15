import type {
  CuratedSourceExercise,
  CurationSource,
  HandpickedExercise,
} from '@/types/curation';
import {
  assertCurationWritesAllowed,
  handpickedIdFor,
  readHandpickedExercises,
  readSourceExercises,
  updateSourceHandpickedFlag,
  writeHandpickedExercises,
} from '@/lib/curation/files';
import { finalExerciseMatches } from '@/lib/curation/build';

export async function getSourceExercise(
  source: CurationSource,
  sourceId: string
): Promise<CuratedSourceExercise> {
  const items = await readSourceExercises(source);
  const item = items.find((entry) => entry.id === sourceId);

  if (!item) {
    throw new Error(`Source item not found: ${source}:${sourceId}`);
  }

  return item;
}

export async function getHandpickedExercise(
  source: CurationSource,
  sourceId: string
): Promise<HandpickedExercise | undefined> {
  const finalExercises = await readHandpickedExercises();
  return finalExercises.find((exercise) => finalExerciseMatches(exercise, source, sourceId));
}

export async function upsertHandpickedExercise(
  exercise: HandpickedExercise
): Promise<HandpickedExercise> {
  assertCurationWritesAllowed();

  const finalExercises = await readHandpickedExercises();
  const existingIndex = finalExercises.findIndex((item) => item.id === exercise.id);

  if (existingIndex === -1) {
    finalExercises.push(exercise);
  } else {
    finalExercises[existingIndex] = exercise;
  }

  await writeHandpickedExercises(finalExercises);
  await updateSourceHandpickedFlag(exercise.source, exercise.sourceId, true);
  return exercise;
}

export async function removeHandpickedExercise(
  source: CurationSource,
  sourceId: string
): Promise<string> {
  assertCurationWritesAllowed();

  const finalExercises = await readHandpickedExercises();
  const id = handpickedIdFor(source, sourceId);
  const remaining = finalExercises.filter((exercise) => exercise.id !== id);

  if (remaining.length === finalExercises.length) {
    throw new Error(`Handpicked exercise not found: ${id}`);
  }

  await writeHandpickedExercises(remaining);
  await updateSourceHandpickedFlag(source, sourceId, false);
  return id;
}
