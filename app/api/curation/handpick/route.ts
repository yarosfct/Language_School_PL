import { NextRequest, NextResponse } from 'next/server';
import type { HandpickRequest, HandpickResponse } from '@/types/curation';
import {
  buildHandpickedExercise,
  finalExerciseMatches,
  validateSelectedPolishTokenIds,
} from '@/lib/curation/build';
import { assertCurationWritesAllowed, parseCurationSource, readHandpickedExercises } from '@/lib/curation/files';
import { generateCurationExplanation } from '@/lib/curation/openai';
import { getSourceExercise, upsertHandpickedExercise } from '@/lib/curation/store';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    assertCurationWritesAllowed();
    const body = parseHandpickRequest(await request.json());
    const sourceItem = await getSourceExercise(body.source, body.sourceId);
    const selectedPolishTokenIds = validateSelectedPolishTokenIds(sourceItem, body.selectedPolishTokenIds);
    const existing = (await readHandpickedExercises()).find((exercise) =>
      finalExerciseMatches(exercise, body.source, body.sourceId)
    );

    if (existing && sameTokenIds(existing.blankablePolishTokenIds, selectedPolishTokenIds)) {
      return NextResponse.json({ exercise: existing } satisfies HandpickResponse);
    }

    const generated = await generateCurationExplanation({
      sourceItem,
      selectedPolishTokenIds,
    });
    const exercise = buildHandpickedExercise({
      source: body.source,
      sourceItem,
      selectedPolishTokenIds,
      polishTokenInsights: generated.polishTokenInsights,
      englishTokenInsights: generated.englishTokenInsights,
      explanation: generated.explanation,
      llm: generated.llm,
      existing,
    });

    const saved = await upsertHandpickedExercise(exercise);

    return NextResponse.json({ exercise: saved } satisfies HandpickResponse);
  } catch (error) {
    console.error('Curation handpick error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to handpick this sentence.' },
      { status: 500 }
    );
  }
}

function parseHandpickRequest(value: unknown): HandpickRequest {
  const body = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

  return {
    source: parseCurationSource(body.source),
    sourceId: typeof body.sourceId === 'string' ? body.sourceId.trim() : '',
    selectedPolishTokenIds: Array.isArray(body.selectedPolishTokenIds)
      ? body.selectedPolishTokenIds.filter((tokenId): tokenId is string => typeof tokenId === 'string')
      : [],
  };
}

function sameTokenIds(left: string[], right: string[]): boolean {
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();

  return leftSorted.length === rightSorted.length && leftSorted.every((tokenId, index) => tokenId === rightSorted[index]);
}
