import type { Metadata } from 'next';

import { StartChooser, type StartOption } from '@/components/start/start-chooser';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { PageHead } from '@/components/ui/page-head';
import { routes } from '@/domain/routes';
import { getAllSectionStats, getSections, searchPublicTracks } from '@/server/catalog';
import { isPreviewEnabled } from '@/server/flags';

export const metadata: Metadata = {
  title: 'С чего начать',
  description: 'Один вопрос о текущей ситуации — и понятный раздел библиотеки.',
};

export default function StartPage() {
  const preview = isPreviewEnabled();
  const options: StartOption[] = getSections().map((section) => {
    const stats = getAllSectionStats().find((item) => item.sectionId === section.sectionId);
    const sectionTracks = searchPublicTracks({ preview }, { sectionId: section.sectionId });
    const published = sectionTracks.find((track) => track.publicationStatus === 'published');

    return {
      section,
      total: stats?.total ?? 0,
      published: stats?.published ?? 0,
      // В production рекомендуется только опубликованный трек.
      // В preview показываем первую карточку раздела, честно помеченную как «Готовится».
      recommended: published ?? (preview ? (sectionTracks[0] ?? null) : null),
    };
  });

  return (
    <>
      <PageHead
        eyebrow="Быстрый вход"
        title="Выберите свою ситуацию"
        lead="Это не тест и не анкета. Один ответ — и вы попадаете в тот раздел, где сегодня нужно действие."
        breadcrumbs={<Breadcrumbs items={[{ label: 'Главная', href: routes.home() }, { label: 'С чего начать' }]} />}
      />
      <StartChooser options={options} />
    </>
  );
}
