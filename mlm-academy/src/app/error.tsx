'use client';

import { useEffect } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHead } from '@/components/ui/page-head';
import { routes } from '@/domain/routes';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ошибка не проглатывается: она остаётся в серверных и браузерных логах.
    console.error('[mlm-academy] Необработанная ошибка экрана', error);
  }, [error]);

  return (
    <>
      <PageHead
        eyebrow="Ошибка"
        title="Экран не загрузился"
        lead="Это сбой приложения, а не ваша ошибка. Данные каталога при этом не меняются."
      />
      <div className="container-grid py-10 lg:py-14">
        <EmptyState
          title="Попробуйте открыть заново"
          description="Если повторяется, вернитесь в библиотеку и откройте нужный раздел оттуда. Технический код ошибки виден в консоли браузера."
          actions={
            <>
              <Button variant="primary" onClick={reset}>
                Повторить
              </Button>
              <ButtonLink href={routes.library()}>Открыть библиотеку</ButtonLink>
              <ButtonLink href={routes.home()}>На главную</ButtonLink>
            </>
          }
        />
        {error.digest ? (
          <p className="meta-text mt-6 text-muted">Код ошибки: {error.digest}</p>
        ) : null}
      </div>
    </>
  );
}
