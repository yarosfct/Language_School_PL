'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenText,
  ChartNoAxesColumn,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  Gauge,
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

  const currentSectionIndex = useMemo(
    () => sections.findIndex((section) => section.id === currentSection?.id),
    [currentSection, sections]
  );
  const previousSection = currentSectionIndex > 0 ? sections[currentSectionIndex - 1] : null;
  const nextSection = currentSectionIndex >= 0 ? sections[currentSectionIndex + 1] ?? null : null;

  const sectionDifficultyUnlocks = useMemo(() => {
    const unlockMap = new Map<string, BookDifficulty[]>();

    for (const section of sections) {
      unlockMap.set(section.id, getUnlockedDifficultiesForSection(section.id, attempts, devModeEnabled));
    }

    return unlockMap;
  }, [attempts, devModeEnabled, sections]);

  const unlockedCurrentDifficulties = useMemo(
    () => sectionDifficultyUnlocks.get(currentSection?.id ?? '') ?? ['level_1'],
    [currentSection, sectionDifficultyUnlocks]
  );
  const unlockedSectionIds = useMemo(
    () => getUnlockedSectionIds(sections, attempts, currentDifficulty, devModeEnabled, currentSection?.id ?? null),
    [attempts, currentDifficulty, currentSection, devModeEnabled, sections]
  );
  const sectionSelectionOptions = useMemo(
    () =>
      sections.map((section) => {
        const isUnlocked = devModeEnabled || unlockedSectionIds.has(section.id);
        return {
          value: section.id,
          label: isUnlocked ? section.label : `${section.label} (locked)`,
          disabled: !isUnlocked,
        };
      }),
    [devModeEnabled, sections, unlockedSectionIds]
  );

  const sectionProgressPercent = sectionMastery.total === 0 ? 0 : Math.round((sectionMastery.mastered / sectionMastery.total) * 100);
  const overallProgressPercent =
    overallMastery.total === 0 ? 0 : Math.round((overallMastery.mastered / overallMastery.total) * 100);
  const difficultyProgressPercent =
    overallMastery.totalSections === 0
      ? 0
      : Math.round((overallMastery.masteredSections / overallMastery.totalSections) * 100);

  const canMoveToPreviousSection = !!previousSection;
  const canMoveToNextSection = !!nextSection && (devModeEnabled || sectionMastery.mastered === sectionMastery.total);
  const currentDifficultyIndex = DIFFICULTY_SEQUENCE.indexOf(currentDifficulty);
  const previousDifficulty = currentDifficultyIndex > 0 ? DIFFICULTY_SEQUENCE[currentDifficultyIndex - 1] : null;
  const nextDifficulty = currentDifficultyIndex < DIFFICULTY_SEQUENCE.length - 1 ? DIFFICULTY_SEQUENCE[currentDifficultyIndex + 1] : null;
  const canMoveToPreviousDifficulty = !!previousDifficulty;
  const canMoveToNextDifficulty = !!nextDifficulty && unlockedCurrentDifficulties.includes(nextDifficulty);

  function pickBestDifficultyForSection(sectionId: string, preferredDifficulty: BookDifficulty): BookDifficulty {
    const unlocked = sectionDifficultyUnlocks.get(sectionId) ?? ['level_1'];

    if (devModeEnabled || unlocked.includes(preferredDifficulty)) {
      return preferredDifficulty;
    }

    const preferredIndex = DIFFICULTY_SEQUENCE.indexOf(preferredDifficulty);
    for (let index = preferredIndex; index >= 0; index -= 1) {
      const candidate = DIFFICULTY_SEQUENCE[index];
      if (unlocked.includes(candidate)) {
        return candidate;
      }
    }

    return unlocked[0] ?? 'level_1';
  }

  async function changeDifficulty(nextDifficultyValue: BookDifficulty) {
    if (nextDifficultyValue === currentDifficulty) {
      return;
    }

    const targetIndex = DIFFICULTY_SEQUENCE.indexOf(nextDifficultyValue);
    if (targetIndex === -1) {
      return;
    }

    if (!devModeEnabled) {
      const unlocked = sectionDifficultyUnlocks.get(currentSection?.id ?? '') ?? ['level_1'];
      if (!unlocked.includes(nextDifficultyValue)) {
        return;
      }
    }

    await updateBookPathProgress({ currentDifficulty: nextDifficultyValue });
    setCurrentDifficulty(nextDifficultyValue);
  }

  async function moveToSection(direction: 'previous' | 'next') {
    if (!currentSection) {
      return;
    }

    const targetSection = direction === 'previous' ? previousSection : nextSection;
    if (!targetSection) {
      return;
    }

    if (direction === 'next' && !canMoveToNextSection) {
      return;
    }

    const targetDifficulty = pickBestDifficultyForSection(targetSection.id, currentDifficulty);

    await updateBookPathProgress({
      currentSectionId: targetSection.id,
      currentDifficulty: targetDifficulty,
    });
    setCurrentSectionId(targetSection.id);
    setCurrentDifficulty(targetDifficulty);
  }

  async function moveToSectionById(sectionId: string) {
    if (!currentSection || sectionId === currentSection.id) {
      return;
    }

    if (!devModeEnabled && !unlockedSectionIds.has(sectionId)) {
      return;
    }

    const targetDifficulty = pickBestDifficultyForSection(sectionId, currentDifficulty);
    await updateBookPathProgress({
      currentSectionId: sectionId,
      currentDifficulty: targetDifficulty,
    });
    setCurrentSectionId(sectionId);
    setCurrentDifficulty(targetDifficulty);
  }

  async function moveDifficulty(direction: 'previous' | 'next') {
    if (direction === 'previous') {
      if (!previousDifficulty) {
        return;
      }

      await changeDifficulty(previousDifficulty);
      return;
    }

    if (!nextDifficulty || (!canMoveToNextDifficulty && !devModeEnabled)) {
      return;
    }

    await changeDifficulty(nextDifficulty);
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
              Practice book vocabulary by topic, learned-card practice loops, difficulty buckets, or your own custom decks.
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

      <Card className="border-gray-200/90 bg-white/95 p-4 dark:border-gray-700 dark:bg-gray-800/95">
        <div className="space-y-3.5">
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Section completion</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {sectionMastery.mastered} / {sectionMastery.total} mastered
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200/80 dark:bg-gray-700/80">
                <div
                  className="h-full rounded-full bg-primary-500 transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${sectionProgressPercent}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Difficulty completion at {DIFFICULTY_SHORT_LABELS[currentDifficulty]}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {overallMastery.masteredSections} / {overallMastery.totalSections} sections
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200/80 dark:bg-gray-700/80">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${difficultyProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr),170px]">
            <ArrowNavigator
              label="Section"
              value={currentSection.label}
              selectedValue={currentSection.id}
              selectorOptions={sectionSelectionOptions}
              onSelectValue={(sectionId) => {
                void moveToSectionById(sectionId);
              }}
              onPrevious={() => void moveToSection('previous')}
              onNext={() => void moveToSection('next')}
              canGoPrevious={canMoveToPreviousSection}
              canGoNext={canMoveToNextSection}
            />
            <ArrowNavigator
              label="Difficulty"
              value={DIFFICULTY_SHORT_LABELS[currentDifficulty]}
              onPrevious={() => void moveDifficulty('previous')}
              onNext={() => void moveDifficulty('next')}
              canGoPrevious={canMoveToPreviousDifficulty}
              canGoNext={canMoveToNextDifficulty || devModeEnabled}
            />
            <Button onClick={resumeLearning} variant="primary" className="h-full min-h-[48px] w-full justify-center lg:self-end">
              <Play className="h-4 w-4" />
              Resume
            </Button>
          </div>

          <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
            {!canMoveToNextSection && (
              <p>You can move to the next section after mastering all exercises in the current section.</p>
            )}
            {!canMoveToNextDifficulty && (
              <p>
                You can move to the next difficulty after mastering this section at{' '}
                {DIFFICULTY_LABELS[currentDifficulty]}.
              </p>
            )}
            {devModeEnabled && (
              <p className="font-medium text-amber-600 dark:text-amber-300">
                Dev mode is ON: progression gates are bypassed for testing.
              </p>
            )}
          </div>
        </div>
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

function ArrowNavigator({
  label,
  value,
  selectedValue,
  selectorOptions,
  onSelectValue,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: {
  label: string;
  value: string;
  selectedValue?: string;
  selectorOptions?: Array<{ value: string; label: string; disabled?: boolean }>;
  onSelectValue?: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen, menuRef]);

  const hasSelector = !!selectorOptions && !!onSelectValue;

  return (
    <div className="rounded-xl border border-gray-200/90 bg-gray-50/80 p-2 dark:border-gray-700 dark:bg-gray-900/40">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-1 grid grid-cols-[auto,1fr,auto] items-center gap-1 rounded-lg border border-gray-200 bg-white px-1 py-1 dark:border-gray-700 dark:bg-gray-800/90">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-600 transition-colors duration-200 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700 motion-reduce:transition-none"
          aria-label={`Previous ${label.toLowerCase()}`}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {hasSelector ? (
          <div className="relative" ref={(node) => { menuRef.current = node; }}>
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="inline-flex w-full items-center justify-center gap-1 truncate rounded-md px-1 py-1 text-center text-sm font-semibold text-gray-900 transition-colors duration-200 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-white dark:hover:bg-gray-700 motion-reduce:transition-none"
              aria-label={`Select ${label.toLowerCase()}`}
              aria-expanded={menuOpen}
            >
              <span className="truncate">{value}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-300" />
            </button>
            {menuOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-40 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <ul className="max-h-56 overflow-auto py-1">
                  {selectorOptions.map((option) => (
                    <li key={option.value}>
                      <button
                        type="button"
                        onClick={() => {
                          if (option.disabled) {
                            return;
                          }
                          onSelectValue(option.value);
                          setMenuOpen(false);
                        }}
                        disabled={option.disabled}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors duration-200 motion-reduce:transition-none ${
                          option.value === selectedValue
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                        } disabled:cursor-not-allowed disabled:opacity-45`}
                      >
                        {option.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <span className="truncate px-1 text-center text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-600 transition-colors duration-200 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700 motion-reduce:transition-none"
          aria-label={`Next ${label.toLowerCase()}`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
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

function getUnlockedDifficultiesForSection(
  sectionId: string,
  attempts: AttemptWithId[],
  devModeEnabled: boolean
): BookDifficulty[] {
  if (devModeEnabled) {
    return [...DIFFICULTY_SEQUENCE];
  }

  const sectionAttempts = attempts.filter((attempt) => attempt.topicId === sectionId);
  const unlocked: BookDifficulty[] = ['level_1'];

  const level1Mastery = getSectionMastery(sectionId, 'level_1', sectionAttempts);
  if (level1Mastery.total === 0 || level1Mastery.mastered === level1Mastery.total) {
    unlocked.push('level_2');
  }

  const level2Mastery = getSectionMastery(sectionId, 'level_2', sectionAttempts);
  if (level2Mastery.total === 0 || level2Mastery.mastered === level2Mastery.total) {
    unlocked.push('level_3');
  }

  return unlocked;
}

function getUnlockedSectionIds(
  sections: Array<{ id: string }>,
  attempts: AttemptWithId[],
  currentDifficulty: BookDifficulty,
  devModeEnabled: boolean,
  currentSectionId: string | null
): Set<string> {
  if (devModeEnabled) {
    return new Set(sections.map((section) => section.id));
  }

  const unlocked = new Set<string>();
  let previousSectionMastered = true;

  for (const section of sections) {
    if (previousSectionMastered) {
      unlocked.add(section.id);
    }

    if (!previousSectionMastered) {
      continue;
    }

    const mastery = getSectionMastery(section.id, currentDifficulty, attempts);
    previousSectionMastered = mastery.total === 0 || mastery.mastered === mastery.total;
  }

  if (currentSectionId) {
    unlocked.add(currentSectionId);
  }

  return unlocked;
}
