'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Heart,
  Lightbulb,
  Loader2,
  Plus,
  RotateCcw,
  Star,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card, PageHeader, Select } from '@/components/ui/primitives';
import { DiacriticsKeyboard } from '@/components/ui/DiacriticsKeyboard';
import { TTSControls } from '@/components/ui/TTSControls';
import {
  getAllFillBlankFavorites,
  getAllFillBlankPoolTargets,
  getAllFillBlankSentenceStats,
  getAllFillBlankWordStats,
  initializeDatabase,
  saveFillBlankAttemptWithStats,
  toggleFillBlankFavorite,
  upsertFillBlankPoolTarget,
  type FillBlankWordStatInput,
} from '@/lib/db';
import {
  evaluateFillBlankPracticeAnswer,
  normalizePracticeText,
  planFillBlankBatch,
  sentenceStatId,
  tokenPracticeKey,
} from '@/lib/fillBlanks/planner';
import { convertAsteriskPolish } from '@/lib/utils/string';
import type { CurationToken } from '@/types/curation';
import type {
  FillBlankAttemptErrorType,
  FillBlankAttemptRecord,
  FillBlankFavorite,
  FillBlankPoolResponse,
  FillBlankPoolTarget,
  FillBlankPracticeUnit,
  FillBlankSentenceStats,
  FillBlankTokenSelection,
  FillBlankWordStats,
  PooledFillBlankExercise,
} from '@/types/fillBlanks';

const BATCH_SIZES = [10, 20, 30, 50] as const;
const WORD_PATTERN = /[\p{L}\p{M}]+/gu;

type SessionStage = 'setup' | 'active' | 'summary';
type ExerciseState = 'answering' | 'completed';

interface SessionResult {
  unitId: string;
  correct: boolean;
  failed: boolean;
  learned: boolean;
}

