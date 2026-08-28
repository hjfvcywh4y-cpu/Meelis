'use client';

import { useEffect, useState } from 'react';

import { useProfile } from '@/components/providers/profile-provider';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Entitlement } from '@/domain/types';

const PLAN_LABELS: Record<Entitlement['plan'], string> = {
  none: 'Тариф не выбран',
  free: 'Свободный доступ',
  paid: 'Оплаченный доступ',
  organization: 'Доступ от организации',
  invite: 'Доступ по приглашению',
};

/** Нейтральная оболочка доступа: никакой оплаты и никаких выдуманных тарифов. */
export function AccessState() {
  const { repositories, profile, loaded } = useProfile();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);

  useEffect(() => {
    let active = true;
    void repositories.entitlements.get().then((value) => {
      if (active) setEntitlement(value);
    });
    return () => {
      active = false;
    };
  }, [repositories]);

  const isGuest = loaded && profile.selectedSectionId == null && profile.savedTrackIds.length === 0;

  return (
    <div className="card p-5">
      <span className="meta-text">Текущее состояние</span>
      <div className="mt-4 grid gap-3">
        <StatusBadge
          label={isGuest ? 'Гость' : 'Участник (демо-профиль)'}
          tone={isGuest ? 'neutral' : 'positive'}
        />
        <StatusBadge
          label={entitlement ? PLAN_LABELS[entitlement.plan] : 'Проверяем доступ'}
          tone={entitlement?.plan === 'none' ? 'waiting' : 'positive'}
        />
      </div>
      <p className="mt-5 text-[15px] leading-relaxed text-muted">
        Опубликованные треки сейчас открыты всем. Ограничение по тарифу включится позже — оболочка
        уже умеет показывать состояние «Нет доступа», не раскрывая содержание трека.
      </p>
    </div>
  );
}
