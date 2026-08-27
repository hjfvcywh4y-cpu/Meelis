import type { Metadata } from 'next';

import { AccessState } from '@/components/access/access-state';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { PageHead } from '@/components/ui/page-head';
import { routes } from '@/domain/routes';

export const metadata: Metadata = {
  title: 'Доступ',
  description: 'Как устроен доступ к трекам: роли, уровни и честные состояния.',
};

const ACCESS_LEVELS = [
  {
    code: 'free',
    title: 'Свободный',
    text: 'Трек открыт всем. Так сейчас работают все опубликованные треки.',
  },
  {
    code: 'paid',
    title: 'Платный',
    text: 'Потребует активной подписки. Оплата в этой версии не подключена.',
  },
  {
    code: 'organization',
    title: 'От организации',
    text: 'Доступ выдаёт команда или структура, к которой вы принадлежите.',
  },
  {
    code: 'invite',
    title: 'По приглашению',
    text: 'Доступ выдаётся точечно: пилот, наставничество, закрытая группа.',
  },
];

export default function AccessPage() {
  const showcaseUrl = process.env.NEXT_PUBLIC_SHOWCASE_URL;

  return (
    <>
      <PageHead
        eyebrow="Доступ"
        title="Как устроен доступ"
        lead="Пока в системе нет оплаты и настоящей авторизации. Эта страница честно объясняет, что уже работает, а что появится позже."
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Главная', href: routes.home() }, { label: 'Доступ' }]} />
        }
      />

      <div className="container-grid grid gap-6 py-10 lg:grid-cols-[minmax(0,7fr)_minmax(280px,5fr)] lg:py-14">
        <div className="grid content-start gap-6">
          <section aria-labelledby="levels" className="card p-5 sm:p-7">
            <Eyebrow tone="dark">Уровни доступа</Eyebrow>
            <h2 id="levels" className="heading-3 mt-4">
              Четыре режима, заложенные в модель данных
            </h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {ACCESS_LEVELS.map((level) => (
                <li key={level.code} className="card-soft p-4">
                  <span className="meta-text">{level.code}</span>
                  <p className="mt-2 text-[17px] font-bold">{level.title}</p>
                  <p className="mt-2 text-[15px] leading-snug text-muted">{level.text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-[70ch] text-[15px] leading-relaxed text-muted">
              Сложный адрес трека не является защитой. Когда доступ включится, он будет
              проверяться по entitlement на сервере, а не по знанию ссылки.
            </p>
          </section>

          <section aria-labelledby="what-now" className="card p-5 sm:p-7">
            <Eyebrow>Что сейчас</Eyebrow>
            <h2 id="what-now" className="heading-3 mt-4">
              Вход и оплата пока не подключены
            </h2>
            <p className="mt-4 max-w-[70ch] text-[16px] leading-relaxed text-muted">
              Кнопки «Войти» и «Оплатить» здесь нет намеренно: она бы обещала то, чего в системе
              ещё не существует. Профиль и маршрут работают локально в браузере, поэтому платформу
              можно спокойно смотреть уже сейчас.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={routes.library()} variant="primary">
                Открыть библиотеку
              </ButtonLink>
              {showcaseUrl ? (
                <a href={showcaseUrl} className="btn" rel="noreferrer noopener" target="_blank">
                  Публичная витрина
                </a>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <AccessState />
          <section aria-labelledby="roles" className="card p-5">
            <Eyebrow>Роли</Eyebrow>
            <h2 id="roles" className="heading-3 mt-4">
              Кто есть в системе
            </h2>
            <dl className="mt-4">
              {[
                ['Гость', 'Смотрит витрину и опубликованный каталог'],
                ['Участник', 'Имеет маршрут, сохранения и результаты'],
                ['Наставник', 'Позже увидит согласованный прогресс подопечных'],
                ['Редактор', 'Проверяет метаданные и статусы'],
              ].map(([role, text]) => (
                <div key={role} className="border-t border-line-soft py-3 first:border-t-0">
                  <dt className="text-[16px] font-bold">{role}</dt>
                  <dd className="mt-1 text-[15px] leading-snug text-muted">{text}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
