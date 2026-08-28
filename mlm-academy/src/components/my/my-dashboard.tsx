'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { NextActionCard, type NextAction } from '@/components/my/next-action-card';
import { useAppMode } from '@/components/providers/app-mode-provider';
import { useProfile } from '@/components/providers/profile-provider';
import { ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { sectionAccentStyle } from '@/components/ui/section-accent';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveAlternatives, resolveNextAction } from '@/domain/next-action';
import { routes } from '@/domain/routes';
import { getTrackStatusView } from '@/domain/status';
import type { PublicTrackMetadata, Section } from '@/domain/types';

interface MyDashboardProps {
  tracks: PublicTrackMetadata[];
  sections: Section[];
}

export function MyDashboard({ tracks, sections }: MyDashboardProps) {
  const { profile, loaded } = useProfile();
  const mode = useAppMode();

  const sectionById = useMemo(
    () => new Map(sections.map((section) => [section.sectionId, section])),
    [sections],
  );

  const decision = useMemo(() => resolveNextAction({ profile, tracks }), [profile, tracks]);
  const alternatives = useMemo(
    () => resolveAlternatives(decision, { profile, tracks }),
    [decision, profile, tracks],
  );

  if (!loaded) {
    return (
      <div className="container-grid py-10 lg:py-14">
        <div className="card h-[220px] animate-pulse bg-surface" aria-hidden="true" />
        <p className="sr-only">Загружаем ваш рабочий контекст</p>
      </div>
    );
  }

  const selectedSection = profile.selectedSectionId
    ? (sectionById.get(profile.selectedSectionId) ?? null)
    : null;

  const action = toNextAction(decision, selectedSection);
  const savedTracks = profile.savedTrackIds
    .map((id) => tracks.find((track) => track.trackId === id))
    .filter((track): track is PublicTrackMetadata => track != null);

  return (
    <div className="container-grid grid gap-6 py-10 lg:grid-cols-[minmax(0,8fr)_minmax(280px,4fr)] lg:py-14">
      <div className="grid content-start gap-6">
        <NextActionCard action={action} />

        {alternatives.length > 0 ? (
          <section aria-labelledby="alternatives" className="card p-5 sm:p-7">
            <Eyebrow>Альтернативы</Eyebrow>
            <h2 id="alternatives" className="heading-3 mt-4">
              Если сейчас не подходит
            </h2>
            <ul className="mt-5 grid gap-3">
              {alternatives.map((track) => {
                const status = getTrackStatusView(track);
                return (
                  <li key={track.trackId}>
                    <Link
                      href={routes.track(track.trackId)}
                      style={sectionAccentStyle(track.sectionId)}
                      className="card-soft card-interactive flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <span>
                        <span className="meta-text block">
                          {track.trackId} · {sectionById.get(track.sectionId)?.shortTitle}
                        </span>
                        <span className="mt-2 block text-[16px] leading-snug font-bold">
                          {track.title}
                        </span>
                      </span>
                      <StatusBadge label={status.label} tone={status.tone} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="recent-results" className="card p-5 sm:p-7">
          <Eyebrow>Последние результаты</Eyebrow>
          <h2 id="recent-results" className="heading-3 mt-4">
            Пока пусто
          </h2>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-muted">
            Результаты появятся не после просмотра урока, а когда вы сделаете действие и сохраните
            то, что получилось.
          </p>
          <div className="mt-6">
            <ButtonLink href={routes.myResults()} size="small">
              Открыть мои результаты
            </ButtonLink>
          </div>
        </section>
      </div>

      <aside className="grid content-start gap-4">
        <section aria-labelledby="context" className="card p-5">
          <Eyebrow tone="dark">Рабочий контекст</Eyebrow>
          <h2 id="context" className="heading-3 mt-4">
            Что знает система
          </h2>
          <dl className="mt-4">
            <Row label="Раздел" value={selectedSection ? `${selectedSection.sectionId} · ${selectedSection.shortTitle}` : 'Не выбран'} />
            <Row label="Текущая задача" value={profile.currentGoal || 'Не сформулирована'} />
            <Row label="Сохранено треков" value={String(savedTracks.length)} />
            <Row label="Режим" value={mode.preview ? 'Предпросмотр оболочки' : 'Рабочий режим'} />
          </dl>
          <div className="mt-5 flex flex-col gap-3">
            <ButtonLink href={routes.profile()} size="small">
              Настроить профиль
            </ButtonLink>
            <ButtonLink href={routes.start()} size="small">
              Поменять ситуацию
            </ButtonLink>
          </div>
        </section>

        <section aria-labelledby="saved" className="card p-5">
          <Eyebrow>Сохранённые треки</Eyebrow>
          <h2 id="saved" className="heading-3 mt-4">
            Мой маршрут
          </h2>
          {savedTracks.length === 0 ? (
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Здесь появятся треки, которые вы отложили. Сохранить трек можно с его страницы.
            </p>
          ) : (
            <ul className="mt-4 grid gap-2">
              {savedTracks.slice(0, 5).map((track) => (
                <li key={track.trackId} className="border-t border-line-soft pt-3 first:border-t-0">
                  <Link href={routes.track(track.trackId)} className="underline-offset-4 hover:underline">
                    <span className="meta-text block">{track.trackId}</span>
                    <span className="mt-1 block text-[15px] leading-snug font-bold">
                      {track.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5">
            <ButtonLink href={routes.myRoute()} size="small">
              Посмотреть маршрут
            </ButtonLink>
          </div>
        </section>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line-soft py-3 first:border-t-0">
      <dt className="meta-text text-muted">{label}</dt>
      <dd className="mt-1 text-[16px] leading-snug font-bold">{value}</dd>
    </div>
  );
}

function toNextAction(
  decision: ReturnType<typeof resolveNextAction>,
  section: Section | null,
): NextAction {
  switch (decision.kind) {
    case 'open_track':
      return {
        eyebrow: `Следующее действие · ${decision.track.trackId}`,
        title: decision.track.title,
        why: decision.track.situation,
        outcome: decision.track.outcome,
        href: routes.track(decision.track.trackId),
        cta: 'Открыть трек',
        sectionId: decision.track.sectionId,
        secondary: { href: routes.library(), label: 'Другие треки' },
      };
    case 'section_preparing':
      return {
        eyebrow: `Следующее действие · раздел ${decision.sectionId}`,
        title: section ? section.title : 'Ваш раздел готовится',
        why: 'Раздел выбран и сохранён. Открытых треков в нём пока нет — первый появится здесь автоматически.',
        outcome: section?.promise ?? null,
        href: routes.section(decision.sectionId),
        cta: 'Открыть раздел',
        sectionId: decision.sectionId,
        secondary: { href: routes.start(), label: 'Поменять ситуацию' },
      };
    case 'saved_preparing':
      return {
        eyebrow: `Следующее действие · ${decision.track.trackId}`,
        title: decision.track.title,
        why: 'Вы сохранили этот трек. Содержание ещё готовится, но карточка и связи уже доступны.',
        outcome: decision.track.outcome,
        href: routes.track(decision.track.trackId),
        cta: 'Открыть карточку',
        sectionId: decision.track.sectionId,
        secondary: { href: routes.library(), label: 'Библиотека' },
      };
    case 'choose_situation':
      return {
        eyebrow: 'Следующее действие',
        title: 'Выберите ситуацию, в которой сейчас застряли',
        why: 'Один ответ определит раздел и первый шаг. Это занимает меньше минуты и ничего не требует заполнять.',
        outcome: null,
        href: routes.start(),
        cta: 'Выбрать ситуацию',
        sectionId: null,
        secondary: { href: routes.library(), label: 'Сначала посмотреть библиотеку' },
      };
  }
}
