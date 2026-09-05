import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface EyebrowProps {
  children: ReactNode;
  tone?: 'default' | 'dark' | 'accent';
  className?: string;
  as?: 'span' | 'div';
}

export function Eyebrow({ children, tone = 'default', className, as = 'span' }: EyebrowProps) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        'eyebrow',
        tone === 'dark' && 'eyebrow-dark',
        tone === 'accent' && 'eyebrow-accent',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
