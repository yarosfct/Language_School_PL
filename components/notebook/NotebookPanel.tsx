'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeft, BookOpenText, Plus, Save, Tag, Trash2, X } from 'lucide-react';
import { Badge, Button, Input } from '@/components/ui/primitives';
import { resolveNotebookContext } from '@/lib/notebook/context';
import {
  deleteNotebookEntry,
  getAllNotebookEntries,
  initializeDatabase,
  saveNotebookEntry,
} from '@/lib/db';
import { convertAsteriskPolish, generateId } from '@/lib/utils/string';
import type { NotebookContextSnapshot, NotebookEntry } from '@/types/notebook';

interface NotebookPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function NotebookPanel({ isOpen, onClose }: NotebookPanelProps) {
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const paramsKey = searchParams.toString();
  const saveTimeoutRef = useRef<number | null>(null);
  const startNoteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [context, setContext] = useState<NotebookContextSnapshot | null>(null);
  const [notebooks, setNotebooks] = useState<NotebookEntry[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftCategories, setDraftCategories] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const selectedNotebook = useMemo(
    () => notebooks.find((entry) => entry.id === selectedNotebookId) ?? null,
    [notebooks, selectedNotebookId]
  );

  const matchingNotebooks = useMemo(() => {
    if (!context) {
      return [];
    }

    return notebooks.filter((entry) => entry.contextKey === context.key);
  }, [context, notebooks]);

  const allOtherNotebooks = useMemo(
    () => notebooks.filter((entry) => entry.id !== selectedNotebookId),
    [notebooks, selectedNotebookId]
  );

  const shouldShowChooser = isOpen && !selectedNotebookId && matchingNotebooks.length > 0;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      await initializeDatabase();
      const [resolvedContext, storedNotebooks] = await Promise.all([
        resolveNotebookContext(pathname, new URLSearchParams(paramsKey)),
        getAllNotebookEntries(),
      ]);

      if (!isMounted) {
        return;
      }

      const defaultNotebook = storedNotebooks.find(
        (entry) => entry.contextKey === resolvedContext.key
      );

      setContext(resolvedContext);
      setNotebooks(storedNotebooks);

      if (defaultNotebook) {
        setSelectedNotebookId(defaultNotebook.id);
        setDraftName(defaultNotebook.name);
        setDraftCategories(defaultNotebook.categories.join(', '));
        setDraftContent(defaultNotebook.content);
        setSaveState('saved');
        return;
      }

