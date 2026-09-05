import type { CSSProperties } from 'react';

import type { SectionId } from '@/domain/types';

/**
 * Синий A1 — единственный акцент, на котором чёрный текст не проходит AA,
 * поэтому вместе с цветом раздела всегда передаётся корректный цвет текста.
 */
const ACCENT_INK: Record<SectionId, string> = {
  A1: '#ffffff',
  A2: 'var(--color-ink)',
  A3: 'var(--color-ink)',
  A4: 'var(--color-ink)',
  A5: 'var(--color-ink)',
  A6: 'var(--color-ink)',
};

/** Один акцент раздела на карточке. Цвет задаётся переменной, а не классом-заливкой. */
export function sectionAccentStyle(sectionId: SectionId): CSSProperties {
  return {
    '--accent': `var(--section-${sectionId.toLowerCase()})`,
    '--accent-ink': ACCENT_INK[sectionId],
  } as CSSProperties;
}
