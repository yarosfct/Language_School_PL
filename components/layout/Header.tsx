'use client';

import { usePathname } from 'next/navigation';
import { BookOpenText, Menu, Volume2, VolumeX } from 'lucide-react';
import { useStore } from '@/lib/store/useStore';
import { navigation } from '@/components/layout/Sidebar';

function getPageTitle(pathname: string | null) {
  if (!pathname) return 'Dashboard';

  const match = navigation.find((item) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  if (match) return match.name;

  if (pathname.startsWith('/lesson')) return 'Lesson';
  if (pathname.startsWith('/topic')) return 'Topic';

  return 'Dashboard';
}

export function Header({
  isSidebarOpen,
  onToggleSidebar,
  onOpenNotebook,
}: {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenNotebook: () => void;
}) {
  const { soundEnabled, toggleSound } = useStore();
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="relative border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6 sm:py-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex items-center justify-center rounded-full border border-gray-200 p-2 transition-colors duration-default ease-subtle hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-700 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900"
          aria-label={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          aria-expanded={isSidebarOpen}
        >
          <Menu className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">
            {title}
          </h1>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            type="button"
            onClick={onOpenNotebook}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors duration-default ease-subtle hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900"
            aria-label="Open notebook"
          >
            <BookOpenText className="h-4 w-4" />
            <span className="hidden sm:inline">Notebook</span>
          </button>

          <button
            type="button"
            onClick={toggleSound}
            className="inline-flex items-center justify-center rounded-full border border-gray-200 p-2 transition-colors duration-default ease-subtle hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-700 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900"
            aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
          >
            {soundEnabled ? (
              <Volume2 className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            ) : (
              <VolumeX className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
