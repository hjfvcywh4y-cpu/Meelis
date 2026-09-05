import Link from 'next/link';
import { Fragment } from 'react';

export interface Crumb {
  label: string;
  href?: string;
}

/** Контекстная навигация: ответ на вопрос «где я сейчас». */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Хлебные крошки">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold">
        {items.map((item, index) => (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 ? (
              <li aria-hidden="true" className="text-muted">
                /
              </li>
            ) : null}
            <li>
              {item.href ? (
                <Link href={item.href} className="underline underline-offset-4 hover:no-underline">
                  {item.label}
                </Link>
              ) : (
                <span className="text-muted">{item.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
