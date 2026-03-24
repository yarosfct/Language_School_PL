import { getSequentialSections } from '@/lib/book/sequentialLearning';
import { getTopicMeta } from '@/lib/curriculum/topicLoader';
import { getBookPathProgress, getCustomFlashcardSet } from '@/lib/db';
import { getFlashcardTopics } from '@/lib/flashcards/practice';
import type { NotebookContextSnapshot } from '@/types/notebook';

const flashcardTopics = getFlashcardTopics();
const bookSections = getSequentialSections();

export async function resolveNotebookContext(
  pathname: string,
  searchParams: URLSearchParams
): Promise<NotebookContextSnapshot> {
  if (pathname.startsWith('/learn/flashcards/session')) {
    return await resolveFlashcardsSessionContext(pathname, searchParams);
  }

  if (pathname.startsWith('/learn/session')) {
    return await resolveBookSessionContext(pathname);
  }

  if (pathname.startsWith('/topic/')) {
    return resolveTopicContext(pathname);
  }

  if (pathname.startsWith('/review')) {
    return resolveReviewContext(pathname, searchParams);
  }

  if (pathname.startsWith('/mistakes')) {
    return buildContext('mistakes', 'Mistakes Notebook', 'Mistakes Notebook', ['mistakes'], pathname);
  }

  if (pathname.startsWith('/vocabulary')) {
    return buildContext('vocabulary', 'Vocabulary Notes', 'Vocabulary Notes', ['vocabulary'], pathname);
  }

  if (pathname.startsWith('/grammar')) {
    return buildContext('grammar', 'Grammar Notes', 'Grammar Notes', ['grammar'], pathname);
  }

  if (pathname.startsWith('/learn/flashcards')) {
    return buildContext(
      'flashcards-lab',
      'Flashcards Lab',
      'Flashcards Lab Notes',
      ['flashcards'],
      pathname
    );
  }

  if (pathname.startsWith('/learn')) {
    return buildContext('learn', 'Learn', 'Learn Session Notes', ['learn'], pathname);
  }

  return buildContext('general', 'General Notes', 'General Notes', ['general'], pathname);
}

async function resolveFlashcardsSessionContext(
  pathname: string,
  searchParams: URLSearchParams
): Promise<NotebookContextSnapshot> {
  const rawMode = searchParams.get('mode') ?? 'topic';
  const mode = rawMode === 'random' ? 'practice' : rawMode;
  const practiceType = searchParams.get('practiceType') ?? 'vocabulary';
  const topicId = searchParams.get('topicId') ?? undefined;
  const customSetId = searchParams.get('customSetId') ?? undefined;
  const difficultyBucket = searchParams.get('difficultyBucket') ?? undefined;

  const practiceLabel = toLabel(practiceType);

  if (mode === 'custom' && customSetId) {
    const customSet = await getCustomFlashcardSet(customSetId);
    const setName = customSet?.name ?? 'Custom Set';

    return buildContext(
      `flashcards:custom:${customSetId}:${practiceType}`,
      `Flashcards / ${setName} / ${practiceLabel}`,
      `${setName} Flashcards Notes`,
      ['flashcards', setName, practiceLabel],
      pathname
    );
  }

  const topicLabel = flashcardTopics.find((topic) => topic.id === topicId)?.label ?? 'Flashcards';
  const modeLabel = mode === 'practice' ? 'Practice' : toLabel(mode);
  const difficultyLabel = difficultyBucket ? ` / ${toLabel(difficultyBucket)}` : '';

  return buildContext(
    `flashcards:${mode}:${topicId ?? 'all'}:${practiceType}:${difficultyBucket ?? 'all'}`,
    `Flashcards / ${modeLabel}${difficultyLabel} / ${topicLabel} / ${practiceLabel}`,
    `${topicLabel} ${practiceLabel} Flashcards`,
    ['flashcards', modeLabel, topicLabel, practiceLabel, difficultyBucket ?? ''],
    pathname
  );
}

async function resolveBookSessionContext(pathname: string): Promise<NotebookContextSnapshot> {
  const bookPath = await getBookPathProgress();
  const currentSection = bookSections.find((section) => section.id === bookPath.currentSectionId);
  const sectionLabel = currentSection?.label ?? 'Current Section';
  const difficultyLabel = toLabel(bookPath.currentDifficulty.replace('_', ' '));

  return buildContext(
    `book:${currentSection?.id ?? 'current'}:${bookPath.currentDifficulty}`,
    `Book Practice / ${sectionLabel} / ${difficultyLabel}`,
    `${sectionLabel} Book Practice`,
    ['book practice', sectionLabel, difficultyLabel],
    pathname
  );
}

function resolveTopicContext(pathname: string): NotebookContextSnapshot {
  const topicId = pathname.split('/').filter(Boolean)[1] ?? '';
  const topicLabel = getTopicMeta(topicId)?.title ?? 'Topic';

  return buildContext(
    `topic:${topicId}`,
    `Topic / ${topicLabel}`,
    `${topicLabel} Topic Notes`,
    ['topic', topicLabel],
    pathname
  );
}

function resolveReviewContext(pathname: string, searchParams: URLSearchParams): NotebookContextSnapshot {
  const topicId = searchParams.get('topic');
  const topicLabel = flashcardTopics.find((topic) => topic.id === topicId)?.label;

  if (topicId && topicLabel) {
    return buildContext(
      `review:${topicId}`,
      `Review / ${topicLabel}`,
      `${topicLabel} Review Notes`,
      ['review', topicLabel],
      pathname
    );
  }

  return buildContext('review', 'Review', 'Review Notes', ['review'], pathname);
}

function buildContext(
  key: string,
  label: string,
  suggestedName: string,
  categories: string[],
  pathname: string
): NotebookContextSnapshot {
  return {
    key,
    label,
    suggestedName,
    categories: sanitizeCategories(categories),
    pathname,
  };
}

function sanitizeCategories(categories: string[]): string[] {
  return [...new Set(categories.map((category) => category.trim()).filter(Boolean))];
}

function toLabel(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
