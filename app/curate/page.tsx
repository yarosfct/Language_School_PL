'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { Badge, Button, Input, PageHeader, Select } from '@/components/ui/primitives';
import type {
  CurationItemsResponse,
  CurationListItem,
  CurationSource,
  CurationToken,
  HandpickResponse,
  UnhandpickResponse,
} from '@/types/curation';

const SOURCE_LABELS: Record<CurationSource, string> = {
  book_exercises: 'Book exercises',
  sentence_candidates: 'Curated sentence candidates',
};

const PAGE_SIZE = 20;

export default function CuratePage() {
  const [source, setSource] = useState<CurationSource>('book_exercises');
  const [category, setCategory] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [handpickedFilter, setHandpickedFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CurationItemsResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      setIsLoading(true);
      setNotice(null);

      try {
        const params = new URLSearchParams({
          source,
          page: String(page),
          pageSize: String(PAGE_SIZE),
          category,
          difficulty,
          handpicked: handpickedFilter,
          search,
        });
        const response = await fetch(`/api/curation/items?${params.toString()}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to load curation items.');
        }

        if (!cancelled) {
          setData(payload as CurationItemsResponse);
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({
            tone: 'error',
            text: error instanceof Error ? error.message : 'Unable to load curation items.',
          });
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [category, difficulty, handpickedFilter, page, search, source]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );
  const categoryOptions = useMemo(
    () => Object.keys(data?.stats.categories ?? {}).sort((left, right) => left.localeCompare(right)),
    [data]
  );
  const difficultyOptions = useMemo(
    () => Object.keys(data?.stats.difficulties ?? {}).sort(),
    [data]
  );

  useEffect(() => {
    if (!selectedItem) {
      setSelectedId(null);
      setSelectedTokenIds([]);
      return;
    }

    setSelectedId(selectedItem.id);
    setSelectedTokenIds(selectedItem.handpickedExercise?.blankablePolishTokenIds ?? []);
  }, [selectedItem]);

  const selectedSet = useMemo(() => new Set(selectedTokenIds), [selectedTokenIds]);
  const canHandpick = !!selectedItem && !selectedItem.handpicked && selectedTokenIds.length > 0 && !isWorking;

  function resetPaging(nextAction: () => void) {
    setPage(1);
    nextAction();
  }

  function toggleToken(tokenId: string) {
    if (!selectedItem || selectedItem.handpicked || isWorking) {
      return;
    }

    setSelectedTokenIds((current) =>
      current.includes(tokenId)
        ? current.filter((id) => id !== tokenId)
        : [...current, tokenId]
    );
  }

  async function refreshCurrentPage() {
    const params = new URLSearchParams({
      source,
      page: String(page),
      pageSize: String(PAGE_SIZE),
      category,
      difficulty,
      handpicked: handpickedFilter,
      search,
    });
    const response = await fetch(`/api/curation/items?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? 'Unable to refresh curation items.');
    }

    setData(payload as CurationItemsResponse);
  }

  async function handpickSelected() {
    if (!selectedItem) {
      return;
    }

    setIsWorking(true);
    setNotice({ tone: 'info', text: 'Generating explanation and saving the exercise...' });

    try {
      await postJson<HandpickResponse>('/api/curation/handpick', {
        source,
        sourceId: selectedItem.id,
        selectedPolishTokenIds: selectedTokenIds,
      });
      await refreshCurrentPage();
      setNotice({ tone: 'success', text: 'Saved to handpicked exercises.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to handpick this sentence.',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function unhandpickSelected() {
    if (!selectedItem) {
      return;
    }

    setIsWorking(true);
    setNotice({ tone: 'info', text: 'Removing this sentence from the final exercise file...' });

    try {
      await postJson<UnhandpickResponse>('/api/curation/unhandpick', {
        source,
        sourceId: selectedItem.id,
      });
      await refreshCurrentPage();
      setNotice({ tone: 'success', text: 'Removed from handpicked exercises.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to unhandpick this sentence.',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function regenerateSelected() {
    if (!selectedItem) {
      return;
    }

    setIsWorking(true);
    setNotice({ tone: 'info', text: 'Regenerating explanation with OpenAI...' });

    try {
      await postJson<HandpickResponse>('/api/curation/regenerate', {
        source,
        sourceId: selectedItem.id,
      });
      await refreshCurrentPage();
      setNotice({ tone: 'success', text: 'Explanation regenerated.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to regenerate this explanation.',
      });
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Sentence Curation"
        description="Pick Polish words for future fill-the-blank exercises and save your final handpicked set."
        actions={
          <Badge tone={data?.stats.handpicked ? 'success' : 'neutral'}>
            {data?.stats.handpicked ?? 0} picked
          </Badge>
        }
      />

      <section className="mb-6 border-y border-gray-200 py-4 dark:border-gray-700">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            Source
            <Select
              value={source}
              onChange={(event) =>
                resetPaging(() => {
                  setSource(event.target.value as CurationSource);
                  setSelectedId(null);
                })
              }
            >
              <option value="book_exercises">{SOURCE_LABELS.book_exercises}</option>
              <option value="sentence_candidates">{SOURCE_LABELS.sentence_candidates}</option>
            </Select>
          </label>

          <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            Category
            <Select value={category} onChange={(event) => resetPaging(() => setCategory(event.target.value))}>
              <option value="all">All categories</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {labelize(option)}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            Difficulty
            <Select value={difficulty} onChange={(event) => resetPaging(() => setDifficulty(event.target.value))}>
              <option value="all">All levels</option>
              {difficultyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            Status
            <Select
              value={handpickedFilter}
              onChange={(event) => resetPaging(() => setHandpickedFilter(event.target.value))}
            >
              <option value="all">All</option>
              <option value="no">Not picked</option>
              <option value="yes">Picked</option>
            </Select>
          </label>

          <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            Search
            <Input
              value={search}
              onChange={(event) => resetPaging(() => setSearch(event.target.value))}
              placeholder="Polish or English"
            />
          </label>
        </div>
      </section>

      {notice ? (
        <div
          className={`mb-6 rounded-button border px-4 py-3 text-sm ${
            notice.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
              : notice.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <section className="min-h-[560px] border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">{SOURCE_LABELS[source]}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {data?.total ?? 0} matching sentences
              </p>
            </div>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary-500" /> : null}
          </div>

          <div className="max-h-[640px] divide-y divide-gray-200 overflow-auto dark:divide-gray-700">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`block w-full px-4 py-3 text-left transition-colors ${
                  selectedItem?.id === item.id
                    ? 'bg-primary-50 dark:bg-primary-950/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone={item.handpicked ? 'success' : 'neutral'}>
                    {item.handpicked ? 'Picked' : item.difficulty}
                  </Badge>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{labelize(item.category)}</span>
                </div>
                <p className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-white">{item.en}</p>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{item.pl}</p>
              </button>
            ))}

            {!isLoading && items.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                No sentences match these filters.
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!data || data.page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Page {data?.page ?? 1} of {data?.totalPages ?? 1}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!data || data.page >= data.totalPages || isLoading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="min-h-[560px] border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          {selectedItem ? (
            <SentenceDetail
              item={selectedItem}
              selectedTokenIds={selectedTokenIds}
              selectedSet={selectedSet}
              isWorking={isWorking}
              canHandpick={canHandpick}
              onToggleToken={toggleToken}
              onHandpick={handpickSelected}
              onUnhandpick={unhandpickSelected}
              onRegenerate={regenerateSelected}
            />
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center text-gray-500 dark:text-gray-400">
              Select a sentence to start curating.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SentenceDetail({
  item,
  selectedTokenIds,
  selectedSet,
  isWorking,
  canHandpick,
  onToggleToken,
  onHandpick,
  onUnhandpick,
  onRegenerate,
}: {
  item: CurationListItem;
  selectedTokenIds: string[];
  selectedSet: Set<string>;
  isWorking: boolean;
  canHandpick: boolean;
  onToggleToken: (tokenId: string) => void;
  onHandpick: () => void;
  onUnhandpick: () => void;
  onRegenerate: () => void;
}) {
  const hardTokenIds = item.polishTokens.map((token) => token.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={item.handpicked ? 'success' : 'primary'}>{item.handpicked ? 'Picked' : 'Ready'}</Badge>
        <Badge>{item.difficulty}</Badge>
        <Badge>{labelize(item.category)}</Badge>
        <Badge>{item.sentenceType}</Badge>
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">English</p>
          <p className="text-2xl font-semibold leading-relaxed text-gray-900 dark:text-white">{item.en}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Polish</p>
          <p className="text-2xl font-semibold leading-relaxed text-gray-900 dark:text-white">{item.pl}</p>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Blankable Polish words</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select the words that may disappear in future exercises.
            </p>
          </div>
          <Badge tone={selectedTokenIds.length > 0 ? 'primary' : 'neutral'}>{selectedTokenIds.length} selected</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {item.polishTokens.map((token) => {
            const selected = selectedSet.has(token.id);

            return (
              <button
                key={token.id}
                type="button"
                disabled={item.handpicked || isWorking}
                onClick={() => onToggleToken(token.id)}
                title={token.translation || token.normalized}
                className={`rounded-button border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                  selected
                    ? 'border-primary-500 bg-primary-500 text-white'
                    : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-700'
                } ${item.handpicked ? 'opacity-80' : ''}`}
              >
                {token.text}
              </button>
            );
          })}
        </div>

        {item.handpicked ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Unhandpick this sentence before changing selected blank words.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <PreviewPanel
          title="Easy"
          description="One selected word at a time."
          previews={selectedTokenIds.map((tokenId) => previewSentence(item.pl, item.polishTokens, [tokenId]))}
        />
        <PreviewPanel
          title="Medium"
          description="All selected words blanked together."
          previews={[previewSentence(item.pl, item.polishTokens, selectedTokenIds)]}
        />
        <PreviewPanel
          title="Hard"
          description="Full Polish sentence hidden."
          previews={[previewSentence(item.pl, item.polishTokens, hardTokenIds)]}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={!canHandpick} onClick={onHandpick}>
          {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Handpick
        </Button>
        <Button type="button" variant="secondary" disabled={!item.handpicked || isWorking} onClick={onRegenerate}>
          <RotateCcw className="h-4 w-4" />
          Regenerate explanation
        </Button>
        <Button type="button" variant="danger" disabled={!item.handpicked || isWorking} onClick={onUnhandpick}>
          <Trash2 className="h-4 w-4" />
          Unhandpick
        </Button>
      </div>

      {item.handpickedExercise ? (
        <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Generated explanation</h3>
          </div>
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
            <p>{item.handpickedExercise.explanation.summary}</p>
            <p>{item.handpickedExercise.explanation.usage}</p>

            {item.handpickedExercise.explanation.grammarNotes.length > 0 ? (
              <NoteList title="Grammar notes" notes={item.handpickedExercise.explanation.grammarNotes} />
            ) : null}

            {item.handpickedExercise.explanation.nuanceNotes.length > 0 ? (
              <NoteList title="Nuance notes" notes={item.handpickedExercise.explanation.nuanceNotes} />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PreviewPanel({ title, description, previews }: { title: string; description: string; previews: string[] }) {
  const visiblePreviews = previews.filter(Boolean);

  return (
    <div className="border border-gray-200 p-4 dark:border-gray-700">
      <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      {visiblePreviews.length > 0 ? (
        <div className="max-h-36 space-y-2 overflow-auto text-sm text-gray-700 dark:text-gray-200">
          {visiblePreviews.map((preview, index) => (
            <p key={`${title}-${index}`} className="rounded-button bg-gray-50 px-3 py-2 dark:bg-gray-900">
              {preview}
            </p>
          ))}
        </div>
      ) : (
        <p className="rounded-button bg-gray-50 px-3 py-2 text-sm text-gray-400 dark:bg-gray-900">
          Select a word first.
        </p>
      )}
    </div>
  );
}

function NoteList({ title, notes }: { title: string; notes: string[] }) {
  return (
    <div>
      <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">{title}</h4>
      <ul className="list-inside list-disc space-y-1">
        {notes.map((note, index) => (
          <li key={`${title}-${index}`}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function previewSentence(sentence: string, tokens: CurationToken[], blankTokenIds: string[]): string {
  const blankSet = new Set(blankTokenIds);
  let output = '';
  let cursor = 0;

  for (const token of tokens) {
    if (typeof token.start !== 'number' || typeof token.end !== 'number') {
      continue;
    }

    output += sentence.slice(cursor, token.start);
    output += blankSet.has(token.id) ? '___' : sentence.slice(token.start, token.end);
    cursor = token.end;
  }

  output += sentence.slice(cursor);
  return output;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed.');
  }

  return payload as T;
}

function labelize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
