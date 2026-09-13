import { Wifi, WifiOff, Zap } from 'lucide-react';

import { StatusScreen } from '@/components/ui/StatusScreen';

export default function SlowNetworkPage() {
  return (
    <StatusScreen
      eyebrow="Slow connection"
      title="Your connection is unstable"
      description="The network is slower than usual, so some updates may take longer to load. Keep this page open and retry when the signal improves."
      tone="warning"
      icon={<Wifi className="h-8 w-8 text-mustard" />}
      primaryActionLabel="Retry"
      primaryActionHref="/"
      secondaryActionLabel="Use offline mode"
      secondaryActionHref="/"
    />
  );
}
