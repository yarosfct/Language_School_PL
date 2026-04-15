import { NextRequest, NextResponse } from 'next/server';
import type { CurationItemsResponse } from '@/types/curation';
import { buildCurationListItem } from '@/lib/curation/build';
import {
  parseCurationSource,
  readHandpickedExercises,
  readSourceExercises,
} from '@/lib/curation/files';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const source = parseCurationSource(params.get('source'));
    const page = Math.max(1, Number(params.get('page')) || 1);
    const pageSize = clamp(Number(params.get('pageSize')) || 20, 5, 50);
    const category = params.get('category')?.trim() || 'all';
    const difficulty = params.get('difficulty')?.trim() || 'all';
    const handpicked = params.get('handpicked')?.trim() || 'all';
    const search = params.get('search')?.trim().toLocaleLowerCase('pl-PL') || '';

    const [sourceItems, handpickedExercises] = await Promise.all([
      readSourceExercises(source),
      readHandpickedExercises(),
    ]);
    const handpickedBySourceId = new Map(
      handpickedExercises
        .filter((exercise) => exercise.source === source)
        .map((exercise) => [exercise.sourceId, exercise])
    );
    const enrichedItems = sourceItems.map((item) =>
      buildCurationListItem(source, item, handpickedBySourceId.get(item.id))
    );

    const filtered = enrichedItems.filter((item) => {
      if (category !== 'all' && item.category !== category) {
        return false;
      }

      if (difficulty !== 'all' && item.difficulty !== difficulty) {
        return false;
      }

      if (handpicked === 'yes' && !item.handpicked) {
        return false;
      }

      if (handpicked === 'no' && item.handpicked) {
        return false;
      }

      if (search) {
        const text = `${item.pl} ${item.en} ${item.category}`.toLocaleLowerCase('pl-PL');
        if (!text.includes(search)) {
          return false;
        }
      }

      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    const response: CurationItemsResponse = {
      items: filtered.slice(offset, offset + pageSize),
      page: safePage,
      pageSize,
      total,
      totalPages,
      stats: buildStats(enrichedItems),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Curation list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load curation items.' },
      { status: 500 }
    );
  }
}

function buildStats(items: Array<{ category: string; difficulty: string; handpicked: boolean }>): CurationItemsResponse['stats'] {
  const stats: CurationItemsResponse['stats'] = {
    total: items.length,
    handpicked: items.filter((item) => item.handpicked).length,
    categories: {},
    difficulties: {},
  };

  for (const item of items) {
    stats.categories[item.category] = (stats.categories[item.category] ?? 0) + 1;
    stats.difficulties[item.difficulty] = (stats.difficulties[item.difficulty] ?? 0) + 1;
  }

  return stats;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
