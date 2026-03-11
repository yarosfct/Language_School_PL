'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookText, CheckCircle2, Clock3, Lightbulb, RotateCcw, Target, X, XCircle } from 'lucide-react';
import { ExerciseRenderer } from '@/components/exercises/ExerciseRenderer';
import { evaluateAnswer, type EvaluationResult } from '@/lib/exercises/evaluators';
import { buildExerciseFromBookCard, type BookDifficulty, type BookSentenceCard } from '@/lib/book/flashcards';
import {
  getSectionCards,
  getSectionMastery,
  getSequentialSections,
} from '@/lib/book/sequentialLearning';
import {
  getSectionContent,
  getTipsForSentenceCard,
  type SectionContent,
} from '@/lib/book/sectionContent';
import {
  getBookPathProgress,
  getTopicAttempts,
  incrementTodayExercise,
  initializeDatabase,
  saveAttempt,
  saveMistake,
  updateBookPathProgress,
  updateStreak,
} from '@/lib/db';
import { generateId } from '@/lib/utils/string';

const DIFFICULTY_LABELS: Record<BookDifficulty, string> = {
  level_1: 'Level 1',
  level_2: 'Level 2',
  level_3: 'Level 3',
};

interface SessionStats {
  answered: number;
  correct: number;
  totalTimeMs: number;
}

const EMPTY_STATS: SessionStats = {
  answered: 0,
  correct: 0,
  totalTimeMs: 0,
};

type SessionStage = 'intro_words' | 'intro_tips' | 'exercise';
type OverlayTab = 'words' | 'tips' | null;

