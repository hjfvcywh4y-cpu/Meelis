import Link from 'next/link';

import { sectionAccentStyle } from '@/components/ui/section-accent';
import { StatusBadge } from '@/components/ui/status-badge';
import { routes } from '@/domain/routes';
import type { Section } from '@/domain/types';

interface SectionCardProps {
  section: Section;
  total: number;
  published: number;
}

export function SectionCard({ section, total, published }: SectionCardProps) {
  return (
    <Link
      href={routes.section(section.sectionId)}
      style={sectionAccentStyle(section.sectionId)}
      className="card card-interactive group flex min-h-[240px] flex-col overflow-hidden pt-5 pr-5 pb-5 pl-8 sm:min-h-[270px]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-3 border-r-2 border-ink bg-[var(--accent)]"
      />
      <span className="meta-text">
        {section.sectionId} / {total} {pluralTracks(total)}
      </span>
      <h3 className="heading-3 mt-7 text-[26px] sm:text-[30px]">{section.shortTitle}</h3>
      <p className="mt-4 max-w-[36ch] text-[16px] leading-snug text-muted sm:text-[17px]">
        {section.entryQuestion}
      </p>
      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        <StatusBadge
          label={published > 0 ? `Доступно ${published}` : 'Готовится'}
          tone={published > 0 ? 'positive' : 'waiting'}
        />
        <span aria-hidden="true" className="text-[30px] leading-none">
          →
        </span>
      </div>
    </Link>
  );
}

export function pluralTracks(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'трек';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'трека';
  return 'треков';
}
