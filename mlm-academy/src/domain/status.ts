import type { ContentStatus, PublicationStatus, PublicTrackMetadata } from './types';

/**
 * Один источник правды для честных статусов.
 * Правило: если содержания нет — не показываем «Начать» и не рисуем прогресс.
 */

export type TrackAvailability =
  | 'available' // опубликован и содержание готово
  | 'published_empty' // опубликован, но шаги ещё не наполнены
  | 'preparing' // planned / draft / review
  | 'archived'
  | 'locked'; // нет доступа по entitlement

export interface TrackStatusView {
  availability: TrackAvailability;
  label: string;
  tone: 'neutral' | 'positive' | 'waiting' | 'muted';
  /** Кнопка действия допустима только когда внутри есть реальные шаги. */
  canStart: boolean;
  /** Прогресс скрывается, а не показывается как «0 из N». */
  showProgress: boolean;
  explanation: string;
}

export function getTrackAvailability(
  track: Pick<PublicTrackMetadata, 'publicationStatus' | 'contentStatus'>,
  options: { entitled?: boolean } = {},
): TrackAvailability {
  const entitled = options.entitled ?? true;
  if (track.publicationStatus === 'archived' || track.contentStatus === 'archived') {
    return 'archived';
  }
  if (track.publicationStatus !== 'published') return 'preparing';
  if (!entitled) return 'locked';
  return track.contentStatus === 'published' || track.contentStatus === 'complete'
    ? 'available'
    : 'published_empty';
}

export function getTrackStatusView(
  track: Pick<PublicTrackMetadata, 'publicationStatus' | 'contentStatus'>,
  options: { entitled?: boolean } = {},
): TrackStatusView {
  const availability = getTrackAvailability(track, options);

  switch (availability) {
    case 'available':
      return {
        availability,
        label: 'Доступен',
        tone: 'positive',
        canStart: true,
        showProgress: true,
        explanation: 'Трек открыт: внутри есть шаги, действие и фиксация результата.',
      };
    case 'published_empty':
      return {
        availability,
        label: 'Открыт, содержание готовится',
        tone: 'waiting',
        canStart: false,
        showProgress: false,
        explanation:
          'Карточка опубликована, но шаги ещё не добавлены. Кнопка действия появится вместе с ними.',
      };
    case 'preparing':
      return {
        availability,
        label: 'Готовится',
        tone: 'waiting',
        canStart: false,
        showProgress: false,
        explanation: 'Структура трека готова. Содержание находится в производстве.',
      };
    case 'archived':
      return {
        availability,
        label: 'Снят с публикации',
        tone: 'muted',
        canStart: false,
        showProgress: false,
        explanation: 'Трек снят с публикации. История прохождений сохраняется.',
      };
    case 'locked':
      return {
        availability,
        label: 'Нет доступа',
        tone: 'muted',
        canStart: false,
        showProgress: false,
        explanation: 'Трек существует, но для него нужен доступ.',
      };
  }
}

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  planned: 'Запланирован',
  draft: 'Черновик',
  review: 'На проверке',
  published: 'Опубликован',
  archived: 'В архиве',
  unknown: 'Статус не определён',
};

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  metadata_only: 'Только метаданные',
  draft: 'Черновик содержания',
  review: 'Содержание на проверке',
  published: 'Содержание опубликовано',
  archived: 'Содержание в архиве',
};
