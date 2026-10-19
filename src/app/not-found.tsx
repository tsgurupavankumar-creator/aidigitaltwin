import { Compass } from 'lucide-react';

import { StatusScreen } from '@/components/ui/StatusScreen';

export default function NotFoundPage() {
  return (
    <StatusScreen
      eyebrow="Page not found"
      title="This route is unavailable"
      description="The page you tried to open is not available in this experience. Return to the dashboard or continue your learning journey from the home screen."
      tone="neutral"
      icon={<Compass className="h-8 w-8 text-plum" />}
      primaryActionLabel="Go home"
      primaryActionHref="/"
    />
  );
}
