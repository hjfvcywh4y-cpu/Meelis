import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { PageView } from '@/components/analytics/page-view';
import { TrackActions } from '@/components/track/track-actions';
import {
  NextTrackRecommendations,
  TrackCompletionPanel,
  TrackEvidencePanel,
  TrackHeader,
  TrackPassport,
  TrackProgressPanel,
  TrackStepNavigation,
  TrackStepViewport,
  type TrackStep,
} from '@/components/track/track-player';
import { sectionAccentStyle } from '@/components/ui/section-accent';
import { isCanonicalParam, normalizeTrackId, routes } from '@/domain/routes';
import { recommendNextTracks } from '@/domain/recommendations';
import { getTrackStatusView } from '@/domain/status';
import { getPublicTrack, getSection, getSections, getVisibleTrackIndex } from '@/server/catalog';
import { isPreviewEnabled } from '@/server/flags';

interface TrackPageProps {
  params: Promise<{ trackId: string }>;
}

export async function generateMetadata({ params }: TrackPageProps): Promise<Metadata> {
  const { trackId: raw } = await params;
  const trackId = normalizeTrackId(raw);
  const track = trackId ? getPublicTrack(trackId, { preview: isPreviewEnabled() }) : null;
  if (!track) return { title: 'Трек не найден' };
  return { title: `${track.trackId} · ${track.title}`, description: track.outcome };
}

export default async function TrackPage({ params }: TrackPageProps) {
  const { trackId: raw } = await params;
  const trackId = normalizeTrackId(raw);
  if (!trackId) notFound();

  if (!isCanonicalParam(raw)) permanentRedirect(routes.track(trackId));

  const preview = isPreviewEnabled();
  const track = getPublicTrack(trackId, { preview });
  // Неопубликованный трек в production ведёт себя как несуществующий:
  // страница не раскрывает ни его наличие, ни внутренние поля.
  if (!track) notFound();

  const section = getSection(track.sectionId);
  if (!section) notFound();

  const status = getTrackStatusView(track);
  const sections = new Map(getSections().map((item) => [item.sectionId as string, item]));
  const visibleTracks = getVisibleTrackIndex({ preview });
  const recommendations = recommendNextTracks({ current: track, visibleTracks });

  // Содержания ещё нет ни у одного трека: массив шагов пуст по определению,
  // а не потому, что мы его «не загрузили».
  const steps: TrackStep[] = [];

  return (
    <div style={sectionAccentStyle(track.sectionId)}>
      <PageView event={{ name: 'open_track_shell', trackId: track.trackId }} />

      <div className="grid border-b-2 border-ink lg:grid-cols-[minmax(0,8fr)_minmax(300px,4fr)]">
        <div className="border-b-2 border-ink px-4 py-8 sm:px-6 lg:border-r-2 lg:border-b-0 lg:px-8 lg:py-12">
          <TrackHeader
            track={track}
            section={section}
            status={status}
            breadcrumbs={[
              { label: 'Библиотека', href: routes.library() },
              {
                label: `${section.sectionId} ${section.shortTitle}`,
                href: routes.section(section.sectionId),
              },
              { label: track.trackId },
            ]}
          />

          <div className="mt-8">
            <TrackStepNavigation steps={steps} activeStepId={null} />
          </div>

          <div className="mt-8">
            <TrackStepViewport
              steps={steps}
              status={status}
              sectionHref={routes.section(section.sectionId)}
            />
          </div>
        </div>

        <aside className="grid content-start gap-4 bg-surface/60 px-4 py-8 sm:px-6 lg:px-7 lg:py-12">
          <TrackPassport
            track={track}
            section={section}
            status={status}
            linkedCount={track.nextTrackIds.length}
          />
          <TrackProgressPanel status={status} progress={null} />
          <TrackActions
            trackId={track.trackId}
            status={status}
            canSave={preview || track.publicationStatus === 'published'}
          />
          <TrackEvidencePanel outcome={track.outcome} />
          <TrackCompletionPanel />
        </aside>
      </div>

      <NextTrackRecommendations
        result={recommendations}
        sections={sections}
        fallbackSectionHref={routes.section(section.sectionId)}
      />
    </div>
  );
}
