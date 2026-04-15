import { NextRequest, NextResponse } from 'next/server';
import type { HandpickRequest, UnhandpickResponse } from '@/types/curation';
import { assertCurationWritesAllowed, parseCurationSource } from '@/lib/curation/files';
import { removeHandpickedExercise } from '@/lib/curation/store';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    assertCurationWritesAllowed();
    const body = parseRequest(await request.json());
    const removedId = await removeHandpickedExercise(body.source, body.sourceId);

    return NextResponse.json({ removedId } satisfies UnhandpickResponse);
  } catch (error) {
    console.error('Curation unhandpick error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to unhandpick this sentence.' },
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
