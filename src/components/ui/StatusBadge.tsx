import { cn } from '@/lib/utils';
import { RiskLevel, AgentStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: RiskLevel | AgentStatus | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getBadgeStyle = (val: string) => {
    switch (val) {
      case 'CRITICAL':
        return 'bg-red-400/10 text-red-400 border-red-400/20';
      case 'HIGH':
        return 'bg-amber-400/10 text-amber-400 border-amber-400/20';
      case 'MEDIUM':
        return 'bg-amber-400/5 text-amber-300 border-amber-300/20';
      case 'LOW':
      case 'GOOD':
      case 'ACTIVE':
      case 'COMPLETED':
        return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20';
      case 'PROCESSING':
        return 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20';
      case 'WAITING':
      case 'PENDING':
        return 'bg-white/5 text-muted-foreground border-white/10';
      default:
        return 'bg-white/5 text-muted-foreground border-white/10';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors',
        getBadgeStyle(status),
        className
      )}
    >
      {status}
    </span>
  );
}
