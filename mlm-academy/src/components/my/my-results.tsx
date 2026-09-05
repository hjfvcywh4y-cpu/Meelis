'use client';

import { useEffect, useState } from 'react';

import { useProfile } from '@/components/providers/profile-provider';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Eyebrow } from '@/components/ui/eyebrow';
import { routes } from '@/domain/routes';
import type { ArtifactType, ResultArtifact } from '@/domain/types';

const ARTIFACT_TYPES: { type: ArtifactType; label: string; hint: string }[] = [
  { type: 'text', label: 'Формулировка', hint: 'Своя позиция, ответ, короткий текст' },
  { type: 'list', label: 'Список', hint: 'База контактов, план действий, сегмент' },
  { type: 'message', label: 'Сообщение', hint: 'Подготовленное или отправленное сообщение' },
  { type: 'audio', label: 'Запись', hint: 'Аудио разговора или тренировки' },
  { type: 'image', label: 'Изображение', hint: 'Скриншот переписки, фото документа' },
  { type: 'link', label: 'Ссылка', hint: 'Опубликованный материал' },
  { type: 'fact', label: 'Отметка факта', hint: 'Действие совершено' },
  { type: 'appointment', label: 'Договорённость', hint: 'Следующий контакт и дата' },
  { type: 'reflection', label: 'Разбор', hint: 'Факты разговора без самобичевания' },
];

export function MyResults() {
  const { repositories } = useProfile();
  const [artifacts, setArtifacts] = useState<ResultArtifact[] | null>(null);

  useEffect(() => {
    let active = true;
    void repositories.artifacts.list().then((items) => {
      if (active) setArtifacts(items);
    });
    return () => {
      active = false;
    };
  }, [repositories]);

  return (
    <div className="container-grid grid gap-10 py-10 lg:py-14">
      {artifacts == null ? (
        <div className="card h-[200px] animate-pulse bg-surface" aria-hidden="true" />
      ) : artifacts.length === 0 ? (
        <EmptyState
          eyebrow="Пока пусто"
          title="Здесь пока нет результатов"
          description="Они появятся не после просмотра урока, а когда вы сделаете действие и сохраните то, что получилось: список, сообщение, запись разговора или договорённость с датой."
          actions={
            <>
              <ButtonLink href={routes.library()} variant="primary">
                Открыть библиотеку
              </ButtonLink>
              <ButtonLink href={routes.my()}>Личная главная</ButtonLink>
            </>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {artifacts.map((artifact) => (
            <li key={artifact.artifactId} className="card p-4">
              <span className="meta-text">{artifact.trackId}</span>
              <p className="mt-2 text-[16px] font-bold">{artifact.title}</p>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="artifact-types">
        <Eyebrow>Типы результата</Eyebrow>
        <h2 id="artifact-types" className="heading-3 mt-4">
          Что вообще может остаться после трека
        </h2>
        <ul className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ARTIFACT_TYPES.map((item) => (
            <li key={item.type} className="card-soft p-4">
              <span className="meta-text">{item.type}</span>
              <p className="mt-2 text-[16px] font-bold">{item.label}</p>
              <p className="mt-1 text-[15px] leading-snug text-muted">{item.hint}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-[70ch] text-[15px] leading-relaxed text-muted">
          Загрузка и хранение появятся вместе с содержанием треков. Сейчас интерфейс ничего не
          просит прикрепить и ничего не имитирует.
        </p>
      </section>
    </div>
  );
}
