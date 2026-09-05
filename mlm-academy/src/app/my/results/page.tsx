import type { Metadata } from 'next';

import { PageView } from '@/components/analytics/page-view';
import { MyResults } from '@/components/my/my-results';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { PageHead } from '@/components/ui/page-head';
import { routes } from '@/domain/routes';

export const metadata: Metadata = {
  title: 'Мои результаты',
  description: 'История произведённых артефактов: тексты, списки, сообщения, записи и договорённости.',
};

export default function MyResultsPage() {
  return (
    <>
      <PageView event={{ name: 'view_results' }} />
      <PageHead
        eyebrow="Личный контур"
        title="Мои результаты"
        lead="Единица прогресса здесь — не просмотр, а произведённый результат."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Главная', href: routes.home() },
              { label: 'Личная главная', href: routes.my() },
              { label: 'Мои результаты' },
            ]}
          />
        }
      />
      <MyResults />
    </>
  );
}
