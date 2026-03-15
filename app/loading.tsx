import { Card } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl py-16">
      <Card className="animate-pulse">
        <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-4 h-8 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-6 space-y-3">
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-11/12 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </Card>
    </div>
  );
}
