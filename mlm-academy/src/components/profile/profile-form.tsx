'use client';

import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';

import { useProfile } from '@/components/providers/profile-provider';
import { Button, ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { routes } from '@/domain/routes';
import { SECTION_IDS, type PublicTrackMetadata, type Section, type SectionId } from '@/domain/types';

const GOAL_MAX = 240;

interface ProfileFormProps {
  sections: Section[];
  tracks: PublicTrackMetadata[];
}

export function ProfileForm({ sections, tracks }: ProfileFormProps) {
  const { profile, loaded, selectSection, setGoal, toggleSavedTrack, reset } = useProfile();
  const goalId = useId();
  const sectionId = useId();

  // Черновик существует только пока пользователь правит поле:
  // до этого значение берётся из профиля, поэтому синхронизация через effect не нужна.
  const [goalDraft, setGoalDraft] = useState<string | null>(null);
  const [sectionDraft, setSectionDraft] = useState<SectionId | '' | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const goalValue = goalDraft ?? profile.currentGoal;
  const sectionValue = sectionDraft ?? profile.selectedSectionId ?? '';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (goalValue.length > GOAL_MAX) {
      setMessage({ tone: 'error', text: `Задача длиннее ${GOAL_MAX} символов. Сократите её.` });
      return;
    }
    if (sectionValue) await selectSection(sectionValue);
    await setGoal(goalValue.trim());
    setGoalDraft(null);
    setSectionDraft(null);
    setMessage({ tone: 'ok', text: 'Профиль сохранён в этом браузере.' });
  }

  const savedTracks = profile.savedTrackIds
    .map((id) => tracks.find((track) => track.trackId === id))
    .filter((track): track is PublicTrackMetadata => track != null);

  if (!loaded) {
    return (
      <div className="container-grid py-10 lg:py-14">
        <div className="card h-[280px] animate-pulse bg-surface" aria-hidden="true" />
        <p className="sr-only">Загружаем профиль</p>
      </div>
    );
  }

  const isNew = !profile.selectedSectionId && !profile.currentGoal && savedTracks.length === 0;

  return (
    <div className="container-grid grid gap-6 py-10 lg:grid-cols-[minmax(0,7fr)_minmax(280px,5fr)] lg:py-14">
      <form onSubmit={onSubmit} className="card p-5 sm:p-7">
        <Eyebrow tone="dark">{isNew ? 'Новый профиль' : 'Рабочий профиль'}</Eyebrow>
        <h2 className="heading-3 mt-4">Контекст, из которого система выбирает следующий шаг</h2>

        <div className="mt-7 grid gap-6">
          <div>
            <label htmlFor={sectionId} className="meta-text mb-2 block">
              Текущий раздел
            </label>
            <select
              id={sectionId}
              className="field"
              value={sectionValue}
              onChange={(event) => setSectionDraft(event.target.value as SectionId | '')}
            >
              <option value="">Не выбран</option>
              {SECTION_IDS.map((id) => {
                const section = sections.find((item) => item.sectionId === id);
                return (
                  <option key={id} value={id}>
                    {id} · {section?.shortTitle ?? id}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label htmlFor={goalId} className="meta-text mb-2 block">
              Что нужно сделать в ближайшее время
            </label>
            <input
              id={goalId}
              className="field"
              value={goalValue}
              maxLength={GOAL_MAX + 20}
              placeholder="Например: начать первый разговор"
              onChange={(event) => setGoalDraft(event.target.value)}
              aria-describedby={`${goalId}-hint`}
            />
            <p id={`${goalId}-hint`} className="mt-2 text-[14px] text-muted">
              Одна фраза своими словами. Не больше {GOAL_MAX} символов.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button type="submit" variant="primary">
            Сохранить
          </Button>
          <Button
            onClick={() => {
              setGoalDraft(null);
              setSectionDraft(null);
              void reset();
              setMessage({ tone: 'ok', text: 'Профиль и демо-прогресс очищены.' });
            }}
          >
            Очистить профиль
          </Button>
        </div>

        <p
          aria-live="polite"
          className={
            message?.tone === 'error'
              ? 'mt-5 text-[15px] font-bold text-danger'
              : 'mt-5 text-[15px] font-bold text-success'
          }
        >
          {message?.text ?? ''}
        </p>

        <p className="mt-5 text-[14px] leading-relaxed text-muted">
          Профиль хранится только в этом браузере. Настоящей авторизации и синхронизации между
          устройствами в текущей версии нет.
        </p>
      </form>

      <aside className="grid content-start gap-4">
        <section aria-labelledby="saved-tracks" className="card p-5">
          <Eyebrow>Сохранённые треки</Eyebrow>
          <h2 id="saved-tracks" className="heading-3 mt-4">
            {savedTracks.length === 0 ? 'Пока ничего не сохранено' : `${savedTracks.length} в маршруте`}
          </h2>
          {savedTracks.length === 0 ? (
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Сохранить трек можно с его страницы кнопкой «Сохранить в мой маршрут».
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {savedTracks.map((track) => (
                <li
                  key={track.trackId}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-3 first:border-t-0"
                >
                  <Link
                    href={routes.track(track.trackId)}
                    className="max-w-[60%] underline-offset-4 hover:underline"
                  >
                    <span className="meta-text block">{track.trackId}</span>
                    <span className="mt-1 block text-[15px] leading-snug font-bold">
                      {track.title}
                    </span>
                  </Link>
                  <Button size="small" onClick={() => void toggleSavedTrack(track.trackId)}>
                    Убрать
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="access-note" className="card p-5">
          <Eyebrow>Доступ</Eyebrow>
          <h2 id="access-note" className="heading-3 mt-4">
            Роль и тариф
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Сейчас все опубликованные треки открыты без оплаты. Модель доступа описана отдельно.
          </p>
          <div className="mt-5">
            <ButtonLink href={routes.access()} size="small">
              Посмотреть доступ
            </ButtonLink>
          </div>
        </section>
      </aside>
    </div>
  );
}
