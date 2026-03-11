#!/usr/bin/env ts-node

import { writeFileSync } from 'fs';
import { join } from 'path';
import bookData from '../content/book/book_data.json';
import wordOverrides from '../content/book/word_overrides.json';

interface RawBookData {
  entries?: Record<string, RawBookEntry>;
}

interface RawBookEntry {
  section_number?: unknown;
  topic_en?: unknown;
  data?: unknown;
}

interface RawWordOverrides {
  global?: Record<string, RawWordOverrideEntry>;
  bySection?: Record<string, Record<string, RawWordOverrideEntry>>;
}

interface RawWordOverrideEntry {
  polish?: unknown;
  english?: unknown;
}

interface MissingTokenInfo {
  token: string;
  count: number;
  sections: Array<{ sectionId: string; sectionNumber: number | null; topicEn: string; count: number }>;
  examples: Array<{ sectionId: string; polish: string; english: string }>;
}

const parsedBook = bookData as RawBookData;
const parsedOverrides = wordOverrides as RawWordOverrides;

const entries = parsedBook.entries ?? {};
const globalOverrideKeys = new Set(Object.keys(parsedOverrides.global ?? {}).map(normalize));
const sectionOverrideKeys = new Map<string, Set<string>>();

for (const [sectionId, sectionEntries] of Object.entries(parsedOverrides.bySection ?? {})) {
  sectionOverrideKeys.set(sectionId, new Set(Object.keys(sectionEntries).map(normalize)));
}

const globalVocabulary = new Set<string>();
const sectionVocabulary = new Map<string, Set<string>>();

for (const [sectionId, entry] of Object.entries(entries)) {
  const data = isRecord(entry.data) ? entry.data : {};
  const vocabulary = Array.isArray(data.vocabulary) ? data.vocabulary : [];
  const tokenSet = new Set<string>();

  for (const item of vocabulary) {
    if (!isRecord(item)) {
      continue;
    }

    const polish = cleanText(toString(item.pl) ?? '');
    if (!polish) {
      continue;
    }

    tokenSet.add(normalize(polish));
    globalVocabulary.add(normalize(polish));
  }

  sectionVocabulary.set(sectionId, tokenSet);
}

const missing = new Map<string, MissingTokenInfo>();
let totalSentenceTokens = 0;
let coveredTokens = 0;

for (const [sectionId, entry] of Object.entries(entries)) {
  const data = isRecord(entry.data) ? entry.data : {};
  const sentences = Array.isArray(data.sentences) ? data.sentences : [];
  const localVocabulary = sectionVocabulary.get(sectionId) ?? new Set<string>();
  const localOverrides = sectionOverrideKeys.get(sectionId) ?? new Set<string>();
  const sectionNumber = toNumber(entry.section_number);
  const topicEn = cleanText(toString(entry.topic_en) ?? sectionId);

  for (const item of sentences) {
    if (!isRecord(item)) {
      continue;
    }

    const polishSentence = cleanText(toString(item.pl) ?? '');
    const englishSentence = cleanText(toString(item.en) ?? '');
    if (!polishSentence) {
      continue;
    }

    for (const token of tokenize(polishSentence)) {
      totalSentenceTokens += 1;

      if (
        localOverrides.has(token) ||
        globalOverrideKeys.has(token) ||
        localVocabulary.has(token) ||
        globalVocabulary.has(token)
      ) {
        coveredTokens += 1;
        continue;
      }

      const current = missing.get(token) ?? {
        token,
        count: 0,
        sections: [],
        examples: [],
      };

      current.count += 1;

      const sectionBucket = current.sections.find((section) => section.sectionId === sectionId);
      if (sectionBucket) {
        sectionBucket.count += 1;
      } else {
        current.sections.push({
          sectionId,
          sectionNumber,
          topicEn,
          count: 1,
        });
      }

      if (current.examples.length < 3 && !current.examples.some((example) => example.polish === polishSentence)) {
        current.examples.push({
          sectionId,
          polish: polishSentence,
          english: englishSentence,
        });
      }

      missing.set(token, current);
    }
  }
}

const uncovered = [...missing.values()]
  .sort((a, b) => b.count - a.count || a.token.localeCompare(b.token))
  .slice(0, 400)
  .map((item) => ({
    ...item,
    sections: item.sections.sort((a, b) => b.count - a.count || a.sectionId.localeCompare(b.sectionId)),
  }));

const report = {
  meta: {
    generatedAt: new Date().toISOString(),
    totalSentenceTokens,
    coveredTokens,
    uniqueUncoveredTokens: missing.size,
    note: 'Top 400 uncovered sentence tokens after checking vocabulary and word_overrides.json.',
  },
  uncovered,
};

const outputPath = join(process.cwd(), 'content', 'book', 'word_coverage_report.json');
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');

console.log(`Coverage report written to ${outputPath}`);
console.log(`Covered sentence tokens: ${coveredTokens}/${totalSentenceTokens}`);
console.log(`Unique uncovered tokens: ${missing.size}`);

function tokenize(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length > 1);
}

function normalize(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