export default function FillBlanksPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [pool, setPool] = useState<PooledFillBlankExercise[]>([]);
  const [poolStats, setPoolStats] = useState<FillBlankPoolResponse['stats'] | null>(null);
  const [wordStats, setWordStats] = useState<FillBlankWordStats[]>([]);
  const [sentenceStats, setSentenceStats] = useState<FillBlankSentenceStats[]>([]);
  const [favorites, setFavorites] = useState<FillBlankFavorite[]>([]);
  const [poolTargets, setPoolTargets] = useState<FillBlankPoolTarget[]>([]);
  const [batchSize, setBatchSize] = useState<(typeof BATCH_SIZES)[number]>(10);
  const [stage, setStage] = useState<SessionStage>('setup');
  const [batch, setBatch] = useState<FillBlankPracticeUnit[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [hintLevel, setHintLevel] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'warning' | 'error' | 'info'; text: string } | null>(null);
  const [exerciseState, setExerciseState] = useState<ExerciseState>('answering');
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedToken, setSelectedToken] = useState<FillBlankTokenSelection | null>(null);
  const [activeInputIndex, setActiveInputIndex] = useState<number | null>(null);
  const [exerciseStartedAt, setExerciseStartedAt] = useState(Date.now());
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const currentUnit = batch[currentIndex] ?? null;
  const favoriteIds = useMemo(() => new Set(favorites.map((favorite) => favorite.id)), [favorites]);
  const completedCount = sessionResults.length;
  const correctCount = sessionResults.filter((result) => result.correct).length;
  const learnedCount = sessionResults.filter((result) => result.learned).length;

  const refreshLocalLearningState = useCallback(async () => {
    const [nextWordStats, nextSentenceStats, nextFavorites, nextPoolTargets] = await Promise.all([
      getAllFillBlankWordStats(),
      getAllFillBlankSentenceStats(),
      getAllFillBlankFavorites(),
      getAllFillBlankPoolTargets(),
    ]);

    setWordStats(nextWordStats);
    setSentenceStats(nextSentenceStats);
    setFavorites(nextFavorites);
    setPoolTargets(nextPoolTargets);

    return {
      wordStats: nextWordStats,
      sentenceStats: nextSentenceStats,
      favorites: nextFavorites,
      poolTargets: nextPoolTargets,
    };
  }, []);

  const loadEverything = useCallback(async () => {
    setIsLoading(true);
    setNotice(null);

    try {
      await initializeDatabase();
      const response = await fetch('/api/fill-blanks/pool', { cache: 'no-store' });
      const payload = (await response.json()) as FillBlankPoolResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load fill blank exercises.');
      }

      setPool(payload.exercises);
      setPoolStats(payload.stats);
      await refreshLocalLearningState();
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to load fill blank practice.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [refreshLocalLearningState]);

  useEffect(() => {
    void loadEverything();
  }, [loadEverything]);

  useEffect(() => {
    if (!currentUnit) {
      return;
    }

    const inputCount = currentUnit.mode === 'hard' ? 1 : currentUnit.targetTexts.length;
    setAnswers(new Array(inputCount).fill(''));
    setHintLevel(0);
    setWrongAttempts(0);
    setWarningCount(0);
    setFeedback(null);
    setExerciseState('answering');
    setShowExplanation(false);
    setSelectedToken(null);
    setActiveInputIndex(null);
    setExerciseStartedAt(Date.now());
    inputRefs.current = [];
  }, [currentUnit]);

  async function startBatch() {
    const localState = await refreshLocalLearningState();
    const planned = planFillBlankBatch(pool, {
      batchSize,
      wordStats: localState.wordStats,
      sentenceStats: localState.sentenceStats,
      favorites: localState.favorites,
      poolTargets: localState.poolTargets,
    });

    if (planned.length === 0) {
      setNotice({ tone: 'error', text: 'No fill blank exercises are available yet. Handpick a few sentences first.' });
      return;
    }

    setBatch(planned);
    setCurrentIndex(0);
    setSessionResults([]);
    setStage('active');
    setNotice(null);
  }

  function handleAnswerChange(index: number, value: string) {
    const nextAnswers = [...answers];
    nextAnswers[index] = convertAsteriskPolish(value);
    setAnswers(nextAnswers);
  }

  function insertDiacritic(char: string) {
    if (activeInputIndex === null) {
      return;
    }

    const input = inputRefs.current[activeInputIndex];
    if (!input) {
      return;
    }

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const currentValue = answers[activeInputIndex] ?? '';
    const nextValue = currentValue.slice(0, start) + char + currentValue.slice(end);

    handleAnswerChange(activeInputIndex, nextValue);

    window.setTimeout(() => {
      input.setSelectionRange(start + 1, start + 1);
      input.focus();
    }, 0);
  }

  async function handleSubmit() {
    if (!currentUnit || exerciseState === 'completed' || isSaving) {
      return;
    }

    const hasAnyAnswer = answers.some((answer) => answer.trim().length > 0);
    if (!hasAnyAnswer) {
      await completeCurrentExercise({
        correct: false,
        failed: true,
        learned: true,
        attemptCount: Math.max(1, wrongAttempts + 1),
        warnings: warningCount,
        errorType: 'learn',
        message: 'Saved as something to learn. Here is the answer.',
      });
      return;
    }

    const result = evaluateFillBlankPracticeAnswer(currentUnit, answers);
    if (result.kind === 'correct') {
      await completeCurrentExercise({
        correct: true,
        failed: false,
        learned: false,
        attemptCount: wrongAttempts + 1,
        warnings: warningCount,
        message: result.message,
      });
      return;
    }

    const nextWrongAttempts = wrongAttempts + 1;
    const nextWarnings = warningCount + (result.kind === 'warning' ? 1 : 0);

    if (nextWrongAttempts >= 3) {
      await completeCurrentExercise({
        correct: false,
        failed: true,
        learned: false,
        attemptCount: nextWrongAttempts,
        warnings: nextWarnings,
        errorType: result.errorType ?? 'wrong',
        message: `${result.message} Three tries used, so this one is marked for review.`,
      });
      return;
    }

    setWrongAttempts(nextWrongAttempts);
    setWarningCount(nextWarnings);
    setFeedback({
      tone: result.kind === 'warning' ? 'warning' : 'error',
      text: `${result.message} ${3 - nextWrongAttempts} ${3 - nextWrongAttempts === 1 ? 'try' : 'tries'} left.`,
    });
  }

  async function completeCurrentExercise(input: {
    correct: boolean;
    failed: boolean;
    learned: boolean;
    attemptCount: number;
    warnings: number;
    errorType?: FillBlankAttemptErrorType;
    message: string;
  }) {
    if (!currentUnit) {
      return;
    }

    setIsSaving(true);
    const timestamp = Date.now();
    const record: FillBlankAttemptRecord = {
      unitId: currentUnit.id,
      exerciseId: currentUnit.exerciseId,
      poolSource: currentUnit.poolSource,
      mode: currentUnit.mode,
      targetTokenIds: currentUnit.targetTokenIds,
      targetKeys: currentUnit.targetKeys,
      answer: answers,
      correct: input.correct,
      failed: input.failed,
      learned: input.learned,
      attempts: input.attemptCount,
      warnings: input.warnings,
      hintsUsed: hintLevel,
      timeSpent: timestamp - exerciseStartedAt,
      timestamp,
      errorType: input.errorType,
    };

    try {
      await saveFillBlankAttemptWithStats(record, getWordStatInputs(currentUnit));
      const localState = await refreshLocalLearningState();

      setWordStats(localState.wordStats);
      setSentenceStats(localState.sentenceStats);
      setSessionResults((previous) => [
        ...previous,
        {
          unitId: currentUnit.id,
          correct: input.correct,
          failed: input.failed,
          learned: input.learned,
        },
      ]);
      setFeedback({
        tone: input.correct ? 'success' : input.learned ? 'info' : 'error',
        text: input.message,
      });
      setExerciseState('completed');
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to save this attempt.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  function getWordStatInputs(unit: FillBlankPracticeUnit): FillBlankWordStatInput[] {
    const tokenById = new Map(unit.exercise.polishTokens.map((token) => [token.id, token]));

    return unit.targetTokenIds
      .map((tokenId) => tokenById.get(tokenId))
      .filter((token): token is CurationToken => Boolean(token))
      .map((token) => ({
        key: tokenPracticeKey(token),
        normalized: normalizePracticeText(token.normalized || token.text),
        lemma: token.lemma,
        displayText: token.text,
        translation: token.translation,
        partOfSpeech: token.partOfSpeech,
      }));
  }

  function requestHint() {
    if (exerciseState === 'completed') {
      return;
    }

    setHintLevel((current) => Math.min(2, current + 1));
  }

  function goToNextExercise() {
    if (currentIndex >= batch.length - 1) {
      setStage('summary');
      return;
    }

    setCurrentIndex((current) => current + 1);
  }

  function resetSession() {
    setStage('setup');
    setBatch([]);
    setCurrentIndex(0);
    setSessionResults([]);
    setNotice(null);
  }

  async function toggleFavoriteWord(selection: FillBlankTokenSelection) {
    const id = favoriteWordId(selection);
    const targetKey = selection.language === 'pl' ? tokenPracticeKey(selection.token) : normalizePracticeText(selection.token.normalized || selection.token.text);

    await toggleFillBlankFavorite({
      id,
      kind: 'word',
      language: selection.language,
      targetKey,
      displayText: selection.token.text,
    });
    await refreshLocalLearningState();
  }

  async function toggleFavoriteSentence(exercise: PooledFillBlankExercise) {
    await toggleFillBlankFavorite({
      id: favoriteSentenceId(exercise),
      kind: 'sentence',
      displayText: exercise.pl,
      exerciseId: exercise.id,
      poolSource: exercise.poolSource,
    });
    await refreshLocalLearningState();
  }

  async function addSelectedWordToPool(selection: FillBlankTokenSelection) {
    const targetKey = selection.language === 'pl' ? tokenPracticeKey(selection.token) : normalizePracticeText(selection.token.normalized || selection.token.text);
    const normalized = normalizePracticeText(selection.token.normalized || selection.token.text);
    const matchCount = countMatchesForSelection(selection, pool);

    await upsertFillBlankPoolTarget({
      language: selection.language,
      targetKey,
      normalized,
      displayText: selection.token.text,
      matchCount,
    });
    await refreshLocalLearningState();
    setNotice({
      tone: 'success',
      text:
        matchCount > 0
          ? `Added "${selection.token.text}" to the pool focus. ${matchCount} existing ${matchCount === 1 ? 'sentence matches' : 'sentences match'}.`
          : `Added "${selection.token.text}" to the pool focus. No existing sentence matches yet, but the target is saved.`,
    });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading fill blank practice...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Fill Blanks"
        description="Practice the words you selected, then let the app keep the hard ones in rotation."
        actions={
          stage !== 'setup' ? (
            <Button type="button" variant="secondary" onClick={resetSession}>
              <RotateCcw className="h-4 w-4" />
              New batch
            </Button>
          ) : null
        }
      />

      {notice ? <Notice tone={notice.tone} text={notice.text} /> : null}

      {stage === 'setup' ? (
        <Card className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StatTile label="Pool" value={String(poolStats?.total ?? pool.length)} detail={`${poolStats?.handpicked ?? 0} handpicked`} />
            <StatTile label="AI pool" value={String(poolStats?.aiPicked ?? 0)} detail="ready for later" />
            <StatTile label="Words seen" value={String(wordStats.length)} detail={`${sentenceStats.length} sentences seen`} />
            <StatTile label="Favorites" value={String(favorites.length)} detail="words and sentences" />
          </div>

          <div className="grid gap-4 md:grid-cols-[240px_1fr] md:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">Batch size</span>
              <Select value={String(batchSize)} onChange={(event) => setBatchSize(Number(event.target.value) as (typeof BATCH_SIZES)[number])}>
                {BATCH_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} exercises
                  </option>
                ))}
              </Select>
            </label>

            <div className="flex flex-wrap gap-3">
              <Button type="button" size="lg" onClick={startBatch} disabled={pool.length === 0}>
                <Target className="h-4 w-4" />
                Start adaptive batch
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={loadEverything}>
                Refresh pool
              </Button>
            </div>
          </div>

          <div className="rounded-card border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
            The first batches favor short, common words. Words that cause misses, hints, or Learn actions stay active. Favorites and pool targets get pulled forward.
          </div>
        </Card>
      ) : null}

      {stage === 'active' && currentUnit ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">
                  {currentIndex + 1} / {batch.length}
                </Badge>
                <Badge tone={currentUnit.mode === 'easy' ? 'success' : currentUnit.mode === 'medium' ? 'warning' : 'danger'}>
                  {currentUnit.mode}
                </Badge>
                <Badge>{Math.round(currentUnit.baseDifficulty)} word score</Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => toggleFavoriteSentence(currentUnit.exercise)}
                disabled={isSaving || exerciseState !== 'completed'}
              >
                <Star className={`h-4 w-4 ${favoriteIds.has(favoriteSentenceId(currentUnit.exercise)) ? 'fill-current text-warning-500' : ''}`} />
                Sentence
              </Button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">English</p>
              <p className="text-2xl font-semibold text-gray-950 dark:text-white">{currentUnit.en}</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Polish</p>
              {currentUnit.mode === 'hard' ? (
                <HardSentenceAnswer
                  unit={currentUnit}
                  value={answers[0] ?? ''}
                  hintLevel={hintLevel}
                  disabled={exerciseState === 'completed'}
                  inputRef={(element) => {
                    inputRefs.current[0] = element;
                  }}
                  onFocus={() => setActiveInputIndex(0)}
                  onChange={(value) => handleAnswerChange(0, value)}
                />
              ) : (
                <InlinePolishPrompt
                  unit={currentUnit}
                  answers={answers}
                  hintLevel={hintLevel}
                  disabled={exerciseState === 'completed'}
                  inputRefs={inputRefs}
                  onFocus={setActiveInputIndex}
                  onAnswerChange={handleAnswerChange}
                />
              )}
            </div>

            {exerciseState === 'answering' ? (
              <div className="flex justify-center">
                <DiacriticsKeyboard onCharacter={insertDiacritic} compact className="diacritics-keyboard" />
              </div>
            ) : null}

            {feedback ? <Notice tone={feedback.tone} text={feedback.text} /> : null}

            <div className="flex flex-wrap gap-3">
              {exerciseState === 'answering' ? (
                <>
                  <Button type="button" onClick={handleSubmit} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {answers.some((answer) => answer.trim().length > 0) ? 'Submit' : 'Learn'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={requestHint} disabled={hintLevel >= 2 || isSaving}>
                    <Lightbulb className="h-4 w-4" />
                    Hint {hintLevel}/2
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" onClick={goToNextExercise}>
                    {currentIndex >= batch.length - 1 ? 'Finish batch' : 'Next exercise'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowExplanation((current) => !current)}>
                    <BookOpen className="h-4 w-4" />
                    {showExplanation ? 'Hide explanation' : 'Show explanation'}
                  </Button>
                </>
              )}
            </div>

            {exerciseState === 'completed' ? (
              <CompletedReview
                exercise={currentUnit.exercise}
                selectedToken={selectedToken}
                favoriteIds={favoriteIds}
                showExplanation={showExplanation}
                onSelectToken={setSelectedToken}
                onToggleFavoriteWord={toggleFavoriteWord}
                onAddToPool={addSelectedWordToPool}
              />
            ) : null}
          </Card>

          <aside className="space-y-4">
            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-950 dark:text-white">Batch</h2>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <ProgressRow label="Completed" value={`${completedCount}/${batch.length}`} />
                <ProgressRow label="Correct" value={`${correctCount}`} />
                <ProgressRow label="Learned" value={`${learnedCount}`} />
                <ProgressRow label="Attempts" value={`${wrongAttempts}/3`} />
                <ProgressRow label="Hints" value={`${hintLevel}/2`} />
              </div>
            </Card>

            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-950 dark:text-white">Active focus</h2>
              {poolTargets.filter((target) => target.active).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {poolTargets
                    .filter((target) => target.active)
                    .slice(0, 12)
                    .map((target) => (
                      <Badge key={target.id} tone="primary">
                        {target.displayText}
                      </Badge>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-300">Click a completed word and add it to the pool.</p>
              )}
            </Card>
          </aside>
        </div>
      ) : null}

      {stage === 'summary' ? (
        <Card className="space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-card bg-accent-100 text-accent-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Trophy className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-950 dark:text-white">Batch complete</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              {correctCount} correct, {learnedCount} learned, {sessionResults.length - correctCount - learnedCount} marked for review.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button type="button" onClick={startBatch}>
              Start another batch
            </Button>
            <Button type="button" variant="secondary" onClick={resetSession}>
              Change batch size
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function InlinePolishPrompt({
  unit,
  answers,
  hintLevel,
  disabled,
  inputRefs,
  onFocus,
  onAnswerChange,
}: {
  unit: FillBlankPracticeUnit;
  answers: string[];
  hintLevel: number;
  disabled: boolean;
  inputRefs: MutableRefObject<Array<HTMLInputElement | null>>;
  onFocus: (index: number) => void;
  onAnswerChange: (index: number, value: string) => void;
}) {
  const blankSet = new Set(unit.blankTokenIds);
  const tokenToAnswerIndex = new Map(unit.targetTokenIds.map((tokenId, index) => [tokenId, index]));
  const pieces: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;

  for (const match of unit.pl.matchAll(WORD_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const token = unit.exercise.polishTokens[tokenIndex];

    if (start > cursor) {
      pieces.push(<span key={`text-${cursor}`}>{unit.pl.slice(cursor, start)}</span>);
    }

    if (token && blankSet.has(token.id)) {
      const answerIndex = tokenToAnswerIndex.get(token.id) ?? 0;
      pieces.push(
        <span key={token.id} className="inline-flex flex-col align-middle">
          <input
            ref={(element) => {
              inputRefs.current[answerIndex] = element;
            }}
            type="text"
            value={answers[answerIndex] ?? ''}
            disabled={disabled}
            onFocus={() => onFocus(answerIndex)}
            onChange={(event) => onAnswerChange(answerIndex, event.target.value)}
            className="mx-1 min-w-[92px] rounded-button border-2 border-gray-300 bg-white px-3 py-1 text-center text-lg font-semibold text-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:border-gray-200 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:disabled:border-gray-700 dark:disabled:bg-gray-800"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {hintLevel > 0 ? <span className="mx-1 mt-1 text-center text-xs text-gray-500 dark:text-gray-400">{formatTokenHint(token.text, hintLevel)}</span> : null}
        </span>
      );
    } else {
      pieces.push(<span key={`word-${tokenIndex}`}>{raw}</span>);
    }

    cursor = start + raw.length;
    tokenIndex += 1;
  }

  if (cursor < unit.pl.length) {
    pieces.push(<span key={`text-${cursor}`}>{unit.pl.slice(cursor)}</span>);
  }

  return <div className="rounded-card border border-gray-200 bg-gray-50 p-5 text-2xl leading-relaxed text-gray-950 dark:border-gray-700 dark:bg-gray-900/40 dark:text-white">{pieces}</div>;
}

function HardSentenceAnswer({
  unit,
  value,
  hintLevel,
  disabled,
  inputRef,
  onFocus,
  onChange,
}: {
  unit: FillBlankPracticeUnit;
  value: string;
  hintLevel: number;
  disabled: boolean;
  inputRef: (element: HTMLInputElement | null) => void;
  onFocus: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-card border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900/40">
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-button border-2 border-gray-300 bg-white px-4 py-3 text-lg font-semibold text-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:border-gray-200 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:disabled:border-gray-700 dark:disabled:bg-gray-800"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {hintLevel > 0 ? <p className="text-sm text-gray-600 dark:text-gray-300">{formatHardHint(unit.exercise.polishTokens, hintLevel)}</p> : null}
    </div>
  );
}

function CompletedReview({
  exercise,
  selectedToken,
  favoriteIds,
  showExplanation,
  onSelectToken,
  onToggleFavoriteWord,
  onAddToPool,
}: {
  exercise: PooledFillBlankExercise;
  selectedToken: FillBlankTokenSelection | null;
  favoriteIds: Set<string>;
  showExplanation: boolean;
  onSelectToken: (selection: FillBlankTokenSelection) => void;
  onToggleFavoriteWord: (selection: FillBlankTokenSelection) => void;
  onAddToPool: (selection: FillBlankTokenSelection) => void;
}) {
  return (
    <div className="space-y-5 rounded-card border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/50">
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-950 dark:text-white">Answer</h3>
        <p className="text-2xl font-semibold text-gray-950 dark:text-white">{exercise.pl}</p>
        <TTSControls
          text={exercise.pl}
          showSlowToggle
          showReplayButton
          className="pt-1"
        />
      </div>

      <TokenLine
        title="Polish words"
        language="pl"
        exercise={exercise}
        tokens={exercise.polishTokens}
        onSelectToken={onSelectToken}
      />

      {selectedToken ? (
        <div className="rounded-card border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-900/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-200">
                Polish token
              </p>
              <h4 className="mt-1 text-xl font-bold text-gray-950 dark:text-white">{selectedToken.token.text}</h4>
              <p className="mt-1 text-gray-700 dark:text-gray-200">{selectedToken.token.translation || 'No translation stored yet.'}</p>
              {selectedToken.token.lemma || selectedToken.token.partOfSpeech ? (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {[selectedToken.token.lemma ? `Lemma: ${selectedToken.token.lemma}` : '', selectedToken.token.partOfSpeech ? `Part of speech: ${selectedToken.token.partOfSpeech}` : '']
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => onToggleFavoriteWord(selectedToken)}>
                <Heart className={`h-4 w-4 ${favoriteIds.has(favoriteWordId(selectedToken)) ? 'fill-current text-destructive-500' : ''}`} />
                Word
              </Button>
              <Button type="button" size="sm" onClick={() => onAddToPool(selectedToken)}>
                <Plus className="h-4 w-4" />
                Pool
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showExplanation ? <ExplanationBlock exercise={exercise} /> : null}
    </div>
  );
}

function TokenLine({
  title,
  language,
  exercise,
  tokens,
  onSelectToken,
}: {
  title: string;
  language: 'pl' | 'en';
  exercise: PooledFillBlankExercise;
  tokens: CurationToken[];
  onSelectToken: (selection: FillBlankTokenSelection) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
      <div className="flex flex-wrap gap-2">
        {tokens.map((token) => (
          <button
            key={`${language}-${token.id}`}
            type="button"
            onClick={() => onSelectToken({ language, token, exercise })}
            className="rounded-button border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 transition-colors hover:border-primary-400 hover:bg-primary-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-primary-700 dark:hover:bg-primary-900/30"
          >
            {token.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExplanationBlock({ exercise }: { exercise: PooledFillBlankExercise }) {
  return (
    <div className="space-y-4 rounded-card border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-300">
      <div>
        <h3 className="font-semibold text-gray-950 dark:text-white">Meaning</h3>
        <p className="mt-1">{exercise.explanation.summary}</p>
      </div>
      <div>
        <h3 className="font-semibold text-gray-950 dark:text-white">Usage</h3>
        <p className="mt-1">{exercise.explanation.usage}</p>
      </div>
      {exercise.explanation.grammarNotes.length > 0 ? (
        <div>
          <h3 className="font-semibold text-gray-950 dark:text-white">Grammar</h3>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {exercise.explanation.grammarNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {exercise.explanation.examples.length > 0 ? (
        <div>
          <h3 className="font-semibold text-gray-950 dark:text-white">Examples</h3>
          <div className="mt-2 space-y-2">
            {exercise.explanation.examples.slice(0, 3).map((example) => (
              <div key={`${example.pl}-${example.en}`}>
                <p className="font-semibold text-gray-900 dark:text-white">{example.pl}</p>
                <p>{example.en}</p>
                {example.note ? <p className="text-xs text-gray-500 dark:text-gray-400">{example.note}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Notice({ tone, text }: { tone: 'success' | 'error' | 'warning' | 'info'; text: string }) {
  const toneClass =
    tone === 'success'
      ? 'border-accent-100 bg-accent-50 text-accent-600 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
      : tone === 'error'
      ? 'border-destructive-100 bg-destructive-50 text-destructive-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
      : tone === 'warning'
      ? 'border-warning-100 bg-warning-50 text-warning-600 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
      : 'border-info-100 bg-info-50 text-info-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300';

  return (
    <div className={`flex items-start gap-2 rounded-card border p-4 text-sm font-medium ${toneClass}`}>
      {tone === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : tone === 'error' ? <XCircle className="mt-0.5 h-4 w-4" /> : <Lightbulb className="mt-0.5 h-4 w-4" />}
      <span>{text}</span>
    </div>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-card border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
      <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{detail}</p>
    </div>
  );
}

function ProgressRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="font-semibold text-gray-950 dark:text-white">{value}</span>
    </div>
  );
}

function formatTokenHint(text: string, hintLevel: number): string {
  const letters = getLetters(text);
  if (hintLevel <= 1) {
    return `${letters.length} letters`;
  }

  return `${letters.length} letters, starts ${letters[0] ?? ''}`;
}

function formatHardHint(tokens: CurationToken[], hintLevel: number): string {
  const letterCounts = tokens.map((token) => getLetters(token.text).length).join(', ');

  if (hintLevel <= 1) {
    return `${tokens.length} words. Letter counts: ${letterCounts}.`;
  }

  const starts = tokens.map((token) => getLetters(token.text)[0] ?? '').join(' ');
  return `${tokens.length} words. Letter counts: ${letterCounts}. Starts: ${starts}.`;
}

function getLetters(text: string): string[] {
  return text.match(/\p{L}/gu) ?? [];
}

function favoriteWordId(selection: FillBlankTokenSelection): string {
  const targetKey = selection.language === 'pl' ? tokenPracticeKey(selection.token) : normalizePracticeText(selection.token.normalized || selection.token.text);
  return `word:${selection.language}:${targetKey}`;
}

function favoriteSentenceId(exercise: PooledFillBlankExercise): string {
  return `sentence:${sentenceStatId(exercise.poolSource, exercise.id)}`;
}

function countMatchesForSelection(selection: FillBlankTokenSelection, exercises: PooledFillBlankExercise[]): number {
  const targetKey = selection.language === 'pl' ? tokenPracticeKey(selection.token) : normalizePracticeText(selection.token.normalized || selection.token.text);
  const normalized = normalizePracticeText(selection.token.normalized || selection.token.text);

  return exercises.filter((exercise) => {
    if (selection.language === 'pl') {
      return exercise.polishTokens.some((token) => tokenPracticeKey(token) === targetKey || normalizePracticeText(token.normalized || token.text) === normalized);
    }

    return (
      exercise.englishTokens.some((token) => normalizePracticeText(token.normalized || token.text) === normalized) ||
      exercise.polishTokens.some((token) => normalizePracticeText(token.translation).includes(normalized))
    );
  }).length;
}
