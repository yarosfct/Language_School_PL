import type {
  CuratedSourceExercise,
  CurationListItem,
  CurationSource,
  CurationToken,
  ExerciseLevels,
  HandpickedExercise,
} from '@/types/curation';
import {
  cleanCurationText,
  normalizeCurationText,
  selectedTokenSet,
  stripTokenOffsets,
  tokenizeCurationSentence,
} from '@/lib/curation/tokenize';
import { handpickedIdFor } from '@/lib/curation/files';

export function buildExerciseLevels(
  polishTokens: CurationToken[],
  selectedPolishTokenIds: string[]
): ExerciseLevels {
  const selectedIds = [...selectedTokenSet(selectedPolishTokenIds)];
  const allPolishTokenIds = polishTokens.map((token) => token.id);

  return {
    easy: {
      mode: 'single_blank_variants',
      variants: selectedIds.map((tokenId) => ({ blankTokenIds: [tokenId] })),
    },
    medium: {
      mode: 'multi_blank',
      blankTokenIds: selectedIds,
    },
    hard: {
      mode: 'full_sentence',
      blankTokenIds: allPolishTokenIds,
    },
  };
}

export function buildCurationListItem(
  source: CurationSource,
  item: CuratedSourceExercise,
  handpickedExercise?: HandpickedExercise
): CurationListItem {
  const selectedIds = selectedTokenSet(handpickedExercise?.blankablePolishTokenIds ?? []);
  const polishTokens = tokenizeCurationSentence(item.pl, 'pl').map((token) => ({
    ...token,
    selectedForBlank: selectedIds.has(token.id),
    translation:
      handpickedExercise?.polishTokens.find((savedToken) => savedToken.id === token.id)?.translation ?? '',
    lemma: handpickedExercise?.polishTokens.find((savedToken) => savedToken.id === token.id)?.lemma,
    partOfSpeech: handpickedExercise?.polishTokens.find((savedToken) => savedToken.id === token.id)?.partOfSpeech,
  }));
  const englishTokens = tokenizeCurationSentence(item.en, 'en').map((token) => ({
    ...token,
    translation:
      handpickedExercise?.englishTokens.find((savedToken) => savedToken.id === token.id)?.translation ?? '',
  }));

  return {
    ...item,
    source,
    polishTokens,
    englishTokens,
    handpickedExercise,
  };
}

export function buildHandpickedExercise(input: {
  source: CurationSource;
  sourceItem: CuratedSourceExercise;
  selectedPolishTokenIds: string[];
  polishTokenInsights: Array<Partial<CurationToken> & { id: string }>;
  englishTokenInsights: Array<Partial<CurationToken> & { id: string }>;
  explanation: HandpickedExercise['explanation'];
  llm: HandpickedExercise['llm'];
  existing?: HandpickedExercise;
}): HandpickedExercise {
  const now = new Date().toISOString();
  const selectedIds = selectedTokenSet(input.selectedPolishTokenIds);
  const polishInsights = new Map(input.polishTokenInsights.map((token) => [token.id, token]));
  const englishInsights = new Map(input.englishTokenInsights.map((token) => [token.id, token]));

  const polishTokens = tokenizeCurationSentence(input.sourceItem.pl, 'pl').map((token) => {
    const insight = polishInsights.get(token.id);

    return stripTokenOffsets({
      ...token,
      selectedForBlank: selectedIds.has(token.id),
      translation: cleanCurationText(insight?.translation ?? ''),
      lemma: cleanOptional(insight?.lemma),
      partOfSpeech: cleanOptional(insight?.partOfSpeech),
    });
  });

  const englishTokens = tokenizeCurationSentence(input.sourceItem.en, 'en').map((token) => {
    const insight = englishInsights.get(token.id);

    return stripTokenOffsets({
      ...token,
      translation: cleanCurationText(insight?.translation ?? ''),
    });
  });

  return {
    id: handpickedIdFor(input.source, input.sourceItem.id),
    source: input.source,
    sourceId: input.sourceItem.id,
    pl: input.sourceItem.pl,
    en: input.sourceItem.en,
    category: input.sourceItem.category,
    difficulty: input.sourceItem.difficulty,
    sentenceType: input.sourceItem.sentenceType,
    handpicked: true,
    blankablePolishTokenIds: [...selectedIds],
    polishTokens,
    englishTokens,
    exerciseLevels: buildExerciseLevels(polishTokens, [...selectedIds]),
    explanation: sanitizeExplanation(input.explanation),
    llm: input.llm,
    createdAt: input.existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function validateSelectedPolishTokenIds(
  sourceItem: CuratedSourceExercise,
  selectedPolishTokenIds: string[]
): string[] {
  const uniqueIds = [...selectedTokenSet(selectedPolishTokenIds)];
  if (uniqueIds.length === 0) {
    throw new Error('Select at least one Polish word before handpicking.');
  }

  const validIds = new Set(tokenizeCurationSentence(sourceItem.pl, 'pl').map((token) => token.id));
  const invalidIds = uniqueIds.filter((tokenId) => !validIds.has(tokenId));
  if (invalidIds.length > 0) {
    throw new Error(`Invalid Polish token id(s): ${invalidIds.join(', ')}`);
  }

  return uniqueIds;
}

export function finalExerciseMatches(
  exercise: HandpickedExercise,
  source: CurationSource,
  sourceId: string
): boolean {
  return exercise.source === source && exercise.sourceId === sourceId;
}

export function normalizePairKey(pl: string, en: string): string {
  return `${normalizeCurationText(pl)}|${normalizeCurationText(en)}`;
}

function sanitizeExplanation(explanation: HandpickedExercise['explanation']): HandpickedExercise['explanation'] {
  return {
    summary: cleanCurationText(explanation.summary),
    usage: cleanCurationText(explanation.usage),
    grammarNotes: cleanStringArray(explanation.grammarNotes),
    nuanceNotes: cleanStringArray(explanation.nuanceNotes),
    examples: explanation.examples
      .map((example) => ({
        pl: cleanCurationText(example.pl),
        en: cleanCurationText(example.en),
        note: cleanOptional(example.note),
      }))
      .filter((example) => example.pl && example.en),
    variations: explanation.variations
      .map((variation) => ({
        pl: cleanCurationText(variation.pl),
        en: cleanCurationText(variation.en),
        note: cleanOptional(variation.note),
      }))
      .filter((variation) => variation.pl && variation.en),
  };
}

function cleanStringArray(value: string[]): string[] {
  return value.map((entry) => cleanCurationText(entry)).filter(Boolean);
}

function cleanOptional(value: unknown): string | undefined {
  const cleaned = cleanCurationText(value);
  return cleaned || undefined;
}