      setSelectedNotebookId(null);
      setDraftName(resolvedContext.suggestedName);
      setDraftCategories(resolvedContext.categories.join(', '));
      setDraftContent('');
      setSaveState('idle');
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [pathname, paramsKey, isOpen]);

  useEffect(() => {
    function handleSaveAndClose() {
      if (!isOpen) {
        return;
      }

      void saveAndCloseNotebook();
    }

    window.addEventListener('notebook-save-and-close', handleSaveAndClose);
    return () => window.removeEventListener('notebook-save-and-close', handleSaveAndClose);
  }, [isOpen, context, selectedNotebook, draftName, draftCategories, draftContent]);

  useEffect(() => {
    if (!isOpen) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement.closest('[data-notebook-panel="true"]')) {
        activeElement.blur();
      }
      return;
    }

    const focusTarget = selectedNotebook ? noteTextareaRef.current : startNoteTextareaRef.current;
    if (!focusTarget) {
      return;
    }

    window.requestAnimationFrame(() => {
      focusTarget.focus();
      if (focusTarget instanceof HTMLTextAreaElement || focusTarget instanceof HTMLInputElement) {
        const length = focusTarget.value.length;
        focusTarget.setSelectionRange(length, length);
      }
    });
  }, [isOpen, selectedNotebookId, shouldShowChooser]);

  useEffect(() => {
    if (!selectedNotebook) {
      return;
    }

    const categories = parseCategories(draftCategories);
    const hasChanges =
      selectedNotebook.name !== draftName.trim() ||
      selectedNotebook.content !== draftContent ||
      selectedNotebook.contextKey !== context?.key ||
      selectedNotebook.contextLabel !== context?.label ||
      selectedNotebook.lastPathname !== context?.pathname ||
      JSON.stringify(selectedNotebook.categories) !== JSON.stringify(categories);

    if (!hasChanges) {
      return;
    }

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    setSaveState('saving');
    saveTimeoutRef.current = window.setTimeout(() => {
      void persistNotebook({
        ...selectedNotebook,
        name: draftName.trim() || context?.suggestedName || 'Notebook',
        content: draftContent,
        categories,
        contextKey: context?.key,
        contextLabel: context?.label,
        lastPathname: context?.pathname,
      });
    }, 450);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [context, draftCategories, draftContent, draftName, selectedNotebook]);

  async function persistNotebook(entry: NotebookEntry) {
    try {
      const updatedAt = Date.now();
      const id = await saveNotebookEntry(entry);
      const savedEntry: NotebookEntry = {
        ...entry,
        id,
        updatedAt,
      };

      setNotebooks((previous) => {
        const others = previous.filter((item) => item.id !== id);
        return [savedEntry, ...others].sort((left, right) => right.updatedAt - left.updatedAt);
      });
      setSaveState('saved');
    } catch (error) {
      console.error('Failed to save notebook entry', error);
      setSaveState('error');
    }
  }

  function closeNotebook() {
    onClose();
    window.dispatchEvent(new CustomEvent('notebook-closed'));
  }

  async function saveAndCloseNotebook() {
    if (!context) {
      closeNotebook();
      return;
    }

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const normalizedName = convertAsteriskPolish(draftName).trim() || context.suggestedName;
    const normalizedCategories = parseCategories(convertAsteriskPolish(draftCategories));
    const normalizedContent = convertAsteriskPolish(draftContent);

    if (selectedNotebook) {
      await persistNotebook({
        ...selectedNotebook,
        name: normalizedName,
        content: normalizedContent,
        categories: normalizedCategories,
        contextKey: context.key,
        contextLabel: context.label,
        lastPathname: context.pathname,
      });
      closeNotebook();
      return;
    }

    const shouldCreate =
      normalizedContent.trim().length > 0 ||
      normalizedName.trim().length > 0 ||
      normalizedCategories.length > 0;

    if (shouldCreate) {
      const now = Date.now();
      const notebook: NotebookEntry = {
        id: generateId(),
        name: normalizedName,
        content: normalizedContent,
        categories: normalizedCategories.length > 0 ? normalizedCategories : context.categories,
        contextKey: context.key,
        contextLabel: context.label,
        lastPathname: context.pathname,
        createdAt: now,
        updatedAt: now,
      };

      await persistNotebook(notebook);
      setSelectedNotebookId(notebook.id);
    }

    closeNotebook();
  }

  function loadNotebook(entry: NotebookEntry) {
    setSelectedNotebookId(entry.id);
    setDraftName(entry.name);
    setDraftCategories(entry.categories.join(', '));
    setDraftContent(entry.content);
    setSaveState('saved');
  }

  async function createNotebook() {
    if (!context) {
      return;
    }

    const now = Date.now();
    const notebook: NotebookEntry = {
      id: generateId(),
      name: draftName.trim() || context.suggestedName,
      content: draftContent,
      categories: parseCategories(draftCategories.length > 0 ? draftCategories : context.categories.join(', ')),
      contextKey: context.key,
      contextLabel: context.label,
      lastPathname: context.pathname,
      createdAt: now,
      updatedAt: now,
    };

    await persistNotebook(notebook);
    setSelectedNotebookId(notebook.id);
  }

  async function handleDeleteNotebook() {
    if (!selectedNotebook) {
      return;
    }

    await deleteNotebookEntry(selectedNotebook.id);
    setNotebooks((previous) => previous.filter((entry) => entry.id !== selectedNotebook.id));
    setSelectedNotebookId(null);
    if (context) {
      setDraftName(context.suggestedName);
      setDraftCategories(context.categories.join(', '));
      setDraftContent('');
    }
    setSaveState('idle');
  }

  return (
    <aside
      data-notebook-panel="true"
      className={`fixed inset-y-3 right-3 z-50 flex w-[min(26rem,calc(100vw-1.5rem))] max-w-full transform flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white/98 shadow-2xl backdrop-blur transition-transform duration-300 ease-subtle dark:border-gray-700 dark:bg-gray-900/95 ${
        isOpen ? 'translate-x-0' : 'translate-x-[110%]'
      }`}
      aria-hidden={!isOpen}
    >
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-200">
            <BookOpenText className="h-3.5 w-3.5" />
            Notebook
          </div>
          <h2 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
            {context?.label ?? 'Notebook'}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Keep notes without leaving your current exercise.
          </p>
        </div>

        <button
          type="button"
          onClick={closeNotebook}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="Close notebook"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {shouldShowChooser ? (
          <div className="space-y-5">
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Existing notebooks for this context
              </h3>
              <div className="mt-3 space-y-3">
                {matchingNotebooks.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => loadNotebook(entry)}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-gray-700 dark:bg-gray-800/70 dark:hover:border-primary-700 dark:hover:bg-primary-900/20"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-gray-900 dark:text-white">{entry.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Use existing</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                      {entry.content.trim() || 'Empty notebook'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.categories.map((category) => (
                        <Badge key={category}>{category}</Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-dashed border-primary-300 bg-primary-50/60 p-4 dark:border-primary-700 dark:bg-primary-900/15">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Create a new notebook</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    It starts with the current section name, and you can rename it first.
                  </p>
                </div>
                <Button type="button" onClick={createNotebook}>
                  <Plus className="h-4 w-4" />
                  Create
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                <Input
                  value={draftName}
                  onChange={(event) => setDraftName(convertAsteriskPolish(event.target.value))}
                  placeholder="Notebook name"
                />
                <Input
                  value={draftCategories}
                  onChange={(event) => setDraftCategories(convertAsteriskPolish(event.target.value))}
                  placeholder="Categories, separated by commas"
                />
              </div>
            </section>

            {allOtherNotebooks.length > matchingNotebooks.length ? (
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Other notebooks
                </h3>
                <div className="mt-3 space-y-2">
                  {allOtherNotebooks
                    .filter((entry) => entry.contextKey !== context?.key)
                    .slice(0, 6)
                    .map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => loadNotebook(entry)}
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        <div className="font-medium text-gray-900 dark:text-white">{entry.name}</div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{entry.contextLabel ?? 'Notebook'}</div>
                      </button>
                    ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedNotebookId(null);
                  if (context) {
                    setDraftName(context.suggestedName);
                    setDraftCategories(context.categories.join(', '));
                    setDraftContent('');
                  }
                  setSaveState('idle');
                }}
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                {matchingNotebooks.length > 0 ? 'Back to choices' : 'New notebook'}
              </button>

              {selectedNotebook ? (
                <Button type="button" variant="ghost" onClick={handleDeleteNotebook}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              ) : null}
            </div>

            {!selectedNotebook ? (
              <section className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Notebook name
                  </label>
                  <Input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    placeholder="Notebook name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Categories
                  </label>
                  <Input
                    value={draftCategories}
                    onChange={(event) => setDraftCategories(event.target.value)}
                    placeholder="Categories, separated by commas"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Start note
                  </label>
                  <textarea
                    ref={startNoteTextareaRef}
                    value={draftContent}
                    onChange={(event) => setDraftContent(convertAsteriskPolish(event.target.value))}
                    placeholder="Write something before saving this notebook."
                    className="min-h-40 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus-visible:ring-offset-gray-900"
                  />
                </div>

                <Button type="button" onClick={createNotebook} className="w-full justify-center">
                  <Plus className="h-4 w-4" />
                  Create notebook
                </Button>
              </section>
            ) : null}

            {selectedNotebook ? (
              <section className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Notebook name
                  </label>
                  <Input
                    value={draftName}
                    onChange={(event) => setDraftName(convertAsteriskPolish(event.target.value))}
                    placeholder="Notebook name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Categories
                  </label>
                  <Input
                    value={draftCategories}
                    onChange={(event) => setDraftCategories(convertAsteriskPolish(event.target.value))}
                    placeholder="Categories, separated by commas"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {parseCategories(draftCategories).map((category) => (
                      <Badge key={category} className="gap-1">
                        <Tag className="h-3 w-3" />
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Notes
                  </label>
                  <textarea
                    ref={noteTextareaRef}
                    value={draftContent}
                    onChange={(event) => setDraftContent(convertAsteriskPolish(event.target.value))}
                    placeholder="Write notes, examples, reminders, or vocabulary here."
                    className="min-h-[22rem] w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus-visible:ring-offset-gray-900"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm dark:bg-gray-800/70">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <Save className="h-4 w-4" />
                    {saveState === 'saving'
                      ? 'Saving...'
                      : saveState === 'saved'
                      ? 'Saved'
                      : saveState === 'error'
                      ? 'Save failed'
                      : 'Ready'}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedNotebook.contextLabel ?? context?.label}
                  </span>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}

function parseCategories(input: string): string[] {
  return [...new Set(input.split(',').map((value) => value.trim()).filter(Boolean))];
}