import { WifiOff } from 'lucide-react';

import { StatusScreen } from '@/components/ui/StatusScreen';

export default function NoNetworkPage() {
  return (
    <StatusScreen
      eyebrow="No internet"
      title="You are offline"
      description="Your device is not connected to the internet right now. Cached academic updates can still be reviewed when the connection returns."
      tone="neutral"
      icon={<WifiOff className="h-8 w-8 text-plum" />}
      primaryActionLabel="Retry connection"
      primaryActionHref="/"
      secondaryActionLabel="Go home"
      secondaryActionHref="/"
    />
  );
}
