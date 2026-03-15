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
  Lock,
  Play,
  TrendingDown,
} from 'lucide-react';
import { Badge, Button, Card, PageHeader, SectionTitle, Select } from '@/components/ui/primitives';
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

const DIFFICULTY_SHORT_LABELS: Record<BookDifficulty, string> = {
  level_1: 'Easy',
  level_2: 'Medium',
  level_3: 'Hard',
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
  const currentDifficultyIndex = DIFFICULTY_SEQUENCE.indexOf(currentDifficulty);

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

  function canSelectDifficulty(targetDifficulty: BookDifficulty) {
    const targetIndex = DIFFICULTY_SEQUENCE.indexOf(targetDifficulty);
    if (targetIndex === -1) {
      return false;
    }

    if (devModeEnabled || targetIndex <= currentDifficultyIndex) {
      return true;
    }

    return targetIndex === currentDifficultyIndex + 1 && canMoveToNextDifficulty;
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
    <div className="space-y-6">
      <section>
        <PageHeader
          title="Sequential Learning"
          description="Progress section-by-section and difficulty-by-difficulty with clear mastery gates."
          actions={<Badge tone="primary">{DIFFICULTY_LABELS[currentDifficulty]}</Badge>}
        />
        <Card className="border-gray-200 bg-white dark:bg-gray-800">
          <div className="flex flex-wrap items-start gap-3">
            <div className="mt-1 h-12 w-1 rounded-full bg-primary-500" />
            <p className="max-w-3xl text-sm text-gray-700 dark:text-gray-200 sm:text-base">
              You unlock progress in a clear path: master your current section, move forward, and then advance
              difficulty level by level.
            </p>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Current Section" value={currentSection.label} icon={Flag} />
        <StatCard label="Current Difficulty" value={DIFFICULTY_LABELS[currentDifficulty]} icon={Gauge} />
        <StatCard label="Section Progress" value={`${sectionProgressPercent}%`} icon={ChartNoAxesColumn} />
        <StatCard label="Overall Progress" value={`${overallProgressPercent}%`} icon={CheckCircle2} />
        <StatCard label="Success Rate" value={`${successRate}%`} icon={TrendingDown} />
      </section>

      <Card className="border-primary-100 dark:border-primary-900/40 bg-white dark:bg-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                <BookOpenText className="h-5 w-5" />
              </span>
              Flashcards
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Practice book vocabulary by topic, random, difficulty placeholder, or your own custom decks.
            </p>
          </div>
          <Button
            onClick={() => router.push('/learn/flashcards')}
            variant="primary"
          >
            Open Flashcards
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr,auto] lg:items-center">
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Section completion: {sectionMastery.mastered} / {sectionMastery.total} exercises mastered
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div className="h-full bg-primary-500" style={{ width: `${sectionProgressPercent}%` }} />
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
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/30">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Difficulty
              </p>
              <div className="mt-2 inline-flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
                {DIFFICULTY_SEQUENCE.map((difficultyOption) => {
                  const isActive = currentDifficulty === difficultyOption;
                  const isSelectable = canSelectDifficulty(difficultyOption);

                  return (
                    <button
                      key={difficultyOption}
                      type="button"
                      onClick={() => void changeDifficulty(difficultyOption)}
                      disabled={!isSelectable}
                      className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-default ease-subtle ${
                        isActive
                          ? 'bg-primary-500 text-white'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                      } disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      {!isSelectable && <Lock className="h-3 w-3" />}
                      {DIFFICULTY_SHORT_LABELS[difficultyOption]}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={resumeLearning}
              variant="primary"
            >
              <Play className="h-4 w-4" />
              Resume
            </Button>

            <Button
              onClick={moveToNextSection}
              disabled={!canMoveToNextSection}
              variant="secondary"
            >
              Next Section
              <ArrowRight className="h-4 w-4" />
            </Button>

            <Button
              onClick={moveToNextDifficulty}
              disabled={!canMoveToNextDifficulty}
              variant="secondary"
            >
              Next Difficulty
              <ArrowRight className="h-4 w-4" />
            </Button>
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
      </Card>

      {devModeEnabled && (
        <Card accent="warning" className="bg-warning-50 dark:bg-amber-900/20">
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">Developer Controls</h2>
          <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-300/90">
            Jump directly to any section and difficulty for QA/testing.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Section
              </span>
              <Select
                value={currentSection.id}
                onChange={(event) => {
                  void jumpToSection(event.target.value);
                }}
                className="w-full border-amber-300 dark:border-amber-700"
              >
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Difficulty
              </span>
              <Select
                value={currentDifficulty}
                onChange={(event) => {
                  void jumpToDifficulty(event.target.value as BookDifficulty);
                }}
                className="w-full border-amber-300 dark:border-amber-700"
              >
                {DIFFICULTY_SEQUENCE.map((difficultyOption) => (
                  <option key={difficultyOption} value={difficultyOption}>
                    {DIFFICULTY_LABELS[difficultyOption]}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </Card>
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
          <Card accent="success" className="bg-accent-50 dark:bg-emerald-900/20">
            <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">All sections mastered on all difficulties.</p>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
              You completed the sequential learning path. You can continue practicing by resuming sessions.
            </p>
          </Card>
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
    <Card className="p-4 rounded-2xl">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
    </Card>
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
    <Card className="p-5 rounded-3xl">
      <SectionTitle title={title} icon={<Icon className="h-5 w-5 text-primary-600 dark:text-primary-300" />} />
      {children}
    </Card>
  );
}

