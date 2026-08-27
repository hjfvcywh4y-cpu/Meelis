'use client';

import { useEffect } from 'react';

import { trackEvent, type AnalyticsEvent } from '@/lib/analytics';

/** Отправляет одно событие просмотра. Внешний сервис аналитики не подключён. */
export function PageView({ event }: { event: AnalyticsEvent }) {
  useEffect(() => {
    trackEvent(event);
    // Событие фиксируется один раз на монтирование экрана.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
