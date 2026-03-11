'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpenText, Clock3, ListChecks, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  deleteCustomFlashcardSet,
  getAllCustomFlashcardSets,
  initializeDatabase,
  saveCustomFlashcardSet,
} from '@/lib/db';
import { getFlashcardTopics } from '@/lib/flashcards/practice';
import { generateId } from '@/lib/utils/string';
import type { CustomFlashcardSet, FlashcardLimitType, FlashcardSessionMode } from '@/types/flashcards';

interface DraftCustomCard {
  id: string;
  prompt: string;
  answer: string;
}

const TOPIC_MODES: FlashcardSessionMode[] = ['topic', 'random', 'custom'];

export default function LearnFlashcardsPage() {
  const router = useRouter();
  const [mode, setMode] = useState<FlashcardSessionMode>('topic');
  const [limitType, setLimitType] = useState<FlashcardLimitType>('count');
  const [targetCount, setTargetCount] = useState(20);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
  const [topicId, setTopicId] = useState<string>('');
  const [customSetId, setCustomSetId] = useState<string>('');
  const [customSets, setCustomSets] = useState<CustomFlashcardSet[]>([]);
  const [isSavingSet, setIsSavingSet] = useState(false);

  const [newSetName, setNewSetName] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [draftCards, setDraftCards] = useState<DraftCustomCard[]>([
    { id: generateId(), prompt: '', answer: '' },
    { id: generateId(), prompt: '', answer: '' },
  ]);

  const topics = useMemo(() => getFlashcardTopics(), []);

  useEffect(() => {
    async function load() {
      await initializeDatabase();
      const existingSets = await getAllCustomFlashcardSets();
      setCustomSets(existingSets);

      if (topics.length > 0) {
        setTopicId(topics[0].id);
      }
      if (existingSets.length > 0) {
        setCustomSetId(existingSets[0].id);
      }
    }

    load();
  }, [topics]);

  async function refreshCustomSets() {
    const sets = await getAllCustomFlashcardSets();
    setCustomSets(sets);
    if (sets.length > 0 && !sets.some((set) => set.id === customSetId)) {
      setCustomSetId(sets[0].id);
    }
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
    setDraftCards((previous) => previous.filter((card) => card.id !== id));
  }

  async function saveNewCustomSet() {
    const name = newSetName.trim();
    if (!name) {
      alert('Please provide a set name.');
      return;
    }

    const cards = draftCards
      .map((card) => ({
        id: generateId(),
        prompt: card.prompt.trim(),
        answer: card.answer.trim(),
        createdAt: Date.now(),
      }))
      .filter((card) => card.prompt && card.answer);

    if (cards.length === 0) {
      alert('Add at least one flashcard with prompt and answer.');
      return;
    }

    setIsSavingSet(true);
    try {
      const now = Date.now();
      await saveCustomFlashcardSet({
        id: generateId(),
        name,
        description: newSetDescription.trim() || undefined,
        cards,
        createdAt: now,
        updatedAt: now,
      });

      setNewSetName('');
      setNewSetDescription('');
      setDraftCards([
        { id: generateId(), prompt: '', answer: '' },
        { id: generateId(), prompt: '', answer: '' },
      ]);
      await refreshCustomSets();
    } finally {
      setIsSavingSet(false);
    }
  }

  async function removeSet(id: string) {
    const confirmed = window.confirm('Delete this custom set?');
    if (!confirmed) {
      return;
    }

    await deleteCustomFlashcardSet(id);
    await refreshCustomSets();
  }

  function startSession() {
    if (mode === 'difficulty') {
      alert('Difficulty mode is a placeholder for now.');
      return;
    }

    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('limitType', limitType);

    if (limitType === 'count') {
      params.set('count', String(Math.max(1, targetCount)));
    } else {
      params.set('minutes', String(Math.max(1, timeLimitMinutes)));
    }

    if (mode === 'topic') {
      if (!topicId) {
        alert('Choose a topic first.');
        return;
      }
      params.set('topicId', topicId);
    }

    if (mode === 'custom') {
      if (!customSetId) {
        alert('Choose a custom set first.');
        return;
      }
      params.set('customSetId', customSetId);
    }

    router.push(`/learn/flashcards/session?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-cyan-700 via-sky-700 to-blue-700 p-8 text-white shadow-xl">
        <h1 className="text-3xl font-bold sm:text-4xl">Flashcards Lab</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/90 sm:text-base">
          Practice vocabulary with typing-only flashcards, second-chance loops, and custom decks.
        </p>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Choose Mode</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <ModeButton
            active={mode === 'topic'}
            title="By Topic"
            description="Practice words from one topic."
            icon={BookOpenText}
            onClick={() => setMode('topic')}
          />
          <ModeButton
            active={mode === 'random'}
            title="Random"
            description="Mix words from all topics."
            icon={Sparkles}
            onClick={() => setMode('random')}
          />
          <ModeButton
            active={mode === 'difficulty'}
            title="By Difficulty"
            description="Placeholder for future logic."
            icon={ListChecks}
            onClick={() => setMode('difficulty')}
          />
          <ModeButton
            active={mode === 'custom'}
            title="Custom"
            description="Use your own flashcard sets."
            icon={Plus}
            onClick={() => setMode('custom')}
          />
        </div>

        {mode === 'topic' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Topic</label>
            <select
              value={topicId}
              onChange={(event) => setTopicId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === 'custom' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Custom Set</label>
            {customSets.length > 0 ? (
              <select
                value={customSetId}
                onChange={(event) => setCustomSetId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                {customSets.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.name} ({set.cards.length} cards)
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                No custom sets yet. Create one below.
              </p>
            )}
          </div>
        )}

        {TOPIC_MODES.includes(mode) && (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Session Limit
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setLimitType('count')}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                    limitType === 'count'
                      ? 'bg-cyan-600 text-white'
                      : 'border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200'
                  }`}
                >
                  Number of Cards
                </button>
                <button
                  onClick={() => setLimitType('time')}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                    limitType === 'time'
                      ? 'bg-cyan-600 text-white'
                      : 'border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200'
                  }`}
                >
                  <Clock3 className="h-4 w-4" />
                  Time Limit
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
              {limitType === 'count' ? (
                <label className="block">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Number of flashcards</span>
                  <input
                    type="number"
                    min={1}
                    value={targetCount}
                    onChange={(event) => setTargetCount(Number(event.target.value))}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Time limit (minutes)</span>
                  <input
                    type="number"
                    min={1}
                    value={timeLimitMinutes}
                    onChange={(event) => setTimeLimitMinutes(Number(event.target.value))}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                </label>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={startSession}
            className="rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white hover:bg-cyan-700"
          >
            Start Flashcards
          </button>
          <button
            onClick={() => router.push('/learn')}
            className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Back to Learn
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Custom Flashcard Sets</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Build your own packs (for example: daily words, travel phrases, work vocabulary).
        </p>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-3">
            <input
              value={newSetName}
              onChange={(event) => setNewSetName(event.target.value)}
              placeholder="Set name (e.g., Daily Words)"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            <input
              value={newSetDescription}
              onChange={(event) => setNewSetDescription(event.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />

            <div className="space-y-2 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
              {draftCards.map((card) => (
                <div key={card.id} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,1fr,auto]">
                  <input
                    value={card.prompt}
                    onChange={(event) => updateDraftCard(card.id, { prompt: event.target.value })}
                    placeholder="Front / prompt (e.g., Good morning)"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <input
                    value={card.answer}
                    onChange={(event) => updateDraftCard(card.id, { answer: event.target.value })}
                    placeholder="Back / answer (e.g., Dzień dobry)"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <button
                    onClick={() => removeDraftCard(card.id)}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                    aria-label="Remove flashcard"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={addDraftCard}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-300 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50 dark:border-cyan-700 dark:text-cyan-300 dark:hover:bg-cyan-900/20"
              >
                <Plus className="h-4 w-4" />
                Add Card Row
              </button>
            </div>

            <button
              onClick={saveNewCustomSet}
              disabled={isSavingSet}
              className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingSet ? 'Saving...' : 'Save Custom Set'}
            </button>
          </div>

          <div className="space-y-3">
            {customSets.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No custom sets created yet.</p>
            ) : (
              customSets.map((set) => (
                <div key={set.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{set.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{set.cards.length} cards</p>
                      {set.description && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{set.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeSet(set.id)}
                      className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                      aria-label="Delete set"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
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
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-cyan-400 bg-cyan-50 dark:border-cyan-600 dark:bg-cyan-900/25'
          : 'border-gray-200 bg-white hover:border-cyan-300 dark:border-gray-700 dark:bg-gray-900/30'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
        <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
    </button>
  );
}

