import Link from 'next/link';

import { routes } from '@/domain/routes';

const LINKS = [
  { href: routes.start(), label: 'С чего начать' },
  { href: routes.library(), label: 'Библиотека' },
  { href: routes.my(), label: 'Личная главная' },
  { href: routes.access(), label: 'Доступ' },
  { href: routes.profile(), label: 'Профиль' },
];

export function Footer() {
  return (
    <footer className="border-t-2 border-ink bg-ink text-white">
      <div className="container-grid flex flex-col gap-6 py-8 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[17px] font-extrabold tracking-[-0.03em]">MLM ACADEMY</p>
          <p className="mt-2 max-w-[420px] text-[14px] leading-relaxed text-on-ink-muted">
            Библиотека рабочих треков: ситуация, действие, зафиксированный результат и следующий
            шаг.
          </p>
        </div>
        <nav aria-label="Навигация в подвале">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] font-bold">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="underline-offset-4 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
