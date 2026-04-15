import { NextRequest, NextResponse } from 'next/server';
import type { HandpickRequest, HandpickResponse } from '@/types/curation';
import { buildHandpickedExercise, validateSelectedPolishTokenIds } from '@/lib/curation/build';
import { assertCurationWritesAllowed, parseCurationSource } from '@/lib/curation/files';
import { generateCurationExplanation } from '@/lib/curation/openai';
import { getHandpickedExercise, getSourceExercise, upsertHandpickedExercise } from '@/lib/curation/store';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    assertCurationWritesAllowed();
    const body = parseRequest(await request.json());
    const sourceItem = await getSourceExercise(body.source, body.sourceId);
    const existing = await getHandpickedExercise(body.source, body.sourceId);

    if (!existing) {
      throw new Error('Handpick this sentence before regenerating its explanation.');
    }

    const selectedPolishTokenIds = validateSelectedPolishTokenIds(
      sourceItem,
      existing.blankablePolishTokenIds
    );
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
    console.error('Curation regenerate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to regenerate this explanation.' },
      { status: 500 }
    );
  }
}

function parseRequest(value: unknown): Pick<HandpickRequest, 'source' | 'sourceId'> {
  const body = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

  return {
    source: parseCurationSource(body.source),
    sourceId: typeof body.sourceId === 'string' ? body.sourceId.trim() : '',
  };
}
