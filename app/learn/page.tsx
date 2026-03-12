'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenText,
  ChartNoAxesColumn,
  CheckCircle2,
  Clock3,
  Flag,
  Gauge,
  Play,
  TrendingDown,
} from 'lucide-react';
import {
  getAllAttempts,
  getAllMistakes,
  getBookPathProgress,
  getUserPreferences,
  initializeDatabase,
  updateBookPathProgress,
  type AttemptWithId,
} from '@/lib/db';
import {
  DIFFICULTY_SEQUENCE,
  getDifficultySuccessRate,
  getHardestExercises,
  getHardestSections,
  getLatestMistakes,
  getNextDifficulty,
  getNextSectionId,
  getOverallMastery,
  getSectionMastery,
  getSequentialSections,
} from '@/lib/book/sequentialLearning';
import type { BookDifficulty } from '@/lib/book/flashcards';
import type { Mistake } from '@/types/progress';

const DIFFICULTY_LABELS: Record<BookDifficulty, string> = {
  level_1: 'Level 1 - Easy',
  level_2: 'Level 2 - Medium',
  level_3: 'Level 3 - Hard',
};

export default function LearnPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState<BookDifficulty>('level_1');
  const [attempts, setAttempts] = useState<AttemptWithId[]>([]);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [devModeEnabled, setDevModeEnabled] = useState(false);

  const sections = useMemo(() => getSequentialSections(), []);

  useEffect(() => {
    async function load() {
      await initializeDatabase();

      const [bookPath, allAttempts, allMistakes, preferences] = await Promise.all([
        getBookPathProgress(),
        getAllAttempts(),
        getAllMistakes(),
        getUserPreferences(),
      ]);

      let sectionId = bookPath.currentSectionId;
      const hasValidSection = sectionId && sections.some((section) => section.id === sectionId);
      if (!hasValidSection) {
        sectionId = sections[0]?.id ?? null;
        await updateBookPathProgress({ currentSectionId: sectionId });
      }

      setCurrentSectionId(sectionId);
      setCurrentDifficulty(bookPath.currentDifficulty);
      setAttempts(allAttempts);
      setMistakes(allMistakes);
      setDevModeEnabled(preferences.devModeEnabled ?? false);
      setLoading(false);
    }

    load();
  }, [sections]);

  const currentSection = useMemo(
    () => sections.find((section) => section.id === currentSectionId) ?? sections[0] ?? null,
    [sections, currentSectionId]
  );

  const sectionAttempts = useMemo(() => {
    if (!currentSection) {
      return [];
    }
    return attempts.filter((attempt) => attempt.topicId === currentSection.id);
  }, [attempts, currentSection]);

  const sectionMastery = useMemo(() => {
    if (!currentSection) {
      return { total: 0, mastered: 0, pendingCards: [] };
    }
    return getSectionMastery(currentSection.id, currentDifficulty, sectionAttempts);
  }, [currentSection, currentDifficulty, sectionAttempts]);

  const overallMastery = useMemo(() => getOverallMastery(currentDifficulty, attempts), [currentDifficulty, attempts]);
  const successRate = useMemo(() => getDifficultySuccessRate(currentDifficulty, attempts), [currentDifficulty, attempts]);

  const latestMistakes = useMemo(() => getLatestMistakes(mistakes, 5), [mistakes]);
  const hardestSections = useMemo(() => getHardestSections(mistakes, 5), [mistakes]);
  const hardestExercises = useMemo(() => getHardestExercises(mistakes, 5), [mistakes]);

  const nextSectionId = useMemo(() => getNextSectionId(currentSection?.id ?? null), [currentSection]);
  const nextDifficulty = useMemo(() => getNextDifficulty(currentDifficulty), [currentDifficulty]);

  const sectionProgressPercent = sectionMastery.total === 0 ? 0 : Math.round((sectionMastery.mastered / sectionMastery.total) * 100);
  const overallProgressPercent =
    overallMastery.total === 0 ? 0 : Math.round((overallMastery.mastered / overallMastery.total) * 100);

  const canMoveToNextSection =
    !!nextSectionId && (devModeEnabled || sectionMastery.mastered === sectionMastery.total);
  const canMoveToNextDifficulty =
    !!nextDifficulty &&
    (devModeEnabled || (sectionMastery.total > 0 && sectionMastery.mastered === sectionMastery.total));

  async function changeDifficulty(nextDifficulty: BookDifficulty) {
    if (nextDifficulty === currentDifficulty) {
      return;
    }

    const currentIndex = DIFFICULTY_SEQUENCE.indexOf(currentDifficulty);
    const nextIndex = DIFFICULTY_SEQUENCE.indexOf(nextDifficulty);

    if (nextIndex === -1) {
      return;
    }

    const isLower = nextIndex < currentIndex;

    if (!isLower && !canMoveToNextDifficulty && !devModeEnabled) {
      return;
    }

    await updateBookPathProgress({ currentDifficulty: nextDifficulty });
    setCurrentDifficulty(nextDifficulty);
  }

  async function moveToNextSection() {
    if (!canMoveToNextSection || !nextSectionId) {
      return;
    }

    await updateBookPathProgress({ currentSectionId: nextSectionId });
    setCurrentSectionId(nextSectionId);
  }

  async function moveToNextDifficulty() {
    if (!canMoveToNextDifficulty || !nextDifficulty) {
      return;
    }

    const firstSectionId = sections[0]?.id ?? null;
    await updateBookPathProgress({
      currentDifficulty: nextDifficulty,
      currentSectionId: firstSectionId,
    });

    setCurrentDifficulty(nextDifficulty);
    setCurrentSectionId(firstSectionId);
  }

  function resumeLearning() {
    router.push('/learn/session');
  }

  async function jumpToSection(sectionId: string) {
    await updateBookPathProgress({ currentSectionId: sectionId });
    setCurrentSectionId(sectionId);
  }

  async function jumpToDifficulty(nextDifficulty: BookDifficulty) {
    await updateBookPathProgress({ currentDifficulty: nextDifficulty });
    setCurrentDifficulty(nextDifficulty);
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center py-20">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading learning progress...</div>
      </div>
    );
  }

  if (!currentSection) {
    return (
      <div className="mx-auto max-w-5xl py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">No sections found</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Add section content first to start sequential learning.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-cyan-700 via-sky-700 to-teal-700 p-8 text-white shadow-xl">
        <h1 className="text-3xl font-bold sm:text-4xl">Sequential Learning</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/90 sm:text-base">
          You progress section-by-section and difficulty-by-difficulty. Master the current section to unlock the next
          one, and master all sections to unlock the next difficulty level.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Current Section" value={currentSection.label} icon={Flag} />
        <StatCard label="Current Difficulty" value={DIFFICULTY_LABELS[currentDifficulty]} icon={Gauge} />
        <StatCard label="Section Progress" value={`${sectionProgressPercent}%`} icon={ChartNoAxesColumn} />
        <StatCard label="Overall Progress" value={`${overallProgressPercent}%`} icon={CheckCircle2} />
        <StatCard label="Success Rate" value={`${successRate}%`} icon={TrendingDown} />
      </section>

      <section className="rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50 p-6 shadow-sm dark:border-cyan-800 dark:from-cyan-950/20 dark:to-sky-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
              <BookOpenText className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
              Flashcards
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Practice book vocabulary by topic, random, difficulty placeholder, or your own custom decks.
            </p>
          </div>
          <button
            onClick={() => router.push('/learn/flashcards')}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700"
          >
            Open Flashcards
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr,auto] lg:items-center">
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Section completion: {sectionMastery.mastered} / {sectionMastery.total} exercises mastered
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div className="h-full bg-cyan-500" style={{ width: `${sectionProgressPercent}%` }} />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Difficulty completion: {overallMastery.masteredSections} / {overallMastery.totalSections} sections mastered at{' '}
              {DIFFICULTY_LABELS[currentDifficulty]}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full bg-emerald-500"
                style={{
                  width:
                    overallMastery.totalSections === 0
                      ? '0%'
                      : `${Math.round((overallMastery.masteredSections / overallMastery.totalSections) * 100)}%`,
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-200">
              <span className="font-semibold">Section difficulty:</span>
              <select
                value={currentDifficulty}
                onChange={(event) => {
                  void changeDifficulty(event.target.value as BookDifficulty);
                }}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                {DIFFICULTY_SEQUENCE.map((difficultyOption) => (
                  <option key={difficultyOption} value={difficultyOption}>
                    {DIFFICULTY_LABELS[difficultyOption]}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={resumeLearning}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700"
            >
              <Play className="h-4 w-4" />
              Resume
            </button>

            <button
              onClick={moveToNextSection}
              disabled={!canMoveToNextSection}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Next Section
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              onClick={moveToNextDifficulty}
              disabled={!canMoveToNextDifficulty}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Next Difficulty
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!canMoveToNextSection && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            You can move to the next section after mastering all exercises in the current section.
          </p>
        )}

        {!canMoveToNextDifficulty && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            You can move to the next difficulty for this section after mastering all its exercises at{' '}
            {DIFFICULTY_LABELS[currentDifficulty]}.
          </p>
        )}

        {devModeEnabled && (
          <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-300">
            Dev mode is ON: progression gates are bypassed for testing.
          </p>
        )}
      </section>

      {devModeEnabled && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">Developer Controls</h2>
          <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-300/90">
            Jump directly to any section and difficulty for QA/testing.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Section
              </span>
              <select
                value={currentSection.id}
                onChange={(event) => {
                  void jumpToSection(event.target.value);
                }}
                className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-amber-700 dark:bg-gray-900 dark:text-gray-100"
              >
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Difficulty
              </span>
              <select
                value={currentDifficulty}
                onChange={(event) => {
                  void jumpToDifficulty(event.target.value as BookDifficulty);
                }}
                className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-amber-700 dark:bg-gray-900 dark:text-gray-100"
              >
                {DIFFICULTY_SEQUENCE.map((difficultyOption) => (
                  <option key={difficultyOption} value={difficultyOption}>
                    {DIFFICULTY_LABELS[difficultyOption]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <InfoPanel title="Latest Mistakes" icon={AlertTriangle}>
          {latestMistakes.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No mistakes yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {latestMistakes.map((mistake) => (
                <li key={mistake.id} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/50">
                  <p className="font-medium text-gray-900 dark:text-white">{mistake.exerciseId}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(mistake.timestamp).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </InfoPanel>

        <InfoPanel title="Hardest Sections" icon={Flag}>
          {hardestSections.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No section difficulty data yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {hardestSections.map((section) => (
                <li key={section.sectionId} className="flex items-center justify-between rounded-xl bg-gray-50 p-3 dark:bg-gray-900/50">
                  <span className="text-gray-800 dark:text-gray-100">{section.sectionLabel}</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-300">{section.count}</span>
                </li>
              ))}
            </ul>
          )}
        </InfoPanel>

        <InfoPanel title="Hardest Exercises" icon={Clock3}>
          {hardestExercises.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No exercise difficulty data yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {hardestExercises.map((exercise) => (
                <li key={exercise.exerciseId} className="flex items-center justify-between rounded-xl bg-gray-50 p-3 dark:bg-gray-900/50">
                  <span className="truncate text-gray-800 dark:text-gray-100">{exercise.exerciseId}</span>
                  <span className="ml-2 font-semibold text-rose-600 dark:text-rose-300">{exercise.count}</span>
                </li>
              ))}
            </ul>
          )}
        </InfoPanel>
      </section>

      {currentDifficulty === DIFFICULTY_SEQUENCE[DIFFICULTY_SEQUENCE.length - 1] &&
        overallMastery.masteredSections === overallMastery.totalSections && (
          <section className="rounded-3xl border border-emerald-300 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-900/20">
            <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">All sections mastered on all difficulties.</p>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
              You completed the sequential learning path. You can continue practicing by resuming sessions.
            </p>
          </section>
        )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function InfoPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
        <Icon className="h-5 w-5 text-cyan-600" />
        {title}
      </h3>
      {children}
    </div>
  );
}

