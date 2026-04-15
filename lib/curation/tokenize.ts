import type { CurationToken } from '@/types/curation';

const WORD_PATTERN = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)?/gu;

export function cleanCurationText(value: unknown): string {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeCurationText(value: unknown): string {
  return cleanCurationText(value)
    .toLocaleLowerCase('pl-PL')
    .replace(/[“”‘’"'.,!?;:()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeCurationSentence(text: string, prefix: 'pl' | 'en'): CurationToken[] {
  const tokens: CurationToken[] = [];
  const cleaned = cleanCurationText(text);
  const matches = cleaned.matchAll(WORD_PATTERN);

  for (const match of matches) {
    const raw = match[0];
    const index = tokens.length;
    tokens.push({
      id: `${prefix}-${index}`,
      index,
      text: raw,
      normalized: normalizeCurationText(raw),
      translation: '',
      start: match.index,
      end: match.index + raw.length,
    });
  }

  return tokens;
}

export function stripTokenOffsets(token: CurationToken): CurationToken {
  return {
    id: token.id,
    index: token.index,
    text: token.text,
    normalized: token.normalized,
    translation: token.translation,
    selectedForBlank: token.selectedForBlank,
    lemma: token.lemma,
    partOfSpeech: token.partOfSpeech,
  };
}

export function selectedTokenSet(tokenIds: string[]): Set<string> {
  return new Set(tokenIds.map((tokenId) => tokenId.trim()).filter(Boolean));
}
