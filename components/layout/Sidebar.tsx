'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, BookMarked, BookOpen, FileText, Flag, Home, RotateCcw, Settings, Target, X } from 'lucide-react';

export const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Learn', href: '/learn', icon: BookOpen },
  { name: 'Fill Blanks', href: '/fill-blanks', icon: Target },
  { name: 'Flashcards', href: '/learn/flashcards', icon: BookOpen },
  { name: 'Review', href: '/review', icon: RotateCcw },
  { name: 'Mistakes', href: '/mistakes', icon: AlertCircle },
  { name: 'Vocabulary', href: '/vocabulary', icon: BookMarked },
  { name: 'Grammar', href: '/grammar', icon: FileText },
  { name: 'Curate', href: '/curate', icon: Flag },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-gray-950/35 transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <div className={`hidden shrink-0 transition-[width] duration-300 md:block ${isOpen ? 'w-64' : 'w-0'}`}>
        <aside
          className={`h-full w-64 border-r border-gray-200 bg-white transition-transform duration-300 dark:border-gray-700 dark:bg-gray-800 ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <SidebarContent pathname={pathname} onNavigate={() => {}} />
        </aside>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-gray-200 bg-white transition-transform duration-300 dark:border-gray-700 dark:bg-gray-800 md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-end border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SidebarContent pathname={pathname} onNavigate={onClose} />
      </aside>
    </>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string | null; onNavigate: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 p-6 dark:border-gray-700">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center space-x-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500 text-xl font-bold text-white">
            P
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">PolskiOdZera</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={`flex cursor-pointer items-center space-x-3 rounded-lg px-4 py-3 transition-colors duration-default ease-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${
                isActive
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-4 dark:border-gray-700">
        <div className="text-center text-xs text-gray-500 dark:text-gray-400">Version 0.1.0 (MVP)</div>
      </div>
    </div>
  );
}
