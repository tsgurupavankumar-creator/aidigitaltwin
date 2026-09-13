'use client';

import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

import { StatusScreen } from '@/components/ui/StatusScreen';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusScreen
      eyebrow="Error"
      title="Something went wrong"
      description={
        error?.message ||
        'The application hit an unexpected issue. Please retry this action or return to the dashboard.'
      }
      tone="danger"
      icon={<AlertTriangle className="h-8 w-8 text-burgundy" />}
      primaryActionLabel="Retry"
      onPrimaryAction={reset}
      secondaryActionLabel="Go home"
      secondaryActionHref="/"
    />
  );
}
