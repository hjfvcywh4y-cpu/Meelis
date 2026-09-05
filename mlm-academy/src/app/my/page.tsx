import type { Metadata } from 'next';

import { MyDashboard } from '@/components/my/my-dashboard';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { PageHead } from '@/components/ui/page-head';
import { routes } from '@/domain/routes';
import { getSections, listPublicTracks } from '@/server/catalog';
import { isPreviewEnabled } from '@/server/flags';

export const metadata: Metadata = {
  title: 'Личная главная',
  description: 'Один следующий шаг, выбранный раздел и сохранённые треки.',
};

export default function MyPage() {
  const preview = isPreviewEnabled();

  return (
    <>
      <PageHead
        eyebrow="Личный контур"
        title="Один следующий ход, а не сто двенадцать уроков"
        lead="Здесь всегда ровно одно главное действие. Всё остальное — контекст и альтернативы."
        breadcrumbs={
          <Breadcrumbs
            items={[{ label: 'Главная', href: routes.home() }, { label: 'Личная главная' }]}
          />
        }
      />
      <MyDashboard tracks={listPublicTracks({ preview })} sections={getSections()} />
    </>
  );
}
