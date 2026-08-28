import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Eyebrow } from '@/components/ui/eyebrow';
import { PageHead } from '@/components/ui/page-head';
import { StatusBadge } from '@/components/ui/status-badge';
import { routes } from '@/domain/routes';
import {
  getCatalogHealthReport,
  getInternalTracks,
  getPilotGraph,
  getRegistrySummary,
} from '@/server/catalog';
import { isAdminCatalogEnabled, isPreviewEnabled } from '@/server/flags';

export const metadata: Metadata = {
  title: 'Проверка каталога',
  robots: { index: false, follow: false },
};

/**
 * Служебный экран редактора. Единственное место, где допустимо видеть
 * внутренние поля реестра. Для обычного production-пользователя недоступен.
 */
export default function AdminCatalogPage() {
  if (!isAdminCatalogEnabled()) notFound();

  const report = getCatalogHealthReport();
  const registry = getRegistrySummary();
  const tracks = getInternalTracks();
  const pilot = getPilotGraph();

  const errors = report.issues.filter((issue) => issue.level === 'error');
  const warnings = report.issues.filter((issue) => issue.level === 'warning');
  const infos = report.issues.filter((issue) => issue.level === 'info');

  return (
    <>
      <PageHead
        eyebrow="Служебный экран · редактор"
        title="Здоровье каталога"
        lead="Проверка целостности реестра, графа продолжений и распределений. Эта страница показывает внутренние поля и не доступна обычному пользователю."
        breadcrumbs={
          <Breadcrumbs
            items={[{ label: 'Главная', href: routes.home() }, { label: 'Проверка каталога' }]}
          />
        }
        aside={
          <div className="card p-5">
            <StatusBadge
              label={report.ok ? 'Валидация пройдена' : `Ошибок: ${errors.length}`}
              tone={report.ok ? 'positive' : 'danger'}
            />
            <p className="meta-text mt-4 text-muted">
              Предпросмотр: {isPreviewEnabled() ? 'включён' : 'выключен'}
            </p>
          </div>
        }
      />

      <div className="container-grid grid gap-10 py-10 lg:py-14">
        <section aria-labelledby="summary">
          <Eyebrow tone="dark">Сводка</Eyebrow>
          <h2 id="summary" className="heading-3 mt-4">
            Что загружено
          </h2>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Треков', `${report.totalTracks} / ${registry.totalTracks}`],
              ['Опубликовано', String(report.publishedCount)],
              ['Связей продолжения', String(report.edgeCount)],
              ['Узлов пилотного графа', `${report.pilotNodeCount} / ${registry.uniquePilotTracks}`],
            ].map(([label, value]) => (
              <div key={label} className="card p-5">
                <dt className="meta-text text-muted">{label}</dt>
                <dd className="mt-2 text-[32px] leading-none font-extrabold tracking-[-0.04em]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="issues">
          <Eyebrow tone="dark">Замечания валидатора</Eyebrow>
          <h2 id="issues" className="heading-3 mt-4">
            {report.issues.length === 0 ? 'Замечаний нет' : `Всего: ${report.issues.length}`}
          </h2>
          {report.issues.length > 0 ? (
            <ul className="mt-6 grid gap-2">
              {[...errors, ...warnings, ...infos].map((issue, index) => (
                <li
                  key={`${issue.code}-${index}`}
                  className="card-soft flex flex-wrap items-center gap-3 p-4"
                >
                  <StatusBadge
                    label={
                      issue.level === 'error'
                        ? 'Ошибка'
                        : issue.level === 'warning'
                          ? 'Предупреждение'
                          : 'Заметка'
                    }
                    tone={
                      issue.level === 'error'
                        ? 'danger'
                        : issue.level === 'warning'
                          ? 'waiting'
                          : 'neutral'
                    }
                  />
                  <span className="meta-text text-muted">{issue.code}</span>
                  <span className="text-[15px]">{issue.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section aria-labelledby="distribution">
          <Eyebrow tone="dark">Распределения</Eyebrow>
          <h2 id="distribution" className="heading-3 mt-4">
            Каталог против реестра
          </h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <DistributionTable
              caption="По разделам"
              actual={report.bySection}
              expected={registry.bySection}
            />
            <DistributionTable
              caption="По внутреннему приоритету"
              actual={countBy(tracks, (track) => track.priority)}
              expected={registry.byPriority}
            />
            <DistributionTable
              caption="По типу преобразования"
              actual={countBy(tracks, (track) => track.transformationType ?? '—')}
              expected={registry.byTransformationType}
            />
          </div>
        </section>

        <section aria-labelledby="registry-table">
          <Eyebrow tone="dark">Реестр</Eyebrow>
          <h2 id="registry-table" className="heading-3 mt-4">
            Все {tracks.length} треков с внутренними полями
          </h2>
          <div className="mt-6 overflow-x-auto border-2 border-ink">
            <table className="w-full min-w-[900px] border-collapse bg-surface text-left text-[14px]">
              <thead className="bg-ink text-white">
                <tr>
                  {[
                    'ID',
                    'Раздел',
                    'Модуль',
                    'Название',
                    'Приоритет',
                    'Публикация',
                    'Содержание',
                    'Преобразование',
                    'Продолжений',
                    'Исходник',
                  ].map((header) => (
                    <th key={header} scope="col" className="px-3 py-2 font-bold whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tracks.map((track) => (
                  <tr key={track.trackId} className="border-t border-line-soft align-top">
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{track.trackId}</td>
                    <td className="px-3 py-2">{track.sectionId}</td>
                    <td className="px-3 py-2">{track.module}</td>
                    <td className="max-w-[280px] px-3 py-2">{track.title}</td>
                    <td className="px-3 py-2">{track.priority}</td>
                    <td className="px-3 py-2">{track.publicationStatus}</td>
                    <td className="px-3 py-2">{track.contentStatus}</td>
                    <td className="px-3 py-2">{track.transformationType ?? '—'}</td>
                    <td className="px-3 py-2">{track.nextTrackIds.length}</td>
                    <td className="max-w-[220px] px-3 py-2 text-muted">
                      {track.source.pages ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="pilot">
          <Eyebrow tone="dark">Пилотный граф</Eyebrow>
          <h2 id="pilot" className="heading-3 mt-4">
            {pilot.nodes.length} узлов
          </h2>
          <ol className="mt-6 grid gap-2">
            {pilot.nodes.map((node) => (
              <li key={node.trackId} className="card-soft flex flex-wrap items-center gap-3 p-3">
                <span className="meta-text">
                  {String(node.step).padStart(2, '0')} · {node.trackId}
                </span>
                <span className="text-[15px]">{node.title}</span>
                <span className="meta-text ml-auto text-muted">
                  → {node.nextTrackIds.join(', ')}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

function DistributionTable({
  caption,
  actual,
  expected,
}: {
  caption: string;
  actual: Record<string, number>;
  expected: Record<string, number>;
}) {
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  return (
    <table className="w-full border-collapse border-2 border-ink bg-surface text-left text-[14px]">
      <caption className="meta-text mb-2 text-left">{caption}</caption>
      <thead>
        <tr className="border-b-2 border-ink">
          <th scope="col" className="px-3 py-2">
            Ключ
          </th>
          <th scope="col" className="px-3 py-2">
            Каталог
          </th>
          <th scope="col" className="px-3 py-2">
            Реестр
          </th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => {
          const a = actual[key] ?? 0;
          const e = expected[key] ?? 0;
          return (
            <tr key={key} className="border-t border-line-soft">
              <td className="px-3 py-2">{key}</td>
              <td className="px-3 py-2 font-bold">{a}</td>
              <td className={a === e ? 'px-3 py-2' : 'px-3 py-2 font-bold text-danger'}>{e}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const bucket = key(item);
    result[bucket] = (result[bucket] ?? 0) + 1;
  }
  return result;
}
