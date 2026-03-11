'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, BookMarked, BookOpen, FileText, Home, RotateCcw, Settings } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Learn', href: '/learn', icon: BookOpen },
  { name: 'Flashcards', href: '/learn/flashcards', icon: BookOpen },
  { name: 'Review', href: '/review', icon: RotateCcw },
  { name: 'Mistakes', href: '/mistakes', icon: AlertCircle },
  { name: 'Vocabulary', href: '/vocabulary', icon: BookMarked },
  { name: 'Grammar', href: '/grammar', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:block">
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-200 p-6 dark:border-gray-700">
          <Link href="/" className="flex items-center space-x-2">
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
                className={`flex items-center space-x-3 rounded-lg px-4 py-3 transition-colors ${
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
    </aside>
  );
}
