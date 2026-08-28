import type { Metadata } from 'next';

import { CatalogBrowser } from '@/components/catalog/catalog-browser';
import { SectionCard } from '@/components/catalog/section-card';
import { ButtonLink } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHead } from '@/components/ui/page-head';
import { normalizeSectionId, routes } from '@/domain/routes';
import {
  getAllSectionStats,
  getSections,
  listPublicFormats,
  listPublicTracks,
} from '@/server/catalog';
import { isPreviewEnabled } from '@/server/flags';

export const metadata: Metadata = {
  title: 'Библиотека',
  description: 'Каталог рабочих треков по ситуациям, результатам и разделам.',
};

interface LibraryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const preview = isPreviewEnabled();
  const params = await searchParams;

  const sections = getSections();
  const tracks = listPublicTracks({ preview });
  const formats = listPublicFormats({ preview });
  const stats = new Map(getAllSectionStats().map((item) => [item.sectionId, item]));

  const initialSection = normalizeSectionId(firstValue(params.section));
  const initialQuery = firstValue(params.q);
  const initialFormat = firstValue(params.format) || null;

  return (
    <>
      <PageHead
        eyebrow={preview ? 'Каталог / предпросмотр' : 'Каталог'}
        title="Библиотека рабочих ситуаций"
        lead="Ищите не по темам, а по тому, что нужно сделать. Карточка обещает конкретный результат, а не «освоение материала»."
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Главная', href: routes.home() }, { label: 'Библиотека' }]} />
        }
      />

      {tracks.length === 0 ? (
        <div className="container-grid py-10 lg:py-14">
          <EmptyState
            eyebrow="Каталог готовится"
            title="Открытых треков пока нет"
            description="Все 112 треков описаны и связаны между собой, но ни один пока не опубликован. Выберите ситуацию — раздел сохранится, и первый доступный трек появится на вашей личной главной."
            actions={
              <>
                <ButtonLink href={routes.start()} variant="primary">
                  Выбрать ситуацию
                </ButtonLink>
                <ButtonLink href={routes.my()}>Личная главная</ButtonLink>
              </>
            }
          />

          <section className="mt-12" aria-labelledby="sections-preview">
            <h2 id="sections-preview" className="heading-3">
              Шесть входов библиотеки
            </h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sections.map((section) => {
                const sectionStats = stats.get(section.sectionId);
                return (
                  <li key={section.sectionId} className="flex">
                    <div className="flex w-full">
                      <SectionCard
                        section={section}
                        total={sectionStats?.total ?? 0}
                        published={sectionStats?.published ?? 0}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : (
        <CatalogBrowser
          tracks={tracks}
          sections={sections}
          formats={formats}
          initialQuery={initialQuery}
          initialSection={initialSection}
          initialFormat={initialFormat}
        />
      )}
    </>
  );
}
