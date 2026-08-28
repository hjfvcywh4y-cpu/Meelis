'use client';

import { useProfile } from '@/components/providers/profile-provider';
import { Button, ButtonLink } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { routes } from '@/domain/routes';
import type { TrackStatusView } from '@/domain/status';
import { trackEvent } from '@/lib/analytics';

interface TrackActionsProps {
  trackId: string;
  status: TrackStatusView;
  canSave: boolean;
}

/**
 * Кнопка «Начать трек» не рендерится, пока внутри нет шагов.
 * Вместо неё — сохранение в личный маршрут и честное объяснение статуса.
 */
export function TrackActions({ trackId, status, canSave }: TrackActionsProps) {
  const { profile, loaded, toggleSavedTrack } = useProfile();
  const saved = loaded && profile.savedTrackIds.includes(trackId);

  async function onToggle() {
    trackEvent({ name: 'save_track', trackId, saved: !saved });
    await toggleSavedTrack(trackId);
  }

  return (
    <div className="card p-5">
      {status.canStart ? (
        <ButtonLink href={routes.track(trackId)} variant="primary" className="w-full">
          Начать трек
        </ButtonLink>
      ) : (
        <p className="text-[15px] leading-relaxed text-muted">{status.explanation}</p>
      )}

      {canSave ? (
        <Button
          variant={saved ? 'accent' : 'default'}
          className="mt-4 w-full"
          onClick={() => void onToggle()}
          aria-pressed={saved}
        >
          {saved ? 'Убрать из моего маршрута' : 'Сохранить в мой маршрут'}
        </Button>
      ) : null}

      {saved ? (
        <p className="mt-4">
          <StatusBadge label="Сохранён в маршруте" tone="positive" />
        </p>
      ) : null}

      <p className="mt-4 text-[13px] leading-relaxed text-muted">
        Сохранение хранится только в этом браузере. Аккаунтов и синхронизации в текущей версии нет.
      </p>
    </div>
  );
}
