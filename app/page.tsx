'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Target, TrendingUp, Calendar } from 'lucide-react';
import Link from 'next/link';
import { getUserProgress, getDueReviewCards, initializeDatabase } from '@/lib/db';
import { UserProgress } from '@/types/progress';
import { Badge, ButtonLink, Card, PageHeader, SectionTitle } from '@/components/ui/primitives';

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
    <div>
      <PageHeader
        title="PolskiOdZera"
        description="Learn Polish from Zero with focused daily practice."
      />

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

      <Card className="mb-8">
        <SectionTitle title="Quick Actions" description="Jump into your next high-impact study step." />
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
      </Card>

      <Card className="bg-gradient-to-r from-primary-600 to-primary-700 text-white border-primary-500 shadow-card">
        <Badge tone="success" className="mb-3 bg-white/15 text-white">
          Daily Progress
        </Badge>
        <h2 className="mb-4 text-3xl font-bold">Welcome back, let&apos;s keep momentum.</h2>
        <p className="mb-6 text-base sm:text-lg text-white/90">
          Master Polish through structured lessons, adaptive review, and targeted practice.
        </p>
        <ButtonLink
          href="/learn"
          variant="secondary"
          size="lg"
          className="border-white/70 bg-white text-primary-700 hover:bg-white/90"
        >
          Start Learning
        </ButtonLink>
      </Card>
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
    blue: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200',
    green: 'bg-accent-100 text-accent-600 dark:bg-emerald-900/40 dark:text-emerald-300',
    purple: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    orange: 'bg-warning-100 text-warning-600 dark:bg-amber-900/40 dark:text-amber-300',
  };

  return (
    <Card>
      <div className={`mb-4 inline-flex rounded-lg p-3 ${colorClasses[color as keyof typeof colorClasses]}`}>{icon}</div>
      <h3 className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </Card>
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
    orange: 'border-warning-500 hover:bg-warning-50 dark:hover:bg-amber-900/20',
    red: 'border-destructive-500 hover:bg-destructive-50 dark:hover:bg-red-900/20',
    teal: 'border-accent-500 hover:bg-accent-50 dark:hover:bg-emerald-900/20',
  };

  return (
    <Link
      href={href}
      className={`block rounded-card border-2 p-4 transition-colors duration-default ease-subtle cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${colorClasses[color as keyof typeof colorClasses]}`}
    >
      <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </Link>
  );
}


