'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { routes } from '@/domain/routes';
import { cn } from '@/lib/cn';

const ITEMS = [
  { href: routes.home(), label: 'Главная' },
  { href: routes.library(), label: 'Библиотека' },
  { href: routes.myRoute(), label: 'Маршрут' },
  { href: routes.myResults(), label: 'Результаты' },
  { href: routes.profile(), label: 'Профиль' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Нижняя навигация участника. На странице трека она уступает
 * главной кнопке действия и уходит под sticky-панель.
 */
export function MobileNav() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label="Мобильная навигация"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t-2 border-ink bg-paper lg:hidden"
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-[62px] items-center justify-center border-r border-line-soft px-1 text-center text-[11px] leading-tight font-bold last:border-r-0',
              active && 'bg-ink text-white',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
