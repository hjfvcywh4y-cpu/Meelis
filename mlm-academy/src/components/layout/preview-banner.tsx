import Link from 'next/link';

import { routes } from '@/domain/routes';

/**
 * Preview обязан быть явно помечен и не выглядеть как реальная публикация.
 * Включается только серверной переменной ENABLE_CATALOG_PREVIEW.
 */
export function PreviewBanner() {
  return (
    <div className="border-b border-ink bg-a2">
      <div className="container-grid flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center">
        <span className="meta-text">Режим предпросмотра</span>
        <span className="meta-text font-medium normal-case">
          видны все 112 карточек, включая неопубликованные
        </span>
        <Link href={routes.adminCatalog()} className="meta-text underline underline-offset-2">
          Проверка каталога
        </Link>
      </div>
    </div>
  );
}
