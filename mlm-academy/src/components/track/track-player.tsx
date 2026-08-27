import Link from 'next/link';

import { pluralTracks } from '@/components/catalog/section-card';
import { Breadcrumbs, type Crumb } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { sectionAccentStyle } from '@/components/ui/section-accent';
import { StatusBadge } from '@/components/ui/status-badge';
import { routes } from '@/domain/routes';
import type { FutureTrackContent } from '@/domain/schemas';
import {
  RECOMMENDATION_REASON_LABELS,
  type Recommendation,
  type RecommendationResult,
} from '@/domain/recommendations';
import type { TrackStatusView } from '@/domain/status';
import type { PublicTrackMetadata, Section, TrackProgress } from '@/domain/types';

/**
 * Оболочка Track Player.
 *
 * Компоненты описывают будущую страницу прохождения целиком, но ни один из них
 * не выдумывает содержание: пока шагов нет, они показывают честное состояние.
 */

export type TrackStep = FutureTrackContent['steps'][number];

interface TrackHeaderProps {
  track: PublicTrackMetadata;
  section: Section;
  status: TrackStatusView;
  breadcrumbs: Crumb[];
}

export function TrackHeader({ track, section, status, breadcrumbs }: TrackHeaderProps) {
  return (
    <header>
      <Breadcrumbs items={breadcrumbs} />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Eyebrow tone="accent">
          {track.trackId} · {section.shortTitle}
        </Eyebrow>
        <StatusBadge label={status.label} tone={status.tone} />
      </div>
      <h1 className="heading-1 mt-6 max-w-[18ch] normal-case">{track.title}</h1>

      <dl className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <dt className="meta-text">Подходит, если</dt>
          <dd className="body-l mt-3">{track.situation}</dd>
        </div>
        <div className="card p-5">
          <dt className="meta-text">На выходе</dt>
          <dd className="body-l mt-3">{track.outcome}</dd>
        </div>
      </dl>
    </header>
  );
}

interface TrackProgressProps {
  status: TrackStatusView;
  progress: TrackProgress | null;
}

/**
 * Прогресс скрыт, а не равен нулю: пока количество шагов неизвестно,
 * шкала «0 из N» была бы обманом.
 */
export function TrackProgressPanel({ status, progress }: TrackProgressProps) {
  if (!status.showProgress || !progress || progress.totalSteps == null) return null;

  const done = progress.completedStepIds.length;
  const total = progress.totalSteps;

  return (
    <section aria-label="Прогресс по треку" className="card p-5">
      <span className="meta-text">Прогресс</span>
      <p className="mt-3 text-[18px] font-bold">
        {done} из {total}
      </p>
      <div
        className="mt-3 h-3 border-2 border-ink"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className="h-full bg-ink" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </section>
  );
}

interface TrackStepNavigationProps {
  steps: TrackStep[];
  activeStepId: string | null;
}

/** Навигация по шагам появляется вместе с шагами. Пустых «уроков» не существует. */
export function TrackStepNavigation({ steps, activeStepId }: TrackStepNavigationProps) {
  if (steps.length === 0) return null;

  return (
    <nav aria-label="Шаги трека" className="card p-4">
      <ol className="grid gap-2">
        {steps.map((step, index) => (
          <li key={step.stepId}>
            <span
              aria-current={step.stepId === activeStepId ? 'step' : undefined}
              className="flex items-center gap-3 border border-line-soft px-3 py-2 text-[15px]"
            >
              <span className="meta-text">{String(index + 1).padStart(2, '0')}</span>
              {step.title}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

interface TrackStepViewportProps {
  steps: TrackStep[];
  status: TrackStatusView;
  sectionHref: string;
}

/** Область содержания. В состоянии metadata_only — blueprint, а не выдуманные шаги. */
export function TrackStepViewport({ steps, status, sectionHref }: TrackStepViewportProps) {
  if (steps.length > 0) {
    return (
      <section aria-label="Содержание трека" className="card p-6">
        <ol className="grid gap-6">
          {steps.map((step, index) => (
            <li key={step.stepId}>
              <span className="meta-text">Шаг {index + 1}</span>
              <h3 className="heading-3 mt-2">{step.title}</h3>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section
      aria-label="Содержание трека"
      className="blueprint grid h-full min-h-[320px] place-items-center px-4 py-12 text-center sm:px-8"
    >
      <div className="max-w-[540px]">
        <Eyebrow tone="dark">Структура готова</Eyebrow>
        <h2 className="heading-2 mt-5">Содержание трека ещё не добавлено</h2>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">{status.explanation}</p>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">
          Здесь появятся шаги, само действие и фиксация результата. Оболочка не подменяет их
          сгенерированным текстом.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href={sectionHref} variant="primary">
            Вернуться в раздел
          </ButtonLink>
          <ButtonLink href={routes.library()}>Открыть библиотеку</ButtonLink>
        </div>
      </div>
    </section>
  );
}

/** Место будущего DONE-результата. Ничего не просит загрузить и ничего не имитирует. */
export function TrackEvidencePanel({ outcome }: { outcome: string }) {
  return (
    <section aria-labelledby="evidence" className="card p-5">
      <span className="meta-text">Результат действия</span>
      <h3 id="evidence" className="heading-3 mt-3">
        Что здесь появится
      </h3>
      <p className="mt-3 text-[16px] leading-relaxed text-muted">{outcome}</p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {[
          'текст',
          'список',
          'сообщение',
          'аудио',
          'скриншот',
          'ссылка',
          'отметка факта',
          'договорённость',
        ].map((item) => (
          <li key={item} className="border border-line-soft px-2 py-1 text-[13px] text-muted">
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[14px] leading-relaxed text-muted">
        Загрузка появится вместе с содержанием трека. Сейчас сохранять нечего.
      </p>
    </section>
  );
}

/** Правило завершения трека. Просмотр материала завершением не считается. */
export function TrackCompletionPanel() {
  return (
    <section aria-labelledby="completion" className="card p-5">
      <span className="meta-text">Когда трек считается сделанным</span>
      <h3 id="completion" className="heading-3 mt-3">
        Действие + результат + следующий шаг
      </h3>
      <ol className="mt-4 grid gap-3 text-[15px] leading-snug">
        <li className="border-t border-line-soft pt-3">Действие выполнено в реальной работе.</li>
        <li className="border-t border-line-soft pt-3">Результат зафиксирован.</li>
        <li className="border-t border-line-soft pt-3">Выбран следующий шаг.</li>
      </ol>
    </section>
  );
}

interface NextTrackRecommendationsProps {
  result: RecommendationResult;
  sections: Map<string, Section>;
  fallbackSectionHref: string;
}

export function NextTrackRecommendations({
  result,
  sections,
  fallbackSectionHref,
}: NextTrackRecommendationsProps) {
  const { primary, alternatives, needsFallback } = result;

  return (
    <section aria-labelledby="next" className="border-t-2 border-ink">
      <div className="container-grid py-10 lg:py-14">
        <Eyebrow tone="dark">Куда дальше</Eyebrow>
        <h2 id="next" className="heading-2 mt-5">
          {primary ? 'Возможное продолжение' : 'Продолжение готовится'}
        </h2>

        {primary ? (
          <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(280px,5fr)]">
            <RecommendationBlock recommendation={primary} sections={sections} emphasis />
            {alternatives.length > 0 ? (
              <div>
                <span className="meta-text">Альтернативы · не больше трёх</span>
                <ul className="mt-4 grid gap-3">
                  {alternatives.map((item) => (
                    <li key={item.track.trackId}>
                      <RecommendationBlock recommendation={item} sections={sections} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="body-l mt-5 max-w-[62ch] text-muted">
            У этого трека пока нет доступных продолжений. Это не тупик: вернитесь в раздел или
            откройте библиотеку.
          </p>
        )}

        {needsFallback ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={fallbackSectionHref} variant="primary">
              Вернуться в раздел
            </ButtonLink>
            <ButtonLink href={routes.library()}>Открыть библиотеку</ButtonLink>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RecommendationBlock({
  recommendation,
  sections,
  emphasis = false,
}: {
  recommendation: Recommendation;
  sections: Map<string, Section>;
  emphasis?: boolean;
}) {
  const { track, reason, available } = recommendation;
  const section = sections.get(track.sectionId);

  return (
    <Link
      href={routes.track(track.trackId)}
      style={sectionAccentStyle(track.sectionId)}
      className={
        emphasis
          ? 'card card-interactive block overflow-hidden p-5 sm:p-7'
          : 'card-soft card-interactive block p-4'
      }
    >
      {emphasis ? <span aria-hidden="true" className="accent-strip mb-5 block h-3" /> : null}
      <span className="meta-text">
        {track.trackId} · {section?.shortTitle ?? track.sectionId}
      </span>
      <p className={emphasis ? 'heading-3 mt-4' : 'mt-2 text-[16px] font-bold leading-snug'}>
        {track.title}
      </p>
      {emphasis ? (
        <p className="mt-4 max-w-[56ch] text-[16px] leading-snug text-muted">{track.outcome}</p>
      ) : null}
      <p className="mt-3 text-[13px] text-muted">
        {RECOMMENDATION_REASON_LABELS[reason]}
        {available ? '' : ' · продолжение готовится'}
      </p>
    </Link>
  );
}

export function TrackPassport({
  track,
  section,
  status,
  linkedCount,
}: {
  track: PublicTrackMetadata;
  section: Section;
  status: TrackStatusView;
  linkedCount: number;
}) {
  const rows = [
    { label: 'Раздел', value: `${section.sectionId} · ${section.shortTitle}` },
    { label: 'Модуль', value: track.module },
    { label: 'Формат', value: track.format },
    { label: 'Статус', value: status.label },
    {
      label: 'Прогресс',
      value: status.showProgress ? 'Считается по шагам' : 'Не считается до появления шагов',
    },
    { label: 'Продолжения', value: `${linkedCount} ${pluralTracks(linkedCount)}` },
  ];

  return (
    <section aria-labelledby="passport" className="card p-5">
      <span className="meta-text">Паспорт трека</span>
      <h2 id="passport" className="sr-only">
        Паспорт трека
      </h2>
      <dl className="mt-4">
        {rows.map((row) => (
          <div key={row.label} className="border-t border-line-soft py-3 first:border-t-0">
            <dt className="meta-text text-muted">{row.label}</dt>
            <dd className="mt-1 text-[16px] leading-snug font-bold">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
