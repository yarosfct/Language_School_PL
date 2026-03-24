'use client';

import { useEffect, useMemo, useRef, useState, useCallback, type MouseEvent } from 'react';
import { getWordInsightForToken, type SectionWordInsight } from '@/lib/book/sectionContent';
import { getAllUserWordOverrides, saveUserWordOverride } from '@/lib/db';
import { addCardToCustomSet, getCustomFlashcardSets } from '@/lib/flashcards/customSets';
import type { CustomFlashcardSet } from '@/types/flashcards';
import type {
  TranslationConfidence,
  TranslationLookupRequest,
  TranslationLookupResponse,
  TranslationLookupType,
  TranslationProvider,
  UserWordOverride,
} from '@/types/translations';

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
  provider?: TranslationProvider;
  alternatives?: string[];
  confidence?: TranslationConfidence;
  note?: string;
  error?: string;
}

interface TokenRange {
  start: number;
  end: number;
}

interface SaveState {
  key: string;
  status: 'added' | 'duplicate';
}

const CREATE_NEW_SET_VALUE = '__create_new_set__';
const TRANSLATION_CACHE_STORAGE_KEY = 'poz.translation-cache.v3';

export function InteractiveAnswerText({ text, sectionId }: InteractiveAnswerTextProps) {
  const [customSets, setCustomSets] = useState<CustomFlashcardSet[]>([]);
  const [userWordOverrides, setUserWordOverrides] = useState<UserWordOverride[]>([]);
  const [selectedSetId, setSelectedSetId] = useState(CREATE_NEW_SET_VALUE);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [setFormError, setSetFormError] = useState<string | null>(null);
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);
  const [savingTokenId, setSavingTokenId] = useState<string | null>(null);
  const [savedTokenState, setSavedTokenState] = useState<SaveState | null>(null);
  const [lookupStates, setLookupStates] = useState<Record<string, LookupState>>({});
  const [translationDrafts, setTranslationDrafts] = useState<Record<string, string>>({});
  const [phraseLookupStates, setPhraseLookupStates] = useState<Record<string, LookupState>>({});
  const [phraseAnchorIndex, setPhraseAnchorIndex] = useState<number | null>(null);
  const [phraseRange, setPhraseRange] = useState<TokenRange | null>(null);
  const [isSavingPhrase, setIsSavingPhrase] = useState(false);
  const [savedPhraseState, setSavedPhraseState] = useState<SaveState | null>(null);
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
      insight: token.isWord ? resolveInsight(sectionId, text, token.value, overrideLookup) : null,
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
    const englishCandidates = selectedWords
      .flatMap((entry) => getValidTranslations(entry.token.insight?.english ?? []))
      .slice(0, 6);

    return {
      ...orderedRange,
      polish,
      english,
      englishCandidates,
      key: `${orderedRange.start}-${orderedRange.end}`,
    };
  }, [phraseRange, tokens]);

  const activePhraseLookupState = phraseSelection ? phraseLookupStates[phraseSelection.key] : undefined;
  const activePhraseTranslation = phraseSelection ? getPhrasePrompt(phraseSelection, activePhraseLookupState) : null;
  const showInlineSetCreator = selectedSetId === CREATE_NEW_SET_VALUE;

  const fetchPhraseTranslation = useCallback(async (phraseKey: string, phraseValue: string, englishCandidates: string[]) => {
    const requestPayload = buildTranslationLookupRequest({
      text: phraseValue,
      contextText: text,
      sectionId,
      lookupType: 'phrase',
      insight: {
        polish: phraseValue,
        normalizedToken: normalizeToken(phraseValue),
        englishCandidates,
        partOfSpeech: 'phrase',
        source: 'phrase-selection',
      },
    });
    const cachedResponse = readCachedTranslation(requestPayload);
    if (cachedResponse) {
      setPhraseLookupStates((current) => ({
        ...current,
        [phraseKey]: toLookupState(cachedResponse),
      }));
      return;
    }

    setPhraseLookupStates((current) => ({
      ...current,
      [phraseKey]: {
        status: 'loading',
      },
    }));

    try {
      const response = await fetch('/api/translate/word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      const payload = (await response.json()) as TranslationLookupResponse | { error?: string };
      if (!response.ok || !('translation' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Unable to fetch phrase translation.');
      }
      if (!isValidTranslationText(payload.translation)) {
        throw new Error('Translation provider returned an invalid translation.');
      }

      writeCachedTranslation(requestPayload, payload);

      setPhraseLookupStates((current) => ({
        ...current,
        [phraseKey]: toLookupState(payload),
      }));
    } catch (error) {
      setPhraseLookupStates((current) => ({
        ...current,
        [phraseKey]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unable to fetch phrase translation.',
        },
      }));
    }
  }, [sectionId, text]);

  useEffect(() => {
    async function loadLocalData() {
      const [sets, overrides] = await Promise.all([getCustomFlashcardSets(), getAllUserWordOverrides()]);
      setCustomSets(sets);
      setUserWordOverrides(overrides);
      setSelectedSetId((current) =>
        current && (current === CREATE_NEW_SET_VALUE || sets.some((set) => set.id === current))
          ? current
          : sets[0]?.id ?? CREATE_NEW_SET_VALUE
      );
    }

    void loadLocalData();
  }, []);

  useEffect(() => {
    setActiveTokenId(null);
    setSavedTokenState(null);
    setLookupStates({});
    setTranslationDrafts({});
    setPhraseLookupStates({});
    setPhraseAnchorIndex(null);
    setPhraseRange(null);
    setSavedPhraseState(null);
    setSetFormError(null);
  }, [text, sectionId]);

  useEffect(() => {
    if (!phraseSelection) {
      return;
    }

    const phraseLookupState = phraseLookupStates[phraseSelection.key];
    if (
      phraseLookupState?.status === 'loading' ||
      phraseLookupState?.status === 'success' ||
      phraseLookupState?.status === 'saved'
    ) {
      return;
    }

    void fetchPhraseTranslation(phraseSelection.key, phraseSelection.polish, phraseSelection.englishCandidates);
  }, [fetchPhraseTranslation, phraseLookupStates, phraseSelection]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setActiveTokenId(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  async function refreshCustomSets(preferredSetId?: string) {
    const refreshedSets = await getCustomFlashcardSets();
    setCustomSets(refreshedSets);
    setSelectedSetId((current) => {
      if (preferredSetId && refreshedSets.some((set) => set.id === preferredSetId)) {
        return preferredSetId;
      }

      if (current !== CREATE_NEW_SET_VALUE && refreshedSets.some((set) => set.id === current)) {
        return current;
      }

      return refreshedSets[0]?.id ?? CREATE_NEW_SET_VALUE;
    });
  }

  function resolveSetTarget() {
    if (!showInlineSetCreator) {
      return {
        setId: selectedSetId,
      };
    }

    const trimmedName = newSetName.trim();
    if (!trimmedName) {
      throw new Error('Name the new set before saving this word.');
    }

    return {
      createSet: {
        name: trimmedName,
        description: newSetDescription.trim() || undefined,
      },
    };
  }

  async function addInsightToFlashcardSet(insight: SectionWordInsight) {
    setSavingTokenId(insight.token);

    try {
      const result = await addCardToCustomSet({
        ...resolveSetTarget(),
        card: {
          prompt: insight.english[0] ?? insight.token,
          answer: insight.polish,
        },
      });

      await refreshCustomSets(result.set.id);
      if (result.createdSet) {
        setNewSetName('');
        setNewSetDescription('');
      }
      setSetFormError(null);
      setSavedTokenState({
        key: insight.token,
        status: result.duplicate ? 'duplicate' : 'added',
      });
    } catch (error) {
      setSetFormError(error instanceof Error ? error.message : 'Unable to save this word right now.');
    } finally {
      setSavingTokenId(null);
    }
  }

  async function addPhraseToFlashcardSet() {
    if (!phraseSelection) {
      return;
    }

    setIsSavingPhrase(true);

    try {
      const result = await addCardToCustomSet({
        ...resolveSetTarget(),
        card: {
          prompt: getPhrasePrompt(phraseSelection, phraseLookupStates[phraseSelection.key]),
          answer: phraseSelection.polish,
        },
      });

      await refreshCustomSets(result.set.id);
      if (result.createdSet) {
        setNewSetName('');
        setNewSetDescription('');
      }
      setSetFormError(null);
      setSavedPhraseState({
        key: phraseSelection.key,
        status: result.duplicate ? 'duplicate' : 'added',
      });
    } catch (error) {
      setSetFormError(error instanceof Error ? error.message : 'Unable to save this phrase right now.');
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
    setSavedPhraseState(null);
    setActiveTokenId((current) => (current === tokenId ? null : tokenId));
  }

  async function fetchTranslation(tokenId: string, tokenValue: string, insight: SectionWordInsight) {
    const requestPayload = buildTranslationLookupRequest({
      text: tokenValue,
      contextText: text,
      sectionId,
      lookupType: 'word',
      insight: {
        polish: insight.polish,
        normalizedToken: insight.normalizedToken,
        englishCandidates: getValidTranslations(insight.english),
        partOfSpeech: insight.partOfSpeech,
        source: insight.source,
      },
    });
    const cachedResponse = readCachedTranslation(requestPayload);
    if (cachedResponse) {
      setTranslationDrafts((current) => ({
        ...current,
        [tokenId]: cachedResponse.translation,
      }));
      setLookupStates((current) => ({
        ...current,
        [tokenId]: toLookupState(cachedResponse),
      }));
      return;
    }

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
        body: JSON.stringify(requestPayload),
      });

      const payload = (await response.json()) as TranslationLookupResponse | { error?: string };
      if (!response.ok || !('translation' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Unable to fetch translation.');
      }
      if (!isValidTranslationText(payload.translation)) {
        throw new Error('Translation provider returned an invalid translation.');
      }

      writeCachedTranslation(requestPayload, payload);

      setTranslationDrafts((current) => ({
        ...current,
        [tokenId]: payload.translation,
      }));
      setLookupStates((current) => ({
        ...current,
        [tokenId]: toLookupState(payload),
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
    const sanitizedDraftEntries = parseTranslationInput(draft);
    if (sanitizedDraftEntries.length === 0) {
      setLookupStates((current) => ({
        ...current,
        [tokenId]: {
          ...(current[tokenId] ?? { status: 'idle' as const }),
          status: 'error',
          error: 'Enter a valid translation before saving.',
        },
      }));
      return;
    }

    const lookupState = lookupStates[tokenId];
    const normalizedToken = normalizeToken(tokenValue);

    await saveUserWordOverride({
      normalizedToken,
      polish: tokenValue,
      english: sanitizedDraftEntries,
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
        const displayTranslations = getValidTranslations(insight.english);
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
                <span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">
                  {displayTranslations.length > 0 ? displayTranslations.join(', ') : 'Translation not found yet'}
                </span>
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
                            {lookupState.confidence ? ` · ${getConfidenceLabel(lookupState.confidence)} confidence` : ''}
                          </span>
                        )}
                        {lookupState.alternatives && lookupState.alternatives.length > 0 && (
                          <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                            Also: {lookupState.alternatives.join(', ')}
                          </span>
                        )}
                        {lookupState.note && (
                          <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                            {formatLookupNote(lookupState.note)}
                          </span>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void fetchTranslation(tokenId, token.value, insight)}
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

                <span className="mt-3 block space-y-2">
                  <select
                    value={selectedSetId}
                    onChange={(event) => {
                      setSelectedSetId(event.target.value);
                      setSetFormError(null);
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    {customSets.map((set) => (
                      <option key={set.id} value={set.id}>
                        {set.name}
                      </option>
                    ))}
                    <option value={CREATE_NEW_SET_VALUE}>Create new set</option>
                  </select>

                  {showInlineSetCreator && (
                    <span className="block rounded-lg border border-cyan-400/40 bg-cyan-500/10 p-2">
                      <input
                        type="text"
                        value={newSetName}
                        onChange={(event) => setNewSetName(event.target.value)}
                        placeholder="New set name"
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        value={newSetDescription}
                        onChange={(event) => setNewSetDescription(event.target.value)}
                        placeholder="Description (optional)"
                        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <span className="mt-2 block text-[11px] text-cyan-800 dark:text-cyan-200">
                        Saving a word or phrase will create the set first, then add the card automatically.
                      </span>
                    </span>
                  )}

                  {setFormError && (
                    <span className="block rounded-lg border border-red-300 bg-red-50 px-2 py-2 text-xs text-red-700 dark:border-red-800/70 dark:bg-red-900/20 dark:text-red-200">
                      {setFormError}
                    </span>
                  )}

                  {phraseSelection ? (
                    <span className="block rounded-lg border border-cyan-400/40 bg-cyan-500/10 p-2 text-xs text-cyan-800 dark:text-cyan-200">
                      Phrase selected: <strong>{phraseSelection.polish}</strong>
                      <span className="mt-1 block">
                        {activePhraseLookupState?.status === 'loading'
                          ? 'Translating phrase...'
                          : `Translation: ${activePhraseTranslation ?? phraseSelection.english}`}
                      </span>
                      {activePhraseLookupState?.provider && (
                        <span className="mt-1 block text-[11px]">
                          {getProviderLabel(activePhraseLookupState.provider)}
                          {activePhraseLookupState.confidence ? ` · ${getConfidenceLabel(activePhraseLookupState.confidence)} confidence` : ''}
                        </span>
                      )}
                      {activePhraseLookupState?.alternatives && activePhraseLookupState.alternatives.length > 0 && (
                        <span className="mt-1 block text-[11px]">
                          Also: {activePhraseLookupState.alternatives.join(', ')}
                        </span>
                      )}
                      {activePhraseLookupState?.note && (
                        <span className="mt-1 block text-[11px]">{formatLookupNote(activePhraseLookupState.note)}</span>
                      )}
                      {activePhraseLookupState?.status === 'error' && (
                        <span className="mt-1 block text-[11px] text-red-700/90 dark:text-red-300">
                          {activePhraseLookupState.error} Showing fallback phrase gloss.
                        </span>
                      )}
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
                        : savedPhraseState?.key === phraseSelection.key
                        ? savedPhraseState.status === 'duplicate'
                          ? 'Phrase Already Saved'
                          : 'Phrase Added'
                        : showInlineSetCreator
                        ? 'Create Set + Add Phrase'
                        : 'Add Selected Phrase'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void addInsightToFlashcardSet(insight)}
                    disabled={savingTokenId === insight.token}
                    className="w-full rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingTokenId === insight.token
                      ? 'Adding...'
                      : savedTokenState?.key === insight.token
                      ? savedTokenState.status === 'duplicate'
                        ? 'Word Already Saved'
                        : 'Word Added'
                      : showInlineSetCreator
                      ? 'Create Set + Add Word'
                      : 'Add Word'}
                  </button>
                </span>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function getProviderLabel(provider: LookupState['provider']): string {
  if (provider === 'openai-context') {
    return 'Contextual AI';
  }

  if (provider === 'mymemory') {
    return 'MyMemory';
  }

  if (provider === 'libretranslate') {
    return 'LibreTranslate';
  }

  if (provider === 'context-heuristic') {
    return 'context-aware rule';
  }

  return 'translation provider';
}

function getConfidenceLabel(confidence: TranslationConfidence): string {
  if (confidence === 'high') {
    return 'high';
  }

  if (confidence === 'low') {
    return 'low';
  }

  return 'medium';
}

function formatLookupNote(note: string): string {
  const trimmed = note.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('PHRASE:')) {
    const phraseMeaning = trimmed.slice('PHRASE:'.length).trim();
    return phraseMeaning ? `Phrase meaning: ${phraseMeaning}` : 'Phrase meaning.';
  }

  return trimmed;
}

function toLookupState(payload: TranslationLookupResponse): LookupState {
  return {
    status: 'success',
    translation: payload.translation,
    provider: payload.provider,
    alternatives: payload.alternatives,
    confidence: payload.confidence,
    note: payload.note,
  };
}

function buildTranslationLookupRequest(input: {
  text: string;
  contextText: string;
  sectionId: string;
  lookupType: TranslationLookupType;
  insight?: TranslationLookupRequest['insight'];
}): TranslationLookupRequest {
  return {
    text: input.text,
    sourceLang: 'pl',
    targetLang: 'en',
    contextText: input.contextText,
    sectionId: input.sectionId,
    lookupType: input.lookupType,
    insight: input.insight,
  };
}

function readCachedTranslation(request: TranslationLookupRequest): TranslationLookupResponse | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawCache = window.localStorage.getItem(TRANSLATION_CACHE_STORAGE_KEY);
    if (!rawCache) {
      return null;
    }

    const cache = JSON.parse(rawCache) as Record<string, TranslationLookupResponse>;
    return cache[getTranslationCacheKey(request)] ?? null;
  } catch {
    return null;
  }
}

function writeCachedTranslation(request: TranslationLookupRequest, response: TranslationLookupResponse): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const rawCache = window.localStorage.getItem(TRANSLATION_CACHE_STORAGE_KEY);
    const cache = rawCache ? (JSON.parse(rawCache) as Record<string, TranslationLookupResponse>) : {};
    cache[getTranslationCacheKey(request)] = response;
    window.localStorage.setItem(TRANSLATION_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache failures and continue with live translations.
  }
}

function getTranslationCacheKey(request: TranslationLookupRequest): string {
  return JSON.stringify({
    text: normalizeToken(request.text),
    sourceLang: request.sourceLang ?? 'pl',
    targetLang: request.targetLang ?? 'en',
    contextText: normalizeToken(request.contextText ?? ''),
    sectionId: request.sectionId ?? '',
    lookupType: request.lookupType ?? 'word',
  });
}

function resolveInsight(
  sectionId: string,
  sentenceText: string,
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

  const baseInsight = getWordInsightForToken(sectionId, tokenValue);
  if (!baseInsight) {
    return null;
  }

  return applyContextualInsightOverride(baseInsight, sentenceText, tokenValue);
}


function applyContextualInsightOverride(
  insight: SectionWordInsight,
  sentenceText: string,
  tokenValue: string
): SectionWordInsight {
  const normalizedToken = normalizeToken(tokenValue);
  const normalizedSentence = normalizeToken(sentenceText);

  if (!normalizedSentence) {
    return insight;
  }

  const isAgeExpression = /\b(?:mam|masz|ma|mamy|macie|maja)\s+\d+\s+lat(?:a)?\b/u.test(normalizedSentence);
  if (isAgeExpression && (normalizedToken == 'lat' || normalizedToken == 'lata')) {
    return {
      ...insight,
      polish: tokenValue,
      english: ['years'],
      partOfSpeech: 'noun',
      isFallback: false,
      source: 'context-heuristic',
    };
  }

  return insight;
}

function toInsightFromOverride(tokenValue: string, override: UserWordOverride): SectionWordInsight {
  const english = getValidTranslations(override.english);
  return {
    token: tokenValue,
    normalizedToken: override.normalizedToken,
    polish: override.polish,
    english: english.length > 0 ? english : ['Translation not found yet'],
    partOfSpeech: override.partOfSpeech,
    isFallback: english.length === 0,
    source: override.sectionId ? 'local-section-override' : 'local-global-override',
  };
}

function isInsightMissing(insight: SectionWordInsight): boolean {
  const translations = getValidTranslations(insight.english);
  if (translations.length === 0) {
    return true;
  }

  return translations.every((entry) => isMissingTranslationSentinel(entry));
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
    .flatMap((insight) => getValidTranslations(insight.english).slice(0, 1))
    .filter((word) => word !== 'Translation not found yet');

  if (englishWords.length > 0) {
    return englishWords.join(' ');
  }

  return `Translate: ${phrasePolish}`;
}

function getPhrasePrompt(
  phraseSelection: {
    english: string;
  },
  lookupState: LookupState | undefined
): string {
  if (lookupState?.translation && isValidTranslationText(lookupState.translation)) {
    return lookupState.translation.trim();
  }

  return phraseSelection.english;
}

function parseTranslationInput(value: string): string[] {
  return getValidTranslations(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function getValidTranslations(values: string[]): string[] {
  return values
    .map((entry) => entry.trim())
    .filter((entry) => isValidTranslationText(entry))
    .filter((entry) => !isMissingTranslationSentinel(entry));
}

function isValidTranslationText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return /[\p{L}\p{N}]/u.test(trimmed);
}

function isMissingTranslationSentinel(value: string): boolean {
  return value.trim().toLowerCase() === 'translation not found yet';
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
    case 'context-heuristic':
      return 'context';
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
    case 'context-heuristic':
      return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300';
    default:
      return 'bg-gray-500/15 text-gray-700 dark:text-gray-300';
  }
}
