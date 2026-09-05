import type { ReactNode } from 'react';

import { Eyebrow } from './eyebrow';

interface EmptyStateProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  variant?: 'plain' | 'blueprint';
}

/**
 * Без иллюстраций и без извинений: крупное объяснение,
 * одна причина и один следующий ход.
 */
export function EmptyState({
  eyebrow,
  title,
  description,
  actions,
  variant = 'plain',
}: EmptyStateProps) {
  return (
    <div
      className={
        variant === 'blueprint'
          ? 'blueprint grid place-items-center px-4 py-14 text-center sm:px-8'
          : 'card px-4 py-10 sm:px-8 sm:py-14'
      }
    >
      <div className={variant === 'blueprint' ? 'max-w-[560px]' : 'max-w-[680px]'}>
        {eyebrow ? <Eyebrow tone="dark">{eyebrow}</Eyebrow> : null}
        <h2 className="heading-2 mt-5">{title}</h2>
        <p className="body-l mt-4 text-muted">{description}</p>
        {actions ? <div className="mt-7 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
