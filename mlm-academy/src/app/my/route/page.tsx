import type { Metadata } from 'next';

import { PageView } from '@/components/analytics/page-view';
import { MyRoute, type DemoBranch } from '@/components/my/my-route';
import type { RouteNode } from '@/components/my/route-stepper';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { PageHead } from '@/components/ui/page-head';
import { routes } from '@/domain/routes';
import { getPilotGraph, getVisibleTrackIndex, listPublicTracks } from '@/server/catalog';
import { isPreviewEnabled } from '@/server/flags';

export const metadata: Metadata = {
  title: 'Мой маршрут',
  description: 'Текущая ветка: что сделано, где вы сейчас и какие развилки открыты.',
};

/**
 * Демо-ветка берётся из пилотного графа и намеренно короткая:
 * полный граф из 112 узлов выглядел бы схемой метро без названий станций.
 */
function buildDemoBranch(preview: boolean): DemoBranch | null {
  if (!preview) return null;

  const graph = getPilotGraph();
  const index = getVisibleTrackIndex({ preview });
  const nodes = graph.nodes.slice(0, 5);
  const currentIndex = 3;

  const stepperNodes: RouteNode[] = nodes.map((node, position) => ({
    trackId: node.trackId,
    sectionId: node.sectionId,
    label: node.title,
    state: position < currentIndex ? 'done' : position === currentIndex ? 'current' : 'future',
    linkable: index.has(node.trackId),
  }));

  const current = nodes[currentIndex];
  const branches: RouteNode[] = (current?.nextTrackIds ?? [])
    .slice(0, 3)
    .flatMap((trackId) => {
      const track = index.get(trackId);
      if (!track) return [];
      return [
        {
          trackId: track.trackId,
          sectionId: track.sectionId,
          label: track.title,
          state: 'future' as const,
          linkable: true,
        },
      ];
    });

  return { nodes: stepperNodes, branches };
}

export default function MyRoutePage() {
  const preview = isPreviewEnabled();

  return (
    <>
      <PageView event={{ name: 'view_route' }} />
      <PageHead
        eyebrow="Личный контур"
        title="Мой маршрут"
        lead="Не лестница из 112 уроков, а текущая ветка: что сделано, где вы сейчас и куда можно свернуть."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Главная', href: routes.home() },
              { label: 'Личная главная', href: routes.my() },
              { label: 'Мой маршрут' },
            ]}
          />
        }
      />
      <MyRoute tracks={listPublicTracks({ preview })} demoBranch={buildDemoBranch(preview)} />
    </>
  );
}
