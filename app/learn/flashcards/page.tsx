'use client';

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Armchair,
  Bath,
  BookOpenText,
  CheckCircle2,
  Clock3,
  Hash,
  HeartPulse,
  House,
  ListChecks,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import { initializeDatabase } from '@/lib/db';
import {
  createCustomFlashcardSet,
  getCustomFlashcardSets,
  importFlashcardTemplate,
  removeCustomFlashcardSet,
  updateCustomFlashcardSet,
} from '@/lib/flashcards/customSets';
import { getFlashcardTopics } from '@/lib/flashcards/practice';
import { getResolvedFlashcardTemplates } from '@/lib/flashcards/templates';
import { generateId } from '@/lib/utils/string';
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  SectionTitle,
  Select,
} from '@/components/ui/primitives';
import type {
  CustomFlashcardSet,
  FlashcardDifficultyBucket,
  FlashcardLimitType,
  FlashcardPracticeType,
  FlashcardSessionMode,
  ResolvedFlashcardTemplate,
} from '@/types/flashcards';

interface DraftCustomCard {
  id: string;
  prompt: string;
  answer: string;
}

interface InlineNotice {
  tone: 'success' | 'error' | 'info';
  text: string;
}

const MODES_WITH_PRACTICE_TYPE: FlashcardSessionMode[] = ['topic', 'practice', 'difficulty', 'custom'];
const MODES_WITH_LIMITS: FlashcardSessionMode[] = ['topic', 'difficulty', 'custom'];
const PRACTICE_TYPE_LABELS: Record<FlashcardPracticeType, string> = {
  vocabulary: 'Vocabulary',
  sentences: 'Sentences',
};
const DIFFICULTY_BUCKET_LABELS: Record<FlashcardDifficultyBucket, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export default function LearnFlashcardsPage() {
  const router = useRouter();
  const [mode, setMode] = useState<FlashcardSessionMode>('topic');
  const [limitType, setLimitType] = useState<FlashcardLimitType>('full-topic');
  const [targetCount, setTargetCount] = useState(20);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
  const [topicId, setTopicId] = useState('');
  const [practiceType, setPracticeType] = useState<FlashcardPracticeType>('vocabulary');
  const [difficultyBucket, setDifficultyBucket] = useState<FlashcardDifficultyBucket | null>(null);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [customSets, setCustomSets] = useState<CustomFlashcardSet[]>([]);
  const [isSavingSet, setIsSavingSet] = useState(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isImportingTemplateId, setIsImportingTemplateId] = useState<string | null>(null);
  const [plannerNotice, setPlannerNotice] = useState<InlineNotice | null>(null);
  const [editorNotice, setEditorNotice] = useState<InlineNotice | null>(null);

  const [newSetName, setNewSetName] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [draftCards, setDraftCards] = useState<DraftCustomCard[]>(buildEmptyDraftCards());

  const topics = useMemo(() => getFlashcardTopics(), []);
  const templates = useMemo(() => getResolvedFlashcardTemplates(), []);
  const selectedSet = useMemo(
    () => customSets.find((set) => set.id === selectedSetId) ?? null,
    [customSets, selectedSetId]
  );

  useEffect(() => {
    async function load() {
      await initializeDatabase();
      const existingSets = await getCustomFlashcardSets();
      setCustomSets(existingSets);

      if (topics.length > 0) {
        setTopicId(topics[0].id);
      }
      if (existingSets.length > 0) {
        setSelectedSetId(existingSets[0].id);
      }
    }

    void load();
  }, [topics]);

  useEffect(() => {
    if (mode === 'topic') {
      setLimitType((previous) => (previous === 'time' || previous === 'count' ? previous : 'full-topic'));
      return;
    }

    setLimitType((previous) => (previous === 'full-topic' ? 'count' : previous));
  }, [mode]);

  async function refreshSets(preferredSetId?: string) {
    const sets = await getCustomFlashcardSets();
    setCustomSets(sets);

    if (sets.length === 0) {
      setSelectedSetId('');
      return sets;
    }

    const nextSelected =
      preferredSetId && sets.some((set) => set.id === preferredSetId)
        ? preferredSetId
        : sets.some((set) => set.id === selectedSetId)
        ? selectedSetId
        : sets[0].id;

    setSelectedSetId(nextSelected);
    return sets;
  }

  function updateDraftCard(id: string, patch: Partial<DraftCustomCard>) {
    setDraftCards((previous) =>
      previous.map((card) => (card.id === id ? { ...card, ...patch } : card))
    );
  }

  function addDraftCard() {
    setDraftCards((previous) => [...previous, { id: generateId(), prompt: '', answer: '' }]);
  }

  function removeDraftCard(id: string) {
    setDraftCards((previous) => {
      const remaining = previous.filter((card) => card.id !== id);
      return remaining.length > 0 ? remaining : buildEmptyDraftCards();
    });
  }

  function resetEditor() {
    setNewSetName('');
    setNewSetDescription('');
    setDraftCards(buildEmptyDraftCards());
    setEditingSetId(null);
    setPendingDeleteId(null);
  }

  function beginCreateSet() {
    resetEditor();
    setEditorNotice(null);
  }

  function populateEditor(set: CustomFlashcardSet) {
    setEditingSetId(set.id);
    setSelectedSetId(set.id);
    setNewSetName(set.name);
    setNewSetDescription(set.description ?? '');
    setDraftCards(
      set.cards.length > 0
        ? set.cards.map((card) => ({
            id: card.id,
            prompt: card.prompt,
            answer: card.answer,
          }))
        : buildEmptyDraftCards()
    );
    setPendingDeleteId(null);
  }

  async function handleSaveSet() {
    const trimmedName = newSetName.trim();
    if (!trimmedName) {
      setEditorNotice({ tone: 'error', text: 'Give the set a name before saving.' });
      return;
    }

    const cards = draftCards
      .filter((card) => card.prompt.trim() && card.answer.trim())
      .map((card) => ({
        id: card.id,
        prompt: card.prompt,
        answer: card.answer,
      }));

    if (cards.length === 0) {
      setEditorNotice({ tone: 'error', text: 'Add at least one flashcard row with both sides filled in.' });
      return;
    }

    setIsSavingSet(true);
    try {
      const savedSet = editingSetId
        ? await updateCustomFlashcardSet({
            id: editingSetId,
            name: trimmedName,
            description: newSetDescription,
            cards,
          })
        : await createCustomFlashcardSet({
            name: trimmedName,
            description: newSetDescription,
            cards,
          });

      await refreshSets(savedSet.id);
      populateEditor(savedSet);
      setEditorNotice({
        tone: 'success',
        text: editingSetId ? 'Set updated and ready to practice.' : 'New custom set created.',
      });
    } finally {
      setIsSavingSet(false);
    }
  }

  async function handleImportTemplate(template: ResolvedFlashcardTemplate) {
    setIsImportingTemplateId(template.id);
    try {
      const importedSet = await importFlashcardTemplate(template.id);
      await refreshSets(importedSet.id);
      populateEditor(importedSet);
      setEditorNotice({
        tone: 'success',
        text: `${importedSet.name} imported. You can edit the cards right away.`,
      });
    } catch (error) {
      setEditorNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to import template.',
      });
    } finally {
      setIsImportingTemplateId(null);
    }
  }

  async function handleDeleteSet(id: string) {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      setEditorNotice({
        tone: 'info',
        text: 'Click delete again to confirm, or choose another action to cancel.',
      });
      return;
    }

    await removeCustomFlashcardSet(id);
    const remainingSets = await refreshSets();
    if (editingSetId === id) {
      if (remainingSets.length > 0) {
        populateEditor(remainingSets[0]);
      } else {
        resetEditor();
      }
    }
    setPendingDeleteId(null);
    setEditorNotice({ tone: 'success', text: 'Set deleted.' });
  }

  function startSession() {
    setPlannerNotice(null);

    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('practiceType', practiceType);

    if (mode !== 'practice') {
      const resolvedLimitType = mode === 'topic' ? limitType : limitType === 'full-topic' ? 'count' : limitType;

      params.set('limitType', resolvedLimitType);

      if (resolvedLimitType === 'count') {
        params.set('count', String(Math.max(1, targetCount)));
      } else if (resolvedLimitType === 'time') {
        params.set('minutes', String(Math.max(1, timeLimitMinutes)));
      }
    }

    if (mode === 'topic') {
      if (!topicId) {
        setPlannerNotice({ tone: 'error', text: 'Choose a topic before starting.' });
        return;
      }
      params.set('topicId', topicId);
    }

    if (mode === 'difficulty') {
      if (!difficultyBucket) {
        setPlannerNotice({ tone: 'error', text: 'Choose a difficulty bucket first.' });
        return;
      }
      params.set('difficultyBucket', difficultyBucket);
    }

    if (mode === 'custom') {
      if (!selectedSetId) {
        setPlannerNotice({ tone: 'error', text: 'Create or import a set before running custom flashcards.' });
        return;
      }
      params.set('customSetId', selectedSetId);
    }

    router.push(`/learn/flashcards/session?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        title="Flashcards Lab"
        description="Build your own practice sets, import starter packs, and spin up focused flashcard sessions from one place."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{templates.length} starter templates</Badge>
            <Badge tone="success">{customSets.length} my sets</Badge>
          </div>
        }
      />

      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-700 via-cyan-700 to-teal-600 p-8 text-white shadow-xl">
        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/75">Planner + Builder</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold sm:text-4xl">
              Import a starter pack, tailor it, and jump straight into practice.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-white/85 sm:text-base">
              Templates become editable personal sets after import, so your flashcards stay flexible instead of locked.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            <MetricCard label="Template Cards" value={String(templates.reduce((sum, template) => sum + template.cardCount, 0))} />
            <MetricCard label="Custom Sets" value={String(customSets.length)} />
            <MetricCard
              label="Practice Modes"
              value={String(MODES_WITH_PRACTICE_TYPE.length)}
            />
            <MetricCard label="Focused Limits" value="Count / Time" />
          </div>
        </div>
      </section>

      <div className="grid gap-8">
        <Card className="space-y-6">
          <SectionTitle
            title="Session Planner"
            description="Choose how you want to study, then launch a topic, difficulty, or custom session."
            icon={<Sparkles className="h-5 w-5 text-primary-500" />}
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ModeButton
              active={mode === 'topic'}
              title="By Topic"
              description="Practice a focused topic slice."
              icon={BookOpenText}
              onClick={() => setMode('topic')}
            />
            <ModeButton
              active={mode === 'practice'}
              title="Practice Loop"
              description="Endless learned-card review."
              icon={Sparkles}
              onClick={() => setMode('practice')}
            />
            <ModeButton
              active={mode === 'difficulty'}
              title="By Difficulty"
              description="Drill easy, medium, or hard cards."
              icon={ListChecks}
              onClick={() => setMode('difficulty')}
            />
            <ModeButton
              active={mode === 'custom'}
              title="My Set"
              description="Run one of your own decks."
              icon={Plus}
              onClick={() => setMode('custom')}
            />
          </div>

          {MODES_WITH_PRACTICE_TYPE.includes(mode) && (
            <div className="grid gap-4 rounded-3xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Practice type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(PRACTICE_TYPE_LABELS) as FlashcardPracticeType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPracticeType(type)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                        practiceType === type
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {PRACTICE_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Vocabulary uses section terms. Sentences uses sentence pairs from the book.
                </p>
              </div>

              {mode === 'topic' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Topic
                  </label>
                  <Select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.label}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {mode === 'custom' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Custom set
                  </label>
                  <Select value={selectedSetId} onChange={(event) => setSelectedSetId(event.target.value)}>
                    {customSets.length === 0 ? (
                      <option value="">Create or import a set first</option>
                    ) : (
                      customSets.map((set) => (
                        <option key={set.id} value={set.id}>
                          {set.name} ({set.cards.length} cards)
                        </option>
                      ))
                    )}
                  </Select>
                  {selectedSet && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {selectedSet.description ?? 'This set is ready for a custom flashcard run.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === 'difficulty' && (
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(DIFFICULTY_BUCKET_LABELS) as FlashcardDifficultyBucket[]).map((bucket) => (
                <button
                  key={bucket}
                  type="button"
                  onClick={() => setDifficultyBucket(bucket)}
                  className={`rounded-3xl border p-4 text-left transition-colors ${
                    difficultyBucket === bucket
                      ? 'border-cyan-500 bg-cyan-500 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-cyan-300 hover:bg-cyan-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <p className="font-semibold">{DIFFICULTY_BUCKET_LABELS[bucket]}</p>
                  <p className={`mt-1 text-xs ${difficultyBucket === bucket ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                    {bucket === 'easy'
                      ? 'Mostly stable recall.'
                      : bucket === 'medium'
                      ? 'Some slips and inconsistencies.'
                      : 'Cards that need reinforcement.'}
                  </p>
                </button>
              ))}
            </div>
          )}

          {MODES_WITH_LIMITS.includes(mode) && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Session limit</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {mode === 'topic' && (
                    <LimitButton
                      active={limitType === 'full-topic'}
                      onClick={() => setLimitType('full-topic')}
                      label="Full topic"
                    />
                  )}
                  <LimitButton
                    active={limitType === 'count'}
                    onClick={() => setLimitType('count')}
                    label="Card count"
                  />
                  <LimitButton
                    active={limitType === 'time'}
                    onClick={() => setLimitType('time')}
                    label="Time limit"
                    icon={<Clock3 className="h-4 w-4" />}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                {limitType === 'full-topic' ? (
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Full run</p>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      Run the complete pool and finish after retrying misses.
                    </p>
                  </div>
                ) : limitType === 'count' ? (
                  <label className="block">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Number of cards</span>
                    <Input
                      type="number"
                      min={1}
                      value={targetCount}
                      onChange={(event) => setTargetCount(Number(event.target.value))}
                      className="mt-2"
                    />
                  </label>
                ) : (
                  <label className="block">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Time limit (minutes)</span>
                    <Input
                      type="number"
                      min={1}
                      value={timeLimitMinutes}
                      onChange={(event) => setTimeLimitMinutes(Number(event.target.value))}
                      className="mt-2"
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {plannerNotice && <NoticeBanner notice={plannerNotice} />}

          <div className="flex flex-wrap gap-3">
            <Button onClick={startSession} size="lg">
              Start Flashcards
            </Button>
            <Button variant="secondary" size="lg" onClick={() => router.push('/learn')}>
              Back to Learn
            </Button>
          </div>
        </Card>

        <Card className="space-y-5">
          <SectionTitle
            title="Starter Templates"
            description="Import a ready-made pack, then edit it like any other personal set."
            icon={<CheckCircle2 className="h-5 w-5 text-accent-600" />}
          />

          <div className="grid gap-4">
            {templates.map((template) => {
              const Icon = TEMPLATE_ICONS[template.icon] ?? Sparkles;
              return (
                <div
                  key={template.id}
                  className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-white">{template.name}</p>
                          <Badge tone={template.sourceType === 'book-section' ? 'primary' : 'warning'}>
                            {template.sourceType === 'book-section' ? 'Book-backed' : 'Curated'}
                          </Badge>
                          <Badge tone="success">{template.cardCount} cards</Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{template.description}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {template.previewCards.map((card) => (
                            <span
                              key={card.id}
                              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                            >
                              {card.answer}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => void handleImportTemplate(template)}
                      disabled={template.cardCount === 0 || isImportingTemplateId === template.id}
                    >
                      {isImportingTemplateId === template.id ? 'Importing...' : 'Import'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr,0.95fr]">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              title={editingSetId ? 'Edit Set' : 'Create a Set'}
              description="Build a new deck from scratch or tune an imported template."
              icon={<Pencil className="h-5 w-5 text-info-600" />}
              className="mb-0"
            />
            <Button variant="secondary" onClick={beginCreateSet}>
              New blank set
            </Button>
          </div>

          {editorNotice && <NoticeBanner notice={editorNotice} />}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Set name</span>
              <Input
                value={newSetName}
                onChange={(event) => setNewSetName(event.target.value)}
                placeholder="e.g. Daily essentials"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Description</span>
              <Input
                value={newSetDescription}
                onChange={(event) => setNewSetDescription(event.target.value)}
                placeholder="Optional note about what this set covers"
              />
            </label>
          </div>

          <div className="space-y-3 rounded-3xl border border-gray-200 bg-gray-50/90 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Cards</p>
              <Button variant="secondary" size="sm" onClick={addDraftCard}>
                <Plus className="h-4 w-4" />
                Add row
              </Button>
            </div>

            {draftCards.map((card, index) => (
              <div
                key={card.id}
                className="grid gap-2 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 md:grid-cols-[1fr,1fr,auto]"
              >
                <Input
                  value={card.prompt}
                  onChange={(event) => updateDraftCard(card.id, { prompt: event.target.value })}
                  placeholder={`Front / prompt ${index + 1}`}
                />
                <Input
                  value={card.answer}
                  onChange={(event) => updateDraftCard(card.id, { answer: event.target.value })}
                  placeholder={`Back / answer ${index + 1}`}
                />
                <Button variant="ghost" onClick={() => removeDraftCard(card.id)} aria-label="Remove flashcard row">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void handleSaveSet()} disabled={isSavingSet}>
              {isSavingSet ? 'Saving...' : editingSetId ? 'Update set' : 'Save set'}
            </Button>
            {editingSetId && (
              <Button variant="secondary" onClick={beginCreateSet}>
                Cancel editing
              </Button>
            )}
          </div>
        </Card>

        <Card className="space-y-5">
          <SectionTitle
            title="My Sets"
            description="Imported starter packs and manual sets all live together here."
            icon={<BookOpenText className="h-5 w-5 text-primary-500" />}
          />

          {customSets.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 px-6 py-10 text-center dark:border-gray-700">
              <p className="text-lg font-semibold text-gray-900 dark:text-white">No sets yet</p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Import a template or create a blank set to start building your custom flashcards.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {customSets.map((set) => {
                const isSelected = selectedSetId === set.id;
                const isEditing = editingSetId === set.id;
                const iconName = set.icon ?? 'Sparkles';
                const Icon = TEMPLATE_ICONS[iconName] ?? Sparkles;

                return (
                  <div
                    key={set.id}
                    className={`rounded-3xl border p-4 transition-colors ${
                      isSelected || isEditing
                        ? 'border-primary-400 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-100">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-gray-900 dark:text-white">{set.name}</p>
                            <Badge tone="success">{set.cards.length} cards</Badge>
                            <Badge tone={set.sourceType === 'template-import' ? 'warning' : 'neutral'}>
                              {set.sourceType === 'template-import' ? 'Imported template' : 'Custom'}
                            </Badge>
                          </div>
                          {set.description && (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{set.description}</p>
                          )}
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {set.cards.slice(0, 3).map((card) => card.answer).join(' • ') || 'No cards yet'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedSetId(set.id);
                            setMode('custom');
                            setPlannerNotice({
                              tone: 'info',
                              text: `${set.name} is selected for custom practice.`,
                            });
                          }}
                        >
                          Practice
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            populateEditor(set);
                            setEditorNotice(null);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant={pendingDeleteId === set.id ? 'danger' : 'ghost'}
                          size="sm"
                          onClick={() => void handleDeleteSet(set.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {pendingDeleteId === set.id ? 'Confirm delete' : 'Delete'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function buildEmptyDraftCards(): DraftCustomCard[] {
  return [
    { id: generateId(), prompt: '', answer: '' },
    { id: generateId(), prompt: '', answer: '' },
  ];
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function LimitButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? 'bg-primary-500 text-white'
          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ModeButton({
  active,
  title,
  description,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-4 text-left transition-colors ${
        active
          ? 'border-primary-400 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
          : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary-500" />
        <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{description}</p>
    </button>
  );
}

function NoticeBanner({ notice }: { notice: InlineNotice }) {
  const classes =
    notice.tone === 'success'
      ? 'border-accent-200 bg-accent-50 text-accent-700 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-200'
      : notice.tone === 'error'
      ? 'border-destructive-200 bg-destructive-50 text-destructive-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200'
      : 'border-info-200 bg-info-50 text-info-700 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-200';

  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${classes}`}>{notice.text}</div>;
}

const TEMPLATE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Armchair,
  Bath,
  Hash,
  HeartPulse,
  House,
  Sparkles,
  UtensilsCrossed,
};
