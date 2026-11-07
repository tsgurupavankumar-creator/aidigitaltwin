import { cn } from '@/lib/utils';

interface HairlineRuleProps {
  className?: string;
  variant?: 'default' | 'accent' | 'terracotta' | 'plum' | 'olive' | 'navy';
  width?: string;
}

export function HairlineRule({ className, variant = 'default', width }: HairlineRuleProps) {
  return (
    <hr
      className={cn(
        'border-0',
        variant === 'default' && 'h-[1px] bg-paper-3 w-full',
        variant === 'accent' && 'h-[2px] bg-terracotta w-12',
        variant === 'terracotta' && 'h-[2px] bg-terracotta w-12',
        variant === 'plum' && 'h-[2px] bg-plum w-12',
        variant === 'olive' && 'h-[2px] bg-olive w-12',
        variant === 'navy' && 'h-[2px] bg-navy w-12',
        className
      )}
      style={width ? { width } : undefined}
    />
  );
}
