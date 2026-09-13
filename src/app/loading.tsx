import { Loader } from 'lucide-react';

import { StatusScreen } from '@/components/ui/StatusScreen';

export default function LoadingPage() {
  return (
    <StatusScreen
      eyebrow="Loading"
      title="Preparing your academic workspace"
      description="We are loading your dashboard, learning insights, and real-time recommendations so you can continue without friction."
      tone="default"
      icon={<Loader className="h-8 w-8 animate-spin text-terracotta" />}
    />
  );
}
