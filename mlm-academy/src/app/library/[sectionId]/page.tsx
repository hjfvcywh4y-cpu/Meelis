import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { PageView } from '@/components/analytics/page-view';
import { pluralTracks } from '@/components/catalog/section-card';
import { TrackCard } from '@/components/catalog/track-card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Eyebrow } from '@/components/ui/eyebrow';
import { PageHead } from '@/components/ui/page-head';
import { sectionAccentStyle } from '@/components/ui/section-accent';
import { isCanonicalParam, normalizeSectionId, routes } from '@/domain/routes';
import type { PublicTrackMetadata } from '@/domain/types';
import {
  getModulesOfSection,
  getSection,
  getSectionStats,
  getSections,
  searchPublicTracks,
} from '@/server/catalog';
import { isPreviewEnabled } from '@/server/flags';

interface SectionPageProps {
  params: Promise<{ sectionId: string }>;
}

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { sectionId: raw } = await params;
  const sectionId = normalizeSectionId(raw);
  const section = sectionId ? getSection(sectionId) : null;
  if (!section) return { title: 'Раздел не найден' };
  return { title: `${section.sectionId} · ${section.shortTitle}`, description: section.promise };
}

export function generateStaticParams() {
  return getSections().map((section) => ({ sectionId: section.sectionId.toLowerCase() }));
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { sectionId: raw } = await params;
  const sectionId = normalizeSectionId(raw);
  if (!sectionId) notFound();

  // Канонический URL — lowercase. Uppercase-ссылки редиректим, а не дублируем.
  if (!isCanonicalParam(raw)) permanentRedirect(routes.section(sectionId));

  const section = getSection(sectionId);
  if (!section) notFound();

  const preview = isPreviewEnabled();
  const stats = getSectionStats(sectionId);
  const tracks = searchPublicTracks({ preview }, { sectionId });
  const modules = getModulesOfSection(sectionId, { preview });

  const available = tracks.filter((track) => track.publicationStatus === 'published');
  const preparing = tracks.filter((track) => track.publicationStatus !== 'published');

  return (
    <div style={sectionAccentStyle(sectionId)}>
      <PageView event={{ name: 'view_section', sectionId }} />
      <PageHead
        eyebrow={`${section.sectionId} · ${stats.total} ${pluralTracks(stats.total)} · доступно ${stats.published}`}
        title={section.title}
        lead={section.promise}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Главная', href: routes.home() },
              { label: 'Библиотека', href: routes.library() },
              { label: `${section.sectionId} ${section.shortTitle}` },
            ]}
          />
        }
        aside={
          <div className="card p-5" style={sectionAccentStyle(sectionId)}>
            <span aria-hidden="true" className="accent-strip mb-4 block h-3 w-16 border-b-2" />
            <span className="meta-text">Входная ситуация</span>
            <p className="mt-3 max-w-[34ch] text-[16px] leading-snug">{section.entryQuestion}</p>
          </div>
        }
      />

      <div className="container-grid py-10 lg:py-14">
        <section aria-labelledby="route-logic">
          <Eyebrow>Логика раздела</Eyebrow>
          <h2 id="route-logic" className="heading-3 mt-4">
            Как обычно идёт работа здесь
          </h2>
          <ol className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-3">
            {section.routeLogic.map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-muted">
                    →
                  </span>
                ) : null}
                <span className="card px-4 py-3 text-[16px] font-bold">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 max-w-[70ch] text-[15px] leading-relaxed text-muted">
            Это не обязательная лестница из уроков. Можно войти в любой момент цепочки.
          </p>
        </section>

        {modules.length > 0 ? (
          <section className="mt-12" aria-labelledby="modules">
            <Eyebrow tone="dark">Модули раздела</Eyebrow>
            <h2 id="modules" className="heading-3 mt-4">
              Из чего собран раздел
            </h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {modules.map((item) => (
                <li key={item.module} className="card-soft px-4 py-3 text-[15px]">
                  <span className="font-bold">{item.module}</span>
                  <span className="ml-2 text-muted">
                    {item.tracks.length} {pluralTracks(item.tracks.length)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-12" aria-labelledby="available-tracks">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
            <h2 id="available-tracks" className="heading-3">
              Доступные треки
            </h2>
            <span className="meta-text">
              {available.length} {pluralTracks(available.length)}
            </span>
          </div>

          {available.length > 0 ? (
            <TrackList tracks={available} section={section} />
          ) : (
            <div className="mt-6">
              <EmptyState
                eyebrow="Раздел готовится"
                title="Открытых треков в этом разделе пока нет"
                description={`Структура раздела готова: ${stats.total} ${pluralTracks(stats.total)} описаны и связаны между собой. Как только первый из них будет опубликован, он появится здесь и на вашей личной главной.`}
                actions={
                  <>
                    <ButtonLink href={routes.library()} variant="primary">
                      Вернуться в библиотеку
                    </ButtonLink>
                    <ButtonLink href={routes.start()}>Выбрать другую ситуацию</ButtonLink>
                  </>
                }
              />
            </div>
          )}
        </section>

        {preview && preparing.length > 0 ? (
          <section className="mt-12" aria-labelledby="preparing-tracks">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
              <h2 id="preparing-tracks" className="heading-3">
                Готовятся
              </h2>
              <span className="meta-text">
                только в предпросмотре · {preparing.length} {pluralTracks(preparing.length)}
              </span>
            </div>
            <TrackList tracks={preparing} section={section} />
          </section>
        ) : null}

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={routes.start()}>Вернуться к выбору ситуации</ButtonLink>
          <ButtonLink href={routes.library()}>Вся библиотека</ButtonLink>
        </div>
      </div>
    </div>
  );
}

function TrackList({
  tracks,
  section,
}: {
  tracks: PublicTrackMetadata[];
  section: { sectionId: PublicTrackMetadata['sectionId']; shortTitle: string };
}) {
  return (
    <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tracks.map((track) => (
        <li key={track.trackId} className="flex">
          <div className="flex w-full">
            <TrackCard track={track} section={section} />
          </div>
        </li>
      ))}
    </ul>
  );
}
