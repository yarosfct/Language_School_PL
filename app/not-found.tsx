import { Compass } from 'lucide-react';
import { ButtonLink, Card, PageHeader } from '@/components/ui/primitives';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl py-12">
      <PageHeader title="Page not found" description="The page you were looking for does not exist or has moved." />
      <Card accent="info">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Try returning to your dashboard or continue your learning session from the main navigation.
            </p>
            <div className="mt-4">
              <ButtonLink href="/" variant="primary">
                Back to dashboard
              </ButtonLink>
            </div>
          </div>
          <div className="rounded-full bg-info-100 p-3 dark:bg-blue-900/40">
            <Compass className="h-6 w-6 text-info-600 dark:text-blue-300" />
          </div>
        </div>
      </Card>
    </div>
  );
}
