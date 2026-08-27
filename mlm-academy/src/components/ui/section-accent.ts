import type { CSSProperties } from 'react';

import type { SectionId } from '@/domain/types';

/** Один акцент раздела на карточке. Цвет задаётся переменной, а не классом-заливкой. */
export function sectionAccentStyle(sectionId: SectionId): CSSProperties {
  return { '--accent': `var(--section-${sectionId.toLowerCase()})` } as CSSProperties;
}
