import { PageView } from '@/components/analytics/page-view';
import { SectionCard } from '@/components/catalog/section-card';
import { ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { routes } from '@/domain/routes';
import { getAllSectionStats, getRegistrySummary, getSections } from '@/server/catalog';
import { isPreviewEnabled } from '@/server/flags';

const PROCESS = [
  {
    index: '01',
    title: 'Ситуация',
    text: 'Вы приходите с рабочим стопором: не знаю, кому написать; человек взял паузу; разговор рассыпался.',
  },
  {
    index: '02',
    title: 'Действие',
    text: 'Трек ведёт к одному наблюдаемому действию. Просмотр материала сам по себе ничего не закрывает.',
  },
  {
    index: '03',
    title: 'Следующий шаг',
    text: 'Результат остаётся у вас, а система показывает один главный ход и не больше трёх альтернатив.',
  },
];

const TRACK_SHELL_BLOCKS = [
  { label: 'Паспорт трека', text: 'Раздел, ID, формат и статус — без внутренних редакционных данных.' },
  { label: 'Подходит, если', text: 'Ситуация, в которой этот трек уместен именно сейчас.' },
  { label: 'На выходе', text: 'Измеримый результат, который останется у вас после действия.' },
  { label: 'Шаги', text: 'Область содержания. Пока она честно пустая — трек ещё в производстве.' },
  { label: 'Результат', text: 'Место, куда позже ляжет артефакт: текст, список, сообщение, запись.' },
  { label: 'Куда дальше', text: 'Продолжения строятся по связям каталога, а не по «следующему уроку».' },
];

export default function HomePage() {
  const preview = isPreviewEnabled();
  const sections = getSections();
  const stats = new Map(getAllSectionStats().map((item) => [item.sectionId, item]));
  const summary = getRegistrySummary();
  const publishedTotal = [...stats.values()].reduce((sum, item) => sum + item.published, 0);

  return (
    <>
      <PageView event={{ name: 'view_home' }} />

      <section className="grid-lines border-b-2 border-ink">
        <div className="container-grid grid gap-8 py-12 lg:grid-cols-[minmax(0,9fr)_minmax(260px,3fr)] lg:py-16">
          <div>
            <Eyebrow>Библиотека действий для MLM</Eyebrow>
            <h1 className="display-1 mt-6 max-w-[16ch]">
              Не просто узнать. Сделать следующий результат.
            </h1>
            <p className="body-l mt-7 max-w-[62ch] text-muted">
              Выберите рабочую ситуацию. Платформа покажет конкретный трек, поможет зафиксировать
              то, что получилось, и даст следующий шаг.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href={routes.start()} variant="accent" className="sm:min-w-[240px]">
                Найти следующий шаг →
              </ButtonLink>
              <ButtonLink href={routes.library()}>Открыть библиотеку</ButtonLink>
            </div>
          </div>
          <aside className="card self-end border-2 bg-a1 p-6 text-white">
            <span className="meta-text">Архитектура v0.2</span>
            <p className="mt-3 text-[72px] leading-none font-extrabold tracking-[-0.08em]">6</p>
            <p className="mt-4 text-[16px] leading-snug">
              входов по живым задачам партнёра. Не главы книги и не длинная учебная лестница.
            </p>
            <p className="meta-text mt-6 border-t border-on-ink-line pt-4">
              {summary.totalTracks} треков в каталоге · доступно сейчас {publishedTotal}
            </p>
          </aside>
        </div>
      </section>

      <section className="border-b-2 border-ink" aria-labelledby="situations">
        <div className="container-grid py-12 lg:py-16">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Eyebrow tone="dark">Выберите ситуацию</Eyebrow>
              <h2 id="situations" className="heading-2 mt-5">
                Где вы сейчас застряли?
              </h2>
            </div>
            <p className="max-w-[46ch] text-[17px] leading-snug text-muted">
              Не нужно начинать с первого урока. Входите туда, где сегодня требуется действие.
            </p>
          </div>

          <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sections.map((section) => {
              const sectionStats = stats.get(section.sectionId);
              return (
                <li key={section.sectionId} className="flex">
                  <div className="flex w-full">
                    <SectionCard
                      section={section}
                      total={sectionStats?.total ?? 0}
                      published={sectionStats?.published ?? 0}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="border-b-2 border-ink" aria-labelledby="how">
        <div className="container-grid py-12 lg:py-16">
          <Eyebrow>Производственная логика</Eyebrow>
          <h2 id="how" className="heading-2 mt-5 max-w-[20ch]">
            Три звена. Никакой имитации обучения.
          </h2>
          <ul className="mt-8 grid border-2 border-ink md:grid-cols-3">
            {PROCESS.map((step, index) => (
              <li
                key={step.index}
                className={
                  index === 0
                    ? 'bg-surface p-6'
                    : 'border-t-2 border-ink bg-surface p-6 md:border-t-0 md:border-l-2'
                }
              >
                <p className="text-[64px] leading-[0.85] font-extrabold tracking-[-0.08em]">
                  {step.index}
                </p>
                <h3 className="heading-3 mt-10">{step.title}</h3>
                <p className="mt-4 text-[16px] leading-relaxed text-muted">{step.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b-2 border-ink" aria-labelledby="shell">
        <div className="container-grid py-12 lg:py-16">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Eyebrow tone="dark">Оболочка трека</Eyebrow>
              <h2 id="shell" className="heading-2 mt-5 max-w-[22ch]">
                Как устроена страница трека
              </h2>
            </div>
            <p className="max-w-[46ch] text-[17px] leading-snug text-muted">
              Структура одинакова для всех треков. Когда появится содержание, страница наполнится
              без переделки интерфейса.
            </p>
          </div>

          <ul className="blueprint mt-8 grid gap-px p-4 md:grid-cols-2 xl:grid-cols-3">
            {TRACK_SHELL_BLOCKS.map((block) => (
              <li key={block.label} className="card-soft bg-surface p-5">
                <span className="meta-text">{block.label}</span>
                <p className="mt-3 text-[16px] leading-snug text-muted">{block.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-[70ch] text-[15px] leading-relaxed text-muted">
            Это схема, а не пример урока. Оболочка не подставляет вместо содержания
            сгенерированный текст.
          </p>
        </div>
      </section>

      <section className="border-b-2 border-ink" aria-labelledby="route">
        <div className="container-grid grid gap-8 py-12 lg:grid-cols-[minmax(0,7fr)_minmax(280px,5fr)] lg:py-16">
          <div>
            <Eyebrow>Личный маршрут</Eyebrow>
            <h2 id="route" className="heading-2 mt-5 max-w-[18ch]">
              Один следующий ход, а не сто двенадцать уроков
            </h2>
            <p className="body-l mt-6 max-w-[58ch] text-muted">
              Маршрут — это текущая ветка: что уже сделано, где вы сейчас и какие развилки
              открыты дальше. Никаких процентов прохождения курса, баллов и рейтингов.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={routes.my()} variant="primary">
                Личная главная
              </ButtonLink>
              <ButtonLink href={routes.myRoute()}>Посмотреть маршрут</ButtonLink>
            </div>
          </div>
          <div className="card p-6">
            <span className="meta-text">Что считается завершением</span>
            <ul className="mt-5 grid gap-4">
              {[
                'Действие выполнено в реальности, а не в интерфейсе.',
                'Результат зафиксирован: текст, список, сообщение, запись или договорённость.',
                'Выбран следующий шаг.',
              ].map((item) => (
                <li key={item} className="border-t border-line-soft pt-4 text-[16px] leading-snug">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="final-cta">
        <div className="container-grid py-12 lg:py-16">
          <div className="card corner-cut p-6 sm:p-10">
            <Eyebrow tone="accent">Следующий шаг</Eyebrow>
            <h2 id="final-cta" className="heading-2 mt-5 max-w-[20ch]">
              Начните с ситуации, а не с оглавления
            </h2>
            <p className="body-l mt-5 max-w-[60ch] text-muted">
              {preview
                ? 'Сейчас включён режим предпросмотра: видна вся архитектура каталога, включая треки, которые ещё готовятся.'
                : 'Треки открываются по мере готовности. Оболочка честно показывает, что уже доступно, а что находится в производстве.'}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={routes.start()} variant="primary">
                Выбрать свою ситуацию
              </ButtonLink>
              <ButtonLink href={routes.library()}>Открыть библиотеку</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
