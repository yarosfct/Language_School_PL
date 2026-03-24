'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { NotebookPanel } from '@/components/notebook/NotebookPanel';
import { useStore } from '@/lib/store/useStore';

export function AppShell({ children }: { children: ReactNode }) {
  const { sidebarVisible, setSidebarVisible, toggleSidebar } = useStore();
  const [notebookOpen, setNotebookOpen] = useState(false);

  useEffect(() => {
    function handleNotebookShortcut(event: KeyboardEvent) {
      if (!event.ctrlKey || event.key !== 'Enter') {
        return;
      }

      const target = event.target;
      const isNotebookTarget = target instanceof HTMLElement && target.closest('[data-notebook-panel="true"]');

      event.preventDefault();
      event.stopPropagation();

      if (isNotebookTarget && notebookOpen) {
        window.dispatchEvent(new CustomEvent('notebook-save-and-close'));
        return;
      }

      setNotebookOpen((previous) => !previous);
    }

    window.addEventListener('keydown', handleNotebookShortcut, true);
    return () => window.removeEventListener('keydown', handleNotebookShortcut, true);
  }, [notebookOpen]);

  return (
    <div className="flex h-screen bg-surface-50 dark:bg-gray-900">
      <Sidebar isOpen={sidebarVisible} onClose={() => setSidebarVisible(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          isSidebarOpen={sidebarVisible}
          onToggleSidebar={toggleSidebar}
          onOpenNotebook={() => setNotebookOpen(true)}
        />
        <main className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
      <NotebookPanel isOpen={notebookOpen} onClose={() => setNotebookOpen(false)} />
    </div>
  );
}