import type { Metadata } from 'next';

import { ProfileForm } from '@/components/profile/profile-form';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { PageHead } from '@/components/ui/page-head';
import { routes } from '@/domain/routes';
import { getSections, listPublicTracks } from '@/server/catalog';
import { isPreviewEnabled } from '@/server/flags';

export const metadata: Metadata = {
  title: 'Профиль',
  description: 'Рабочий контекст: раздел, текущая задача и сохранённые треки.',
};

export default function ProfilePage() {
  const preview = isPreviewEnabled();

  return (
    <>
      <PageHead
        eyebrow="Личный контур"
        title="Рабочий профиль"
        lead="Минимум полей: только то, что действительно влияет на выбор следующего шага."
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Главная', href: routes.home() }, { label: 'Профиль' }]} />
        }
      />
      <ProfileForm sections={getSections()} tracks={listPublicTracks({ preview })} />
    </>
  );
}
