import { ShieldAlert } from 'lucide-react';

import { StatusScreen } from '@/components/ui/StatusScreen';

export default function UnknownErrorPage() {
  return (
    <StatusScreen
      eyebrow="Unknown error"
      title="We hit a technical issue"
      description="Something unexpected happened while loading the workspace. Please refresh, return home, or try again in a moment."
      tone="danger"
      icon={<ShieldAlert className="h-8 w-8 text-burgundy" />}
      primaryActionLabel="Retry"
      primaryActionHref="/"
      secondaryActionLabel="Go home"
      secondaryActionHref="/"
    />
  );
}
