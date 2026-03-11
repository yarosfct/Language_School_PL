'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Clock3, RefreshCw, RotateCcw } from 'lucide-react';
import { DiacriticsKeyboard } from '@/components/ui/DiacriticsKeyboard';
import {
  getCustomFlashcardSet,
  incrementTodayExercise,
  initializeDatabase,
  saveAttempt,
  saveMistake,
  updateStreak,
} from '@/lib/db';
import {
  evaluateFlashcardWriting,
  getAllBookFlashcards,
  getInitialDeck,
  getTopicFlashcards,
  mapCustomSetToPracticeCards,
  shouldEndSession,
  type FlashcardSessionConfig,
  type FlashcardAnswerResult,
} from '@/lib/flashcards/practice';
import { generateId, shuffle } from '@/lib/utils/string';
import type { FlashcardPracticeCard } from '@/types/flashcards';

type SessionStage = 'initial' | 'retry' | 'random';

interface SessionStats {
  shown: number;
  correct: number;
  partial: number;
  wrong: number;
}

const EMPTY_STATS: SessionStats = {
  shown: 0,
  correct: 0,
  partial: 0,
  wrong: 0,
};

export default function FlashcardsSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const failedFirstPassRef = useRef<Set<string>>(new Set());
  const allCardsByIdRef = useRef<Map<string, FlashcardPracticeCard>>(new Map());

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<FlashcardSessionConfig | null>(null);
  const [poolCards, setPoolCards] = useState<FlashcardPracticeCard[]>([]);
  const [queue, setQueue] = useState<FlashcardPracticeCard[]>([]);
  const [stage, setStage] = useState<SessionStage>('initial');
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<FlashcardAnswerResult | null>(null);
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS);
  const [isFlipped, setIsFlipped] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState(Date.now());

  const currentCard = queue[0] ?? null;

  useEffect(() => {
    async function load() {
      setLoading(true);
      await initializeDatabase();

      const parsedConfig = parseConfig(searchParams);
      if (!parsedConfig) {
        setLoading(false);
        return;
      }

      const cards = await resolveCardsForConfig(parsedConfig);
      const initialDeck = getInitialDeck(parsedConfig, cards);
      const cardMap = new Map(cards.map((card) => [card.id, card]));

      failedFirstPassRef.current = new Set();
      allCardsByIdRef.current = cardMap;

      setConfig(parsedConfig);
      setPoolCards(cards);
      setQueue(initialDeck);
      setStage('initial');
      setAnswer('');
      setSubmitted(false);
      setResult(null);
      setStats(EMPTY_STATS);
      setIsFlipped(false);
      setSessionStartedAt(Date.now());
      setSessionFinished(false);

      if (parsedConfig.limitType === 'time') {
        setTimeLeftMs(Math.max(60_000, (parsedConfig.timeLimitMinutes ?? 10) * 60_000));
      } else {
        setTimeLeftMs(0);
      }

      setLoading(false);
    }

    load();
  }, [searchParams]);

  useEffect(() => {
    if (!config || config.limitType !== 'time' || sessionFinished || loading) {
      return;
    }

    const startedAt = sessionStartedAt;
    const durationMs = Math.max(60_000, (config.timeLimitMinutes ?? 10) * 60_000);

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextTimeLeft = Math.max(0, durationMs - elapsed);
      setTimeLeftMs(nextTimeLeft);

      if (nextTimeLeft <= 0) {
        setSessionFinished(true);
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [config, sessionFinished, loading, sessionStartedAt]);

  useEffect(() => {
    setAnswer('');
    setSubmitted(false);
    setResult(null);
    setIsFlipped(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentCard?.id]);

  async function handleSubmit() {
    if (!currentCard || submitted || !answer.trim()) {
      return;
    }

    const evaluation = evaluateFlashcardWriting(answer, currentCard);
    setSubmitted(true);
    setResult(evaluation);
    setIsFlipped(true);

    setStats((previous) => ({
      shown: previous.shown + 1,
      correct: previous.correct + (evaluation.correct ? 1 : 0),
      partial: previous.partial + (evaluation.partialCorrect ? 1 : 0),
      wrong: previous.wrong + (evaluation.correct ? 0 : 1),
    }));

    await saveAttempt(
      `flashcard-${currentCard.id}`,
      {
        timestamp: Date.now(),
        correct: evaluation.correct,
        answer,
        timeSpent: 0,
        hintsUsed: 0,
        errorTags: evaluation.errorType ? [evaluation.errorType] : undefined,
      },
      currentCard.topicId
    );

    await incrementTodayExercise(evaluation.correct, currentCard.topicId);
    await updateStreak();

    if (!evaluation.correct || evaluation.partialCorrect) {
      await saveMistake({
        id: generateId(),
        exerciseId: `flashcard-${currentCard.id}`,
        topicId: currentCard.topicId,
        timestamp: Date.now(),
        userAnswer: answer,
        correctAnswer: currentCard.answer,
        tags: [
          { type: 'topic', value: 'flashcards' },
          { type: 'topic', value: currentCard.topicId },
        ],
        errorType: evaluation.errorType ?? 'spelling',
        reviewed: false,
      });
    }
  }

  function moveNext() {
    if (!config || !currentCard || !result) {
      return;
    }

    if (stage === 'initial' && !result.correct) {
      failedFirstPassRef.current.add(currentCard.id);
    }

    const remaining = queue.slice(1);

    if (remaining.length > 0) {
      setQueue(remaining);
      return;
    }

    if (stage === 'initial') {
      const retryCards = [...failedFirstPassRef.current]
        .map((id) => allCardsByIdRef.current.get(id))
        .filter((card): card is FlashcardPracticeCard => !!card);

      if (retryCards.length > 0) {
        setStage('retry');
        setQueue(shuffle(retryCards));
        return;
      }
    }

    if (stage === 'initial' || stage === 'retry') {
      const willEndNow = shouldEndSession(config, stats.shown, timeLeftMs);
      if (willEndNow) {
        setSessionFinished(true);
        setQueue([]);
        return;
      }

      setStage('random');
      setQueue(shuffle(poolCards));
      return;
    }

    const shouldEnd = shouldEndSession(config, stats.shown, timeLeftMs);
    if (shouldEnd) {
      setSessionFinished(true);
      setQueue([]);
      return;
    }

    setQueue(shuffle(poolCards));
  }

  function insertDiacritic(char: string) {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const nextValue = answer.slice(0, start) + char + answer.slice(end);
    setAnswer(nextValue);

    window.setTimeout(() => {
      input.setSelectionRange(start + 1, start + 1);
      input.focus();
    }, 0);
  }

  function resetSession() {
    if (!config) {
      return;
    }
    const initialDeck = getInitialDeck(config, poolCards);
    failedFirstPassRef.current = new Set();
    setQueue(initialDeck);
    setStage('initial');
    setAnswer('');
    setSubmitted(false);
    setResult(null);
    setStats(EMPTY_STATS);
    setIsFlipped(false);
    setSessionFinished(false);
    setSessionStartedAt(Date.now());
  }

  const progressValue = useMemo(() => {
    if (!config || config.limitType !== 'count') {
      return null;
    }
    const target = Math.max(1, config.targetCount ?? 20);
    return Math.min(100, Math.round((stats.shown / target) * 100));
  }, [config, stats.shown]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center py-24">
        <div className="text-lg text-gray-600 dark:text-gray-400">Preparing flashcard session...</div>
      </div>
    );
  }

  if (!config || poolCards.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">No flashcards available</h1>
        <p className="text-gray-600 dark:text-gray-400">
          This mode does not have available cards yet. Try another mode or create a custom set.
        </p>
        <button
          onClick={() => router.push('/learn/flashcards')}
          className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700"
        >
          Back to Flashcards Setup
        </button>
      </div>
    );
  }

  if (sessionFinished || !currentCard) {
    const accuracy = stats.shown === 0 ? 0 : Math.round((stats.correct / stats.shown) * 100);
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-emerald-600 to-cyan-700 p-8 text-white shadow-xl">
          <h1 className="text-3xl font-bold">Session Complete</h1>
          <p className="mt-2 text-white/90">Nice work. You can run another flashcard session anytime.</p>
        </section>

        <section className="grid grid-cols-1 gap-3 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-4 dark:border-gray-700 dark:bg-gray-800">
          <SummaryChip label="Shown" value={stats.shown} />
          <SummaryChip label="Correct" value={stats.correct} />
          <SummaryChip label="Warnings" value={stats.partial} />
          <SummaryChip label="Accuracy" value={`${accuracy}%`} />
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={resetSession}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white hover:bg-cyan-700"
          >
            <RotateCcw className="h-4 w-4" />
            Restart Session
          </button>
          <Link
            href="/learn/flashcards"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Setup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Flashcards • {currentCard.topicLabel}
            </p>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Stage: {stage === 'initial' ? 'First Pass' : stage === 'retry' ? 'Second Chance' : 'Free Practice'}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span className="rounded-lg bg-gray-100 px-3 py-1 dark:bg-gray-700">Shown: {stats.shown}</span>
            <span className="rounded-lg bg-gray-100 px-3 py-1 dark:bg-gray-700">Correct: {stats.correct}</span>
            {config.limitType === 'time' && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1 dark:bg-gray-700">
                <Clock3 className="h-4 w-4" />
                {formatClock(timeLeftMs)}
              </span>
            )}
          </div>
        </div>

        {progressValue !== null && (
          <div className="mt-4">
            <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              Target progress: {stats.shown} / {Math.max(1, config.targetCount ?? 20)}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${progressValue}%` }} />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Type the translation</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFlipped((previous) => !previous)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4" />
              Flip
            </button>
            <Link
              href="/learn/flashcards"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Exit
            </Link>
          </div>
        </div>

        <div className="mb-5" style={{ perspective: '1200px' }}>
          <div
            className="relative h-64 w-full transition-transform duration-700"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            <div
              className="absolute inset-0 rounded-2xl border border-cyan-300 bg-gradient-to-br from-cyan-100 via-white to-sky-100 p-6 dark:border-cyan-700 dark:from-cyan-900/40 dark:via-gray-900 dark:to-sky-900/40"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Front</p>
              <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{currentCard.prompt}</p>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Write the Polish translation below.</p>
            </div>

            <div
              className="absolute inset-0 rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-100 via-white to-cyan-100 p-6 dark:border-emerald-700 dark:from-emerald-900/40 dark:via-gray-900 dark:to-cyan-900/40"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Back</p>
              <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{currentCard.answer}</p>
              {result && (
                <p
                  className={`mt-3 text-sm font-medium ${
                    result.partialCorrect
                      ? 'text-amber-700 dark:text-amber-300'
                      : result.correct
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {result.partialCorrect
                    ? 'Accepted with warning'
                    : result.correct
                    ? 'Correct'
                    : 'Try to remember this one for next time'}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <input
            ref={inputRef}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={submitted}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !submitted && answer.trim()) {
                void handleSubmit();
              }
            }}
            placeholder="Type in Polish..."
            className="w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />

          <div className="flex justify-center">
            <DiacriticsKeyboard onCharacter={insertDiacritic} compact className="diacritics-keyboard" />
          </div>

          {result && (
            <div
              className={`rounded-xl p-3 text-sm ${
                result.partialCorrect
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                  : result.correct
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-300'
              }`}
            >
              {result.feedback ?? (result.correct ? 'Correct!' : `Expected: ${currentCard.answer}`)}
            </div>
          )}

          {!submitted ? (
            <button
              onClick={() => void handleSubmit()}
              disabled={!answer.trim()}
              className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={moveNext}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-700"
            >
              Next Card
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function parseConfig(searchParams: ReturnType<typeof useSearchParams>): FlashcardSessionConfig | null {
  const modeParam = searchParams.get('mode');
  if (modeParam !== 'topic' && modeParam !== 'random' && modeParam !== 'difficulty' && modeParam !== 'custom') {
    return null;
  }

  const limitTypeParam = searchParams.get('limitType');
  const limitType = limitTypeParam === 'time' ? 'time' : 'count';
  const targetCount = Number(searchParams.get('count') ?? 20);
  const timeLimitMinutes = Number(searchParams.get('minutes') ?? 10);

  return {
    mode: modeParam,
    topicId: searchParams.get('topicId') ?? undefined,
    customSetId: searchParams.get('customSetId') ?? undefined,
    limitType,
    targetCount: Number.isFinite(targetCount) ? targetCount : 20,
    timeLimitMinutes: Number.isFinite(timeLimitMinutes) ? timeLimitMinutes : 10,
  };
}

async function resolveCardsForConfig(config: FlashcardSessionConfig): Promise<FlashcardPracticeCard[]> {
  if (config.mode === 'topic') {
    if (!config.topicId) {
      return [];
    }
    return getTopicFlashcards(config.topicId);
  }

  if (config.mode === 'random' || config.mode === 'difficulty') {
    return getAllBookFlashcards();
  }

  if (config.mode === 'custom') {
    if (!config.customSetId) {
      return [];
    }
    const set = await getCustomFlashcardSet(config.customSetId);
    if (!set) {
      return [];
    }
    return mapCustomSetToPracticeCards(set);
  }

  return [];
}

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function SummaryChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-center dark:border-gray-700 dark:bg-gray-900/40">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
