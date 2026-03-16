'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { getWordInsightForToken, type SectionWordInsight } from '@/lib/book/sectionContent';
import { getAllCustomFlashcardSets, getAllUserWordOverrides, saveCustomFlashcardSet, saveUserWordOverride } from '@/lib/db';
import { generateId } from '@/lib/utils/string';
import type { CustomFlashcardSet } from '@/types/flashcards';
import type { UserWordOverride, TranslationLookupResponse } from '@/types/translations';

interface InteractiveAnswerTextProps {
  text: string;
  sectionId: string;
}

interface AnswerToken {
  value: string;
  isWord: boolean;
  insight: SectionWordInsight | null;
}

interface LookupState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'saved';
  translation?: string;
  provider?: string;
  error?: string;
}

interface TokenRange {
  start: number;
  end: number;
}

export function InteractiveAnswerText({ text, sectionId }: InteractiveAnswerTextProps) {
  const [customSets, setCustomSets] = useState<CustomFlashcardSet[]>([]);
  const [userWordOverrides, setUserWordOverrides] = useState<UserWordOverride[]>([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);
  const [savingTokenId, setSavingTokenId] = useState<string | null>(null);
  const [savedTokenId, setSavedTokenId] = useState<string | null>(null);
  const [lookupStates, setLookupStates] = useState<Record<string, LookupState>>({});
  const [translationDrafts, setTranslationDrafts] = useState<Record<string, string>>({});
  const [phraseAnchorIndex, setPhraseAnchorIndex] = useState<number | null>(null);
  const [phraseRange, setPhraseRange] = useState<TokenRange | null>(null);
  const [isSavingPhrase, setIsSavingPhrase] = useState(false);
  const [savedPhraseKey, setSavedPhraseKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);

  const overrideLookup = useMemo(() => {
    const sectionMap = new Map<string, UserWordOverride>();
    const globalMap = new Map<string, UserWordOverride>();

    for (const override of userWordOverrides) {
      if (override.sectionId === sectionId) {
        sectionMap.set(override.normalizedToken, override);
        continue;
      }

      if (!override.sectionId) {
        globalMap.set(override.normalizedToken, override);
      }
    }

    return {
      sectionMap,
      globalMap,
    };
  }, [sectionId, userWordOverrides]);

  const tokens = useMemo<AnswerToken[]>(() => {
    return tokenizeAnswerText(text).map((token) => ({
      ...token,
      insight: token.isWord ? resolveInsight(sectionId, token.value, overrideLookup) : null,
    }));
  }, [overrideLookup, sectionId, text]);

  const phraseSelection = useMemo(() => {
    if (!phraseRange) {
      return null;
    }

    const orderedRange: TokenRange = {
      start: Math.min(phraseRange.start, phraseRange.end),
      end: Math.max(phraseRange.start, phraseRange.end),
    };

    const selectedTokenEntries = tokens
      .map((token, index) => ({ token, index }))
      .filter((entry) => entry.index >= orderedRange.start && entry.index <= orderedRange.end);

    const selectedWords = selectedTokenEntries.filter((entry) => entry.token.isWord && entry.token.insight);
    if (selectedWords.length < 2) {
      return null;
    }

    const polish = selectedTokenEntries.map((entry) => entry.token.value).join('').replace(/\s+/g, ' ').trim();
    if (!polish) {
      return null;
    }

    const english = buildPhrasePrompt(selectedWords.map((entry) => entry.token.insight as SectionWordInsight), polish);

    return {
      ...orderedRange,
      polish,
      english,
      key: `${orderedRange.start}-${orderedRange.end}`,
    };
  }, [phraseRange, tokens]);

  useEffect(() => {
    async function loadLocalData() {
      const [sets, overrides] = await Promise.all([getAllCustomFlashcardSets(), getAllUserWordOverrides()]);
      setCustomSets(sets);
      setUserWordOverrides(overrides);
      setSelectedSetId((current) => current || sets[0]?.id || '');
    }

    void loadLocalData();
  }, []);

  useEffect(() => {
    setActiveTokenId(null);
    setSavedTokenId(null);
    setLookupStates({});
    setTranslationDrafts({});
    setPhraseAnchorIndex(null);
    setPhraseRange(null);
    setSavedPhraseKey(null);
  }, [text, sectionId]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setActiveTokenId(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  async function addInsightToFlashcardSet(insight: SectionWordInsight) {
    if (!selectedSetId) {
      return;
    }

    const targetSet = customSets.find((set) => set.id === selectedSetId);
    if (!targetSet) {
      return;
    }

    const normalizedPolish = normalizeToken(insight.polish);
    const alreadyExists = targetSet.cards.some((card) => normalizeToken(card.answer) === normalizedPolish);
    if (alreadyExists) {
      setSavedTokenId(insight.token);
      return;
    }

    setSavingTokenId(insight.token);

    try {
      const updatedSet: CustomFlashcardSet = {
        ...targetSet,
        cards: [
          ...targetSet.cards,
          {
            id: generateId(),
            prompt: insight.english[0] ?? insight.token,
            answer: insight.polish,
            createdAt: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      };

      await saveCustomFlashcardSet(updatedSet);

      const refreshedSets = await getAllCustomFlashcardSets();
      setCustomSets(refreshedSets);
      setSavedTokenId(insight.token);
    } finally {
      setSavingTokenId(null);
    }
  }

  async function addPhraseToFlashcardSet() {
    if (!phraseSelection || !selectedSetId) {
      return;
    }

    const targetSet = customSets.find((set) => set.id === selectedSetId);
    if (!targetSet) {
      return;
    }

    const normalizedPhrase = normalizeToken(phraseSelection.polish);
    const alreadyExists = targetSet.cards.some((card) => normalizeToken(card.answer) === normalizedPhrase);
    if (alreadyExists) {
      setSavedPhraseKey(phraseSelection.key);
      return;
    }

    setIsSavingPhrase(true);

    try {
      const updatedSet: CustomFlashcardSet = {
        ...targetSet,
        cards: [
          ...targetSet.cards,
          {
            id: generateId(),
            prompt: phraseSelection.english,
            answer: phraseSelection.polish,
            createdAt: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      };

      await saveCustomFlashcardSet(updatedSet);
      const refreshedSets = await getAllCustomFlashcardSets();
      setCustomSets(refreshedSets);
      setSavedPhraseKey(phraseSelection.key);
    } finally {
      setIsSavingPhrase(false);
    }
  }

  function handleTokenClick(event: MouseEvent<HTMLButtonElement>, tokenId: string, tokenIndex: number) {
    if (event.shiftKey && phraseAnchorIndex !== null) {
      setPhraseRange({
        start: Math.min(phraseAnchorIndex, tokenIndex),
        end: Math.max(phraseAnchorIndex, tokenIndex),
      });
      setActiveTokenId(tokenId);
      return;
    }

    setPhraseAnchorIndex(tokenIndex);
    setPhraseRange(null);
    setSavedPhraseKey(null);
    setActiveTokenId((current) => (current === tokenId ? null : tokenId));
  }

  async function fetchTranslation(tokenId: string, tokenValue: string) {
    setLookupStates((current) => ({
      ...current,
      [tokenId]: {
        status: 'loading',
      },
    }));

    try {
      const response = await fetch('/api/translate/word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: tokenValue,
          sourceLang: 'pl',
          targetLang: 'en',
          contextText: text,
        }),
      });

      const payload = (await response.json()) as TranslationLookupResponse | { error?: string };
      if (!response.ok || !('translation' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Unable to fetch translation.');
      }

      setTranslationDrafts((current) => ({
        ...current,
        [tokenId]: payload.translation,
      }));
      setLookupStates((current) => ({
        ...current,
        [tokenId]: {
          status: 'success',
          translation: payload.translation,
          provider: payload.provider,
        },
      }));
    } catch (error) {
      setLookupStates((current) => ({
        ...current,
        [tokenId]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unable to fetch translation.',
        },
      }));
    }
  }

  async function saveTranslationToLocalList(tokenId: string, tokenValue: string) {
    const draft = translationDrafts[tokenId]?.trim();
    if (!draft) {
      return;
    }

    const lookupState = lookupStates[tokenId];
    const normalizedToken = normalizeToken(tokenValue);

    await saveUserWordOverride({
      normalizedToken,
      polish: tokenValue,
      english: draft
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      partOfSpeech: 'word',
      source: lookupState?.status === 'success' ? 'online' : 'manual',
      provider: lookupState?.provider,
      sectionId: null,
    });

    const refreshedOverrides = await getAllUserWordOverrides();
    setUserWordOverrides(refreshedOverrides);
    setLookupStates((current) => ({
      ...current,
      [tokenId]: {
        ...(current[tokenId] ?? { status: 'idle' as const }),
        status: 'saved',
        translation: draft,
        provider: current[tokenId]?.provider,
      },
    }));
  }

  return (
    <span ref={rootRef} className="whitespace-pre-wrap">
      {tokens.map((token, index) => {
        if (!token.isWord || !token.insight) {
          return <span key={`${token.value}-${index}`}>{token.value}</span>;
        }

        const insight = token.insight;
        const tokenId = `${token.value}-${index}`;
        const isOpen = activeTokenId === tokenId;
        const lookupState = lookupStates[tokenId];
        const draftTranslation = translationDrafts[tokenId] ?? '';
        const missingTranslation = isInsightMissing(insight);
        const isInPhraseSelection = isTokenInsideRange(index, phraseSelection);

        return (
          <span key={tokenId} className="relative inline-block">
            <button
              type="button"
              onClick={(event) => handleTokenClick(event, tokenId, index)}
              className={`inline-block rounded-sm px-0.5 text-current transition duration-150 hover:-translate-y-0.5 hover:opacity-80 focus:outline-none focus-visible:opacity-80 ${
                isInPhraseSelection ? 'bg-cyan-500/20' : ''
              }`}
            >
              {token.value}
            </button>
            {isOpen && (
              <span className="absolute left-1/2 top-full z-30 mt-2 inline-block w-72 -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 text-left align-top shadow-xl dark:border-gray-700 dark:bg-gray-900">
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">{insight.polish}</span>
                <span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">{insight.english.join(', ')}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{insight.partOfSpeech}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${getSourceBadgeClasses(insight.source)}`}>
                    {getSourceLabel(insight.source)}
                  </span>
                </span>

                {missingTranslation && (
                  <span className="mt-3 block space-y-2">
                    {lookupState?.status === 'success' || lookupState?.status === 'saved' ? (
                      <>
                        <input
                          type="text"
                          value={draftTranslation}
                          onChange={(event) =>
                            setTranslationDrafts((current) => ({
                              ...current,
                              [tokenId]: event.target.value,
                            }))
                          }
                          placeholder="Edit translation before saving"
                          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => void saveTranslationToLocalList(tokenId, token.value)}
                          className="w-full rounded-lg border border-emerald-500 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                        >
                          {lookupState.status === 'saved' ? 'Saved to Local Word List' : 'Save to Local Word List'}
                        </button>
                        {lookupState.provider && (
                          <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                            Suggested by {getProviderLabel(lookupState.provider)}
                          </span>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void fetchTranslation(tokenId, token.value)}
                        disabled={lookupState?.status === 'loading'}
                        className="w-full rounded-lg border border-amber-400 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-300"
                      >
                        {lookupState?.status === 'loading' ? 'Getting Translation...' : 'Get Translation'}
                      </button>
                    )}

                    {lookupState?.status === 'error' && (
                      <span className="block text-xs text-red-600 dark:text-red-300">{lookupState.error}</span>
                    )}
                  </span>
                )}

                {customSets.length > 0 ? (
                  <span className="mt-3 block space-y-2">
                    <select
                      value={selectedSetId}
                      onChange={(event) => setSelectedSetId(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {customSets.map((set) => (
                        <option key={set.id} value={set.id}>
                          {set.name}
                        </option>
                      ))}
                    </select>

                    {phraseSelection ? (
                      <span className="block rounded-lg border border-cyan-400/40 bg-cyan-500/10 p-2 text-xs text-cyan-800 dark:text-cyan-200">
                        Phrase selected: <strong>{phraseSelection.polish}</strong>
                      </span>
                    ) : (
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        Tip: Shift+click another nearby word to select a phrase.
                      </span>
                    )}

                    {phraseSelection && (
                      <button
                        type="button"
                        onClick={() => void addPhraseToFlashcardSet()}
                        disabled={isSavingPhrase}
                        className="w-full rounded-lg border border-cyan-400 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-cyan-300"
                      >
                        {isSavingPhrase
                          ? 'Adding phrase...'
                          : savedPhraseKey === phraseSelection.key
                          ? 'Phrase Added'
                          : 'Add Selected Phrase'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void addInsightToFlashcardSet(insight)}
                      disabled={savingTokenId === insight.token}
                      className="w-full rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingTokenId === insight.token ? 'Adding...' : savedTokenId === insight.token ? 'Added' : 'Add Word'}
                    </button>
                  </span>
                ) : (
                  <span className="mt-3 block text-xs text-gray-500 dark:text-gray-400">
                    Create a custom set in flashcards to save this word.
                  </span>
                )}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function getProviderLabel(provider: LookupState['provider']): string {
  if (provider === 'mymemory') {
    return 'MyMemory';
  }

  if (provider === 'libretranslate') {
    return 'LibreTranslate';
  }

  if (provider === 'context-heuristic') {
    return 'context rule';
  }

  return 'translation provider';
}

function resolveInsight(
  sectionId: string,
  tokenValue: string,
  overrideLookup: {
    sectionMap: Map<string, UserWordOverride>;
    globalMap: Map<string, UserWordOverride>;
  }
): SectionWordInsight | null {
  const normalizedToken = normalizeToken(tokenValue);
  const sectionOverride = overrideLookup.sectionMap.get(normalizedToken);
  if (sectionOverride) {
    return toInsightFromOverride(tokenValue, sectionOverride);
  }

  const globalOverride = overrideLookup.globalMap.get(normalizedToken);
  if (globalOverride) {
    return toInsightFromOverride(tokenValue, globalOverride);
  }

  return getWordInsightForToken(sectionId, tokenValue);
}

function toInsightFromOverride(tokenValue: string, override: UserWordOverride): SectionWordInsight {
  return {
    token: tokenValue,
    normalizedToken: override.normalizedToken,
    polish: override.polish,
    english: override.english,
    partOfSpeech: override.partOfSpeech,
    source: override.sectionId ? 'local-section-override' : 'local-global-override',
  };
}

function isInsightMissing(insight: SectionWordInsight): boolean {
  return insight.isFallback === true && insight.english.length === 1 && insight.english[0] === 'Translation not found yet';
}

function tokenizeAnswerText(sentence: string): Array<{ value: string; isWord: boolean }> {
  const parts = sentence.match(/[\p{L}\p{N}ąćęłńóśźżĄĆĘŁŃÓŚŹŻ-]+|[^\p{L}\p{N}\s]+|\s+/gu) ?? [sentence];

  return parts.map((part) => ({
    value: part,
    isWord: /[\p{L}\p{N}ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u.test(part),
  }));
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPhrasePrompt(insights: SectionWordInsight[], phrasePolish: string): string {
  const englishWords = insights
    .map((insight) => insight.english[0]?.trim())
    .filter((word): word is string => Boolean(word) && word !== 'Translation not found yet');

  if (englishWords.length > 0) {
    return englishWords.join(' ');
  }

  return `Translate: ${phrasePolish}`;
}

function isTokenInsideRange(index: number, range: TokenRange | null): boolean {
  if (!range) {
    return false;
  }

  return index >= range.start && index <= range.end;
}

function getSourceLabel(source: SectionWordInsight['source']): string {
  switch (source) {
    case 'book-section':
      return 'book';
    case 'book-global':
      return 'book';
    case 'static-section-override':
    case 'static-global-override':
      return 'static';
    case 'local-section-override':
    case 'local-global-override':
      return 'local';
    case 'fallback':
      return 'fallback';
    default:
      return 'unknown';
  }
}

function getSourceBadgeClasses(source: SectionWordInsight['source']): string {
  switch (source) {
    case 'book-section':
    case 'book-global':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
    case 'static-section-override':
    case 'static-global-override':
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-300';
    case 'local-section-override':
    case 'local-global-override':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    case 'fallback':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    default:
      return 'bg-gray-500/15 text-gray-700 dark:text-gray-300';
  }
}
