'use client';

import { AlertTriangle } from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/ui/primitives';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl py-12">
      <PageHeader title="Something went wrong" description="An unexpected error occurred while loading this page." />
      <Card accent="danger">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive-100 p-2 dark:bg-red-900/40">
            <AlertTriangle className="h-5 w-5 text-destructive-600 dark:text-red-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Error details</p>
            <p className="mt-1 break-words text-sm text-gray-600 dark:text-gray-300">
              {error.message || 'Unknown error'}
            </p>
            <div className="mt-4">
              <Button onClick={reset} variant="danger">
                Try again
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
