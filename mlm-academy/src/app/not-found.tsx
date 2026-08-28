import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHead } from '@/components/ui/page-head';
import { routes } from '@/domain/routes';

export default function NotFound() {
  return (
    <>
      <PageHead
        eyebrow="404"
        title="Такой страницы нет"
        lead="Возможно, адрес трека набран с ошибкой или этот трек ещё не открыт."
      />
      <div className="container-grid py-10 lg:py-14">
        <EmptyState
          title="Продолжим оттуда, где есть работа"
          description="Библиотека собрана по ситуациям: выберите ту, что ближе к вашей задаче сейчас. Если вы искали конкретный трек, проверьте его номер — он выглядит так: A3-002."
          actions={
            <>
              <ButtonLink href={routes.start()} variant="primary">
                Выбрать ситуацию
              </ButtonLink>
              <ButtonLink href={routes.library()}>Открыть библиотеку</ButtonLink>
              <ButtonLink href={routes.home()}>На главную</ButtonLink>
            </>
          }
        />
      </div>
    </>
  );
}
