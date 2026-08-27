/**
 * Поля реестра, которым запрещено покидать сервер.
 *
 * Список вынесен в отдельный модуль, чтобы даже названия внутренних полей
 * не попадали в клиентский bundle вместе с общими типами.
 */
export const INTERNAL_ONLY_TRACK_FIELDS = [
  'priority',
  'source',
  'adaptationLevel',
  'transformationType',
  'internalNote',
  'pageStatusRaw',
  'legacyPublicUrl',
  'order',
] as const;

export type InternalOnlyTrackField = (typeof INTERNAL_ONLY_TRACK_FIELDS)[number];
