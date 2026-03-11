'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Target, TrendingUp, Calendar } from 'lucide-react';
import Link from 'next/link';
import { getUserProgress, getDueReviewCards, initializeDatabase } from '@/lib/db';
import { UserProgress } from '@/types/progress';

export default function HomePage() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        await initializeDatabase();
        const userProgress = await getUserProgress();
        setProgress(userProgress);

        const dueCards = await getDueReviewCards();
        setDueCount(dueCards.length);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">PolskiOdZera</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">Learn Polish from Zero</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<BookOpen className="h-6 w-6" />}
          title="Lessons Completed"
          value={progress?.lessonsCompleted.length || 0}
          color="blue"
        />
        <StatCard
          icon={<Target className="h-6 w-6" />}
          title="Total Score"
          value={progress?.totalScore || 0}
          color="green"
        />
        <StatCard
          icon={<TrendingUp className="h-6 w-6" />}
          title="Current Streak"
          value={`${progress?.streak || 0} days`}
          color="purple"
        />
        <StatCard
          icon={<Calendar className="h-6 w-6" />}
          title="Reviews Due"
          value={dueCount}
          color="orange"
        />
      </div>

      <div className="mb-8 rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
        <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ActionButton
            href="/learn"
            title="Continue Learning"
            description="Resume your current lesson"
            color="primary"
          />
          <ActionButton
            href="/learn"
            title="Plan Session"
            description="Configure your next drill"
            color="teal"
          />
          {dueCount > 0 && (
            <ActionButton
              href="/review"
              title="Review Now"
              description={`${dueCount} ${dueCount === 1 ? 'card' : 'cards'} due`}
              color="orange"
            />
          )}
          <ActionButton
            href="/mistakes"
            title="Mistakes Notebook"
            description="Review your weak areas"
            color="red"
          />
        </div>
      </div>

      <div className="rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 p-8 text-white shadow-md">
        <h2 className="mb-4 text-3xl font-bold">Welcome to PolskiOdZera!</h2>
        <p className="mb-6 text-lg">
          Master Polish through structured lessons, adaptive review, and targeted practice. Your journey starts here!
        </p>
        <Link
          href="/learn"
          className="inline-block rounded-lg bg-white px-6 py-3 font-semibold text-primary-600 transition-colors hover:bg-gray-100"
        >
          Start Learning
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  color: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
    green: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300',
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
      <div className={`mb-4 inline-flex rounded-lg p-3 ${colorClasses[color as keyof typeof colorClasses]}`}>{icon}</div>
      <h3 className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function ActionButton({
  href,
  title,
  description,
  color,
}: {
  href: string;
  title: string;
  description: string;
  color: string;
}) {
  const colorClasses = {
    primary: 'border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20',
    orange: 'border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20',
    red: 'border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
    teal: 'border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20',
  };

  return (
    <Link
      href={href}
      className={`block rounded-lg border-2 p-4 transition-colors ${colorClasses[color as keyof typeof colorClasses]}`}
    >
      <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </Link>
  );
}


