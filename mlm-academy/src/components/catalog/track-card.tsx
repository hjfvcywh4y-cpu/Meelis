import Link from 'next/link';

import { sectionAccentStyle } from '@/components/ui/section-accent';
import { StatusBadge } from '@/components/ui/status-badge';
import { routes } from '@/domain/routes';
import { getTrackStatusView } from '@/domain/status';
import type { PublicTrackMetadata, Section } from '@/domain/types';

interface TrackCardProps {
  track: PublicTrackMetadata;
  section: Pick<Section, 'sectionId' | 'shortTitle'>;
}

/**
 * Порядок информации задан продуктовой архитектурой:
 * раздел и ID → название → «Подходит, если» → «На выходе» → формат → статус → действие.
 * Длительность не показывается, потому что она не задана.
 */
export function TrackCard({ track, section }: TrackCardProps) {
  const status = getTrackStatusView(track);

  return (
    <article
      style={sectionAccentStyle(track.sectionId)}
      className="card card-interactive flex flex-col overflow-hidden"
    >
      <div aria-hidden="true" className="accent-strip h-3" />
      <div className="flex flex-1 flex-col p-5">
        <span className="meta-text">
          {track.trackId} / {section.shortTitle}
        </span>
        <h3 className="heading-3 mt-5 text-[22px] sm:text-[25px]">
          <Link
            href={routes.track(track.trackId)}
            className="underline-offset-4 hover:underline focus-visible:underline"
          >
            {track.title}
          </Link>
        </h3>

        <dl className="mt-5 grid gap-4">
          <div>
            <dt className="meta-text text-muted">Подходит, если</dt>
            <dd className="mt-1 text-[15px] leading-snug">{track.situation}</dd>
          </div>
          <div>
            <dt className="meta-text text-muted">На выходе</dt>
            <dd className="mt-1 text-[15px] leading-snug">{track.outcome}</dd>
          </div>
          <div>
            <dt className="meta-text text-muted">Формат</dt>
            <dd className="mt-1 text-[15px] leading-snug">{track.format}</dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-5">
          <StatusBadge label={status.label} tone={status.tone} />
          <Link href={routes.track(track.trackId)} className="btn btn-small">
            {status.canStart ? 'Открыть трек' : 'Смотреть карточку'}
          </Link>
        </div>
      </div>
    </article>
  );
}
