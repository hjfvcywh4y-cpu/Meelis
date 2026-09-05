'use client';

import { useMemo } from 'react';

import { RouteStepper, type RouteNode } from '@/components/my/route-stepper';
import { useAppMode } from '@/components/providers/app-mode-provider';
import { useProfile } from '@/components/providers/profile-provider';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Eyebrow } from '@/components/ui/eyebrow';
import { routes } from '@/domain/routes';
import type { PublicTrackMetadata } from '@/domain/types';

export interface DemoBranch {
  nodes: RouteNode[];
  branches: RouteNode[];
}

interface MyRouteProps {
  tracks: PublicTrackMetadata[];
  /** Демонстрационная ветка пилотного графа. Приходит только в режиме предпросмотра. */
  demoBranch: DemoBranch | null;
}

export function MyRoute({ tracks, demoBranch }: MyRouteProps) {
  const { profile, loaded } = useProfile();
  const mode = useAppMode();

  const savedNodes = useMemo<RouteNode[]>(() => {
    const byId = new Map(tracks.map((track) => [track.trackId, track]));
    return profile.savedTrackIds
      .map((id) => byId.get(id))
      .filter((track): track is PublicTrackMetadata => track != null)
      .map((track, index) => ({
        trackId: track.trackId,
        sectionId: track.sectionId,
        label: track.title,
        state: index === 0 ? ('current' as const) : ('future' as const),
        linkable: true,
      }));
  }, [profile.savedTrackIds, tracks]);

  if (!loaded) {
    return (
      <div className="container-grid py-10 lg:py-14">
        <div className="card h-[180px] animate-pulse bg-surface" aria-hidden="true" />
        <p className="sr-only">Загружаем маршрут</p>
      </div>
    );
  }

  return (
    <div className="container-grid grid gap-10 py-10 lg:py-14">
      <section aria-labelledby="my-branch">
        <Eyebrow tone="dark">Моя ветка</Eyebrow>
        <h2 id="my-branch" className="heading-3 mt-4">
          {savedNodes.length > 0 ? 'Треки, которые вы отложили' : 'Маршрут ещё не начат'}
        </h2>

        {savedNodes.length > 0 ? (
          <div className="mt-7">
            <RouteStepper nodes={savedNodes} />
            <p className="mt-6 max-w-[70ch] text-[15px] leading-relaxed text-muted">
              Порядок задаёте вы. Когда у треков появится содержание, сюда добавятся отметки о
              выполненных действиях и зафиксированных результатах.
            </p>
          </div>
        ) : (
          <div className="mt-7">
            <EmptyState
              title="Здесь пока нет вашего маршрута"
              description="Маршрут собирается из треков, которые вы сохранили, и из того, что вы реально сделали. Начните с выбора ситуации — раздел и первый шаг появятся здесь."
              actions={
                <>
                  <ButtonLink href={routes.start()} variant="primary">
                    Выбрать ситуацию
                  </ButtonLink>
                  <ButtonLink href={routes.library()}>Открыть библиотеку</ButtonLink>
                </>
              }
            />
          </div>
        )}
      </section>

      {mode.preview && demoBranch ? (
        <section aria-labelledby="demo-branch" className="card p-5 sm:p-7">
          <Eyebrow tone="accent">Демонстрация · только предпросмотр</Eyebrow>
          <h2 id="demo-branch" className="heading-3 mt-4">
            Как будет выглядеть ветка целиком
          </h2>
          <p className="mt-4 max-w-[70ch] text-[16px] leading-relaxed text-muted">
            Ниже — пилотная ветка каталога, а не ваш прогресс. Она показывает форму маршрута:
            несколько сделанных шагов, один текущий и развилки после него.
          </p>
          <div className="mt-8">
            <RouteStepper nodes={demoBranch.nodes} branches={demoBranch.branches} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
