'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useProfile } from '@/components/providers/profile-provider';
import { ButtonLink } from '@/components/ui/button';
import { routes } from '@/domain/routes';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { href: routes.home(), label: 'Главная' },
  { href: routes.library(), label: 'Библиотека' },
  { href: routes.myRoute(), label: 'Мой маршрут' },
  { href: routes.myResults(), label: 'Мои результаты' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname() ?? '/';
  const { profile, loaded } = useProfile();
  const isMember = loaded && (profile.selectedSectionId != null || profile.savedTrackIds.length > 0);

  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-paper">
      <div className="flex min-h-[62px] items-stretch justify-between gap-3 px-4 sm:px-6 lg:min-h-[72px] lg:px-8">
        <Link
          href={routes.home()}
          className="flex items-center gap-3 font-extrabold tracking-[-0.03em]"
          aria-label="MLM Academy — на главную"
        >
          <span
            aria-hidden="true"
            className="inline-block size-6 border-2 border-ink bg-a2 lg:size-7"
          />
          <span className="text-[15px] lg:text-[17px]">MLM ACADEMY</span>
        </Link>

        <nav aria-label="Основная навигация" className="hidden items-stretch lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center border-l border-line-soft px-5 text-[14px] font-bold last:border-r',
                  active && 'bg-ink text-white',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 py-2">
          <ButtonLink href={routes.library()} size="small" className="hidden sm:inline-flex">
            Поиск
          </ButtonLink>
          <ButtonLink
            href={isMember ? routes.my() : routes.start()}
            size="small"
            variant="primary"
          >
            {isMember ? 'Мой следующий шаг' : 'С чего начать'}
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
