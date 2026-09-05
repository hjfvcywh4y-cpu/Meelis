import { cn } from '@/lib/cn';

export type StatusTone = 'neutral' | 'positive' | 'waiting' | 'muted' | 'danger';

const TONE_MARKER: Record<StatusTone, string> = {
  neutral: 'bg-surface',
  positive: 'bg-success',
  waiting: 'bg-warning',
  muted: 'bg-transparent',
  danger: 'bg-danger',
};

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

/** Статус — всегда текст плюс метка. Цвет никогда не единственный носитель смысла. */
export function StatusBadge({ label, tone = 'neutral', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-[12px] leading-tight font-bold tracking-[0.04em] uppercase',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('inline-block size-[10px] shrink-0 border border-ink', TONE_MARKER[tone])}
      />
      {label}
    </span>
  );
}
