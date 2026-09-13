'use client';

import { AlertTriangle } from 'lucide-react';

import { StatusScreen } from '@/components/ui/StatusScreen';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <StatusScreen
          eyebrow="Unknown error"
          title="The app could not load"
          description={
            error?.message ||
            'An unexpected application error occurred. Refreshing the page or returning to the homepage should resolve it.'
          }
          tone="danger"
          icon={<AlertTriangle className="h-8 w-8 text-burgundy" />}
          primaryActionLabel="Retry"
          onPrimaryAction={reset}
          secondaryActionLabel="Go home"
          secondaryActionHref="/"
        />
      </body>
    </html>
  );
}
