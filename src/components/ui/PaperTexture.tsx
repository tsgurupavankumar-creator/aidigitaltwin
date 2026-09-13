import { cn } from '@/lib/utils';

interface PaperTextureProps {
  className?: string;
  children?: React.ReactNode;
}

export function PaperTexture({ className, children }: PaperTextureProps) {
  return (
    <div className={cn('paper-texture relative', className)}>
      {children}
    </div>
  );
}
