import { NextResponse } from 'next/server';
import { readFillBlankPool } from '@/lib/fillBlanks/files';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = await readFillBlankPool();
    return NextResponse.json(pool);
  } catch (error) {
    console.error('Fill blank pool load error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to load fill blank exercises.',
      },
      { status: 500 }
    );
  }
}