export default function LearnSessionPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<BookDifficulty>('level_1');
  const [sectionCards, setSectionCards] = useState<BookSentenceCard[]>([]);
  const [pendingCards, setPendingCards] = useState<BookSentenceCard[]>([]);
  const [sectionContent, setSectionContent] = useState<SectionContent | null>(null);
  const [sessionStage, setSessionStage] = useState<SessionStage>('intro_words');
  const [overlayTab, setOverlayTab] = useState<OverlayTab>(null);
  const [showTipTooltip, setShowTipTooltip] = useState(false);

  const [showFeedback, setShowFeedback] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS);
  const [exerciseStartedAt, setExerciseStartedAt] = useState<number>(Date.now());

  const sections = useMemo(() => getSequentialSections(), []);
  const currentSection = useMemo(
    () => sections.find((section) => section.id === sectionId) ?? sections[0] ?? null,
    [sections, sectionId]
  );

  const currentCard = pendingCards[0] ?? null;

  const currentExercise = useMemo(() => {
    if (!currentCard) {
      return null;
    }

    return buildExerciseFromBookCard(currentCard, {
      difficulty,
      availableCards: sectionCards,
    });
  }, [currentCard, difficulty, sectionCards]);

  const contextualTips = useMemo(() => {
    if (!currentCard || !sectionContent || sectionContent.tips.length === 0) {
      return [];
    }

    return getTipsForSentenceCard(currentCard, sectionContent.tips, 2);
  }, [currentCard, sectionContent]);

  useEffect(() => {
    setShowTipTooltip(false);
  }, [currentExercise?.id]);

  const masteredCount = sectionCards.length - pendingCards.length;
  const sectionProgressPercent = sectionCards.length === 0 ? 0 : Math.round((masteredCount / sectionCards.length) * 100);
  const accuracy = stats.answered === 0 ? 0 : Math.round((stats.correct / stats.answered) * 100);

  useEffect(() => {
    async function loadSession() {
      setLoading(true);

      await initializeDatabase();
      const bookPath = await getBookPathProgress();

      let nextSectionId = bookPath.currentSectionId;
      if (!nextSectionId || !sections.some((section) => section.id === nextSectionId)) {
        nextSectionId = sections[0]?.id ?? null;
      }

      if (!nextSectionId) {
        setLoading(false);
        return;
      }

      await updateBookPathProgress({
        currentSectionId: nextSectionId,
        currentDifficulty: bookPath.currentDifficulty,
      });

      const nextSectionCards = getSectionCards(nextSectionId);
      const nextSectionContent = getSectionContent(nextSectionId);
      const sectionAttempts = await getTopicAttempts(nextSectionId);
      const mastery = getSectionMastery(nextSectionId, bookPath.currentDifficulty, sectionAttempts);

      setSectionId(nextSectionId);
      setDifficulty(bookPath.currentDifficulty);
      setSectionCards(nextSectionCards);
      setPendingCards(mastery.pendingCards);
      setSectionContent(nextSectionContent);
      setShowFeedback(false);
      setEvaluationResult(null);
      setStats(EMPTY_STATS);
      setExerciseStartedAt(Date.now());
      setOverlayTab(null);
      if (mastery.pendingCards.length === 0) {
        setSessionStage('exercise');
      } else if (nextSectionContent.usefulWords.length > 0) {
        setSessionStage('intro_words');
      } else if (nextSectionContent.tips.length > 0) {
        setSessionStage('intro_tips');
      } else {
        setSessionStage('exercise');
      }
      setLoading(false);
    }

    loadSession();
  }, [sections]);

  async function handleSubmit(answer: unknown) {
    if (!currentExercise || !currentSection || !currentCard || showFeedback) {
      return;
    }

    const timeSpent = Date.now() - exerciseStartedAt;
    const result = evaluateAnswer(currentExercise, answer);

    setEvaluationResult(result);
    setShowFeedback(true);
    setStats((previous) => ({
      answered: previous.answered + 1,
      correct: previous.correct + (result.correct ? 1 : 0),
      totalTimeMs: previous.totalTimeMs + timeSpent,
    }));

    await saveAttempt(
      currentExercise.id,
      {
        timestamp: Date.now(),
        correct: result.correct,
        answer,
        timeSpent,
        hintsUsed: 0,
        errorTags: result.errorType ? [result.errorType] : undefined,
      },
      currentSection.id
    );

    await incrementTodayExercise(result.correct, currentSection.id);

    if (!result.correct || result.partialCorrect) {
      await saveMistake({
        id: generateId(),
        exerciseId: currentExercise.id,
        topicId: currentSection.id,
        timestamp: Date.now(),
        userAnswer: answer,
        correctAnswer: currentExercise.solution,
        tags: currentExercise.tags,
        errorType: result.errorType,
        reviewed: false,
      });
    }

    await updateStreak();
  }

  function nextCard() {
    if (!currentCard || !evaluationResult) {
      return;
    }

    setPendingCards((previous) => {
      if (previous.length === 0) {
        return previous;
      }

      const [first, ...rest] = previous;

      if (evaluationResult.correct) {
        return rest;
      }

      return [...rest, first];
    });

    setShowFeedback(false);
    setEvaluationResult(null);
    setExerciseStartedAt(Date.now());
  }

  function restartSection() {
    setPendingCards(sectionCards);
    setShowFeedback(false);
    setEvaluationResult(null);
    setStats(EMPTY_STATS);
    setExerciseStartedAt(Date.now());
    setSessionStage('exercise');
    setOverlayTab(null);
    setShowTipTooltip(false);
  }

  function openWords() {
    setShowTipTooltip(false);
    setOverlayTab('words');
  }

  function openTips() {
    setShowTipTooltip(false);
    setOverlayTab('tips');
  }

  function closeOverlay() {
    setOverlayTab(null);
  }

  function startExercises() {
    setSessionStage('exercise');
  }

  function continueFromWords() {
    if (sectionContent && sectionContent.tips.length > 0) {
      setSessionStage('intro_tips');
      return;
    }

    setSessionStage('exercise');
  }

  function backToWords() {
    if (sectionContent && sectionContent.usefulWords.length > 0) {
      setSessionStage('intro_words');
      return;
    }

    setSessionStage('exercise');
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center py-24">
        <div className="text-lg text-gray-600 dark:text-gray-400">Preparing section session...</div>
      </div>
    );
  }

  if (!currentSection) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">No section selected</h1>
        <button
          onClick={() => router.push('/learn')}
          className="mt-4 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700"
        >
          Back to Learn
        </button>
      </div>
    );
  }

  if (sectionCards.length === 0) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">No sentence exercises in this section</h1>
        <button
          onClick={() => router.push('/learn')}
          className="mt-4 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700"
        >
          Back to Learn
        </button>
      </div>
    );
  }

  if (sessionStage === 'intro_words' && sectionContent) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-cyan-700 to-sky-700 p-8 text-white shadow-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium">
            <BookText className="h-4 w-4" />
            Section briefing
          </div>
          <h1 className="mt-3 text-3xl font-bold">{currentSection.label}</h1>
          <p className="mt-2 text-white/90">Start with useful words for this section before exercises.</p>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Useful Words</h2>
          <WordsPanel words={sectionContent.usefulWords} />
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/learn"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Learn
          </Link>
          <button
            onClick={continueFromWords}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white hover:bg-cyan-700"
          >
            {sectionContent.tips.length > 0 ? 'Continue to Tips' : 'Start Exercises'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (sessionStage === 'intro_tips' && sectionContent) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-sky-700 to-indigo-700 p-8 text-white shadow-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium">
            <Lightbulb className="h-4 w-4" />
            Section tips
          </div>
          <h1 className="mt-3 text-3xl font-bold">{currentSection.label}</h1>
          <p className="mt-2 text-white/90">Review these tips now. Relevant tips will also appear during exercises.</p>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Tips</h2>
          <TipsPanel tips={sectionContent.tips} />
        </section>

        <div className="flex flex-wrap gap-3">
          {sectionContent.usefulWords.length > 0 && (
            <button
              onClick={backToWords}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Words
            </button>
          )}
          <button
            onClick={startExercises}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white hover:bg-cyan-700"
          >
            Start Exercises
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!currentCard || !currentExercise) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-emerald-600 to-cyan-700 p-8 text-white shadow-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Section mastered
          </div>
          <h1 className="mt-3 text-3xl font-bold">{currentSection.label}</h1>
          <p className="mt-2 text-white/90">
            You mastered every exercise for {DIFFICULTY_LABELS[difficulty]} in this section.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:grid-cols-3 dark:border-gray-700 dark:bg-gray-800">
          <SummaryStat label="Solved" value={`${sectionCards.length}/${sectionCards.length}`} />
          <SummaryStat label="Accuracy" value={`${accuracy}%`} />
          <SummaryStat label="Time" value={`${Math.max(1, Math.round(stats.totalTimeMs / 60000))} min`} />
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/learn"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white hover:bg-cyan-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Learn
          </Link>
          <button
            onClick={restartSection}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RotateCcw className="h-4 w-4" />
            Practice Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {currentSection.label} - {DIFFICULTY_LABELS[difficulty]}
            </p>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Remaining exercises: {pendingCards.length}
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat icon={Target} label="Progress" value={`${sectionProgressPercent}%`} />
            <MiniStat icon={CheckCircle2} label="Correct" value={stats.correct} />
            <MiniStat icon={XCircle} label="Misses" value={stats.answered - stats.correct} />
            <MiniStat icon={Clock3} label="Time" value={`${Math.max(1, Math.round(stats.totalTimeMs / 60000))}m`} />
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${sectionProgressPercent}%` }} />
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Sequential exercise flow
            </p>
            {currentExercise.type === 'ordering' && (
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{currentExercise.question}</h2>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {contextualTips.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowTipTooltip((previous) => !previous)}
                  className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                >
                  <Lightbulb className="h-4 w-4" />
                  Exercise Tip
                </button>
                {showTipTooltip && (
                  <div className="absolute right-0 z-20 mt-2 w-[26rem] max-w-[80vw] rounded-xl border border-amber-200 bg-white p-3 shadow-xl dark:border-amber-700 dark:bg-gray-900">
                    <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                      {contextualTips.map((tip) => (
                        <div key={tip.id} className="rounded-lg bg-amber-50 p-2 dark:bg-amber-900/20">
                          <p>{tip.content}</p>
                          {tip.examples.length > 0 && (
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                              Example: {tip.examples[0]}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={openWords}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <BookText className="h-4 w-4" />
              Words
            </button>
            <button
              onClick={openTips}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Lightbulb className="h-4 w-4" />
              Tips
            </button>
            <Link
              href="/learn"
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Exit
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/40">
          <ExerciseRenderer
            key={`${currentExercise.id}-${pendingCards.length}`}
            exercise={currentExercise}
            onSubmit={handleSubmit}
            showFeedback={showFeedback}
            feedbackMessage={evaluationResult?.feedback}
            isCorrect={evaluationResult?.correct}
            partialCorrect={evaluationResult?.partialCorrect}
            autoPlayTTS={false}
            referenceAnswerText={currentCard.answerPl}
            referenceSectionId={currentSection.id}
          />
        </div>

        {showFeedback && (
          <div className="mt-5 flex justify-end">
            <button
              onClick={nextCard}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white hover:bg-cyan-700"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
        <p>
          Wrong answers rotate to the end of the queue and appear again until solved. A section is mastered when there
          are no remaining exercises.
        </p>
      </section>

      {overlayTab && sectionContent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={closeOverlay}
        >
          <div
            className="w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {overlayTab === 'words' ? 'Useful Words' : 'Section Tips'}
              </h3>
              <button
                onClick={closeOverlay}
                className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                aria-label="Close popup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {overlayTab === 'words' ? (
              <WordsPanel words={sectionContent.usefulWords} />
            ) : (
              <TipsPanel tips={sectionContent.tips} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center dark:border-gray-700 dark:bg-gray-900/40">
      <div className="mb-1 flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-center dark:border-gray-700 dark:bg-gray-900/40">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function WordsPanel({ words, compact = false }: { words: SectionContent['usefulWords']; compact?: boolean }) {
  if (words.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No useful words available for this section.</p>;
  }

  return (
    <div className={compact ? 'max-h-56 space-y-2 overflow-auto pr-1' : 'max-h-[28rem] space-y-2 overflow-auto pr-1'}>
      {words.map((word) => (
        <div key={word.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/50">
          <p className="font-semibold text-gray-900 dark:text-white">{word.polish}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">{word.english.join(', ')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{word.partOfSpeech}</p>
        </div>
      ))}
    </div>
  );
}

function TipsPanel({ tips, compact = false }: { tips: SectionContent['tips']; compact?: boolean }) {
  if (tips.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No tips available for this section.</p>;
  }

  return (
    <div className={compact ? 'max-h-56 space-y-3 overflow-auto pr-1' : 'max-h-[28rem] space-y-3 overflow-auto pr-1'}>
      {tips.map((tip, index) => (
        <div key={tip.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Tip {index + 1}</p>
          <p className="mt-1 text-sm text-gray-800 dark:text-gray-100">{tip.content}</p>
          {tip.examples.length > 0 && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">Examples: {tip.examples.join(' | ')}</p>
          )}
        </div>
      ))}
    </div>
  );
}
