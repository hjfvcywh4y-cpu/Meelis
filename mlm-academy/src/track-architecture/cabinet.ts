import { isBetaContentStatus, isRegisteredBeta } from './beta';
import type { AccessContext, ArchitectureFlags, TrackDefinition } from './types';
import type { ArchitectureStore } from './store';
import { connectionsForTrack } from './store';
import { trackUrl } from '../domain/routes';

export const MENTOR_EVENTS = [
  'barrier',
  'help_requested',
  'action_planned',
  'action_done',
  'result_recorded',
  'repeat_needed',
  'wait_until',
  'done',
] as const;

export type MentorEvent = (typeof MENTOR_EVENTS)[number];

export function isMentorEvent(value: unknown): value is MentorEvent {
  return (MENTOR_EVENTS as readonly string[]).includes(String(value || ''));
}

function userTrackTitle(store: ArchitectureStore, id: string): string {
  return store.getTrack(id)?.title || id;
}

export function possibleContinuations(store: ArchitectureStore, trackId: string): Array<{ id: string; title: string }> {
  const { outgoing } = connectionsForTrack(store, trackId);
  const seen = new Set<string>();
  const out: Array<{ id: string; title: string }> = [];
  for (const row of outgoing) {
    if (!row.userVisible || row.activationMode !== 'ROUTE_RULE') continue;
    if (seen.has(row.toId)) continue;
    seen.add(row.toId);
    out.push({ id: row.toId, title: userTrackTitle(store, row.toId) });
  }
  if (out.length === 0) {
    for (const rule of store.listRules()) {
      if (rule.fromTrackId !== trackId || !rule.destinationId) continue;
      if (rule.destinationType === 'DONE') continue;
      if (seen.has(rule.destinationId)) continue;
      seen.add(rule.destinationId);
      out.push({ id: rule.destinationId, title: userTrackTitle(store, rule.destinationId) });
    }
  }
  return out;
}

export function installedTracks(store: ArchitectureStore) {
  return store
    .listContent()
    .filter((row) => isBetaContentStatus(row.contentStatus) && row.privateContentRef)
    .filter((row) => store.getTrack(row.trackId)?.entityType !== 'SYSTEM_ACTION')
    .map((row) => {
      const track = store.getTrack(row.trackId);
      return {
        trackId: row.trackId,
        title: track?.title || row.trackId,
        situation: track?.situation || '',
        contentStatus: row.contentStatus,
      };
    });
}

function instanceLabel(status: string, waitUntil: string | null): string {
  if (status === 'completed') return 'Завершён';
  if (status === 'waiting' || waitUntil) return 'Ожидание до даты/события';
  if (status === 'active') return 'В процессе';
  return 'Не начат';
}

export function buildCabinet(store: ArchitectureStore, access: AccessContext, flags: ArchitectureFlags) {
  const installed = installedTracks(store);
  const instances = access.userId ? store.listInstances(access.userId) : [];
  const active = instances
    .filter((row) => row.instanceStatus === 'active' || row.instanceStatus === 'waiting')
    .slice()
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  const inProgress = active[0] || null;
  const defaultTrack = installed.find((row) => row.trackId === 'A3-002') || installed[0] || null;

  let next: Record<string, unknown>;
  if (inProgress) {
    const track = store.getTrack(inProgress.trackId);
    if (inProgress.pendingSystemActionId) {
      next = {
        question: 'Что мне делать сейчас?',
        title: 'Зафиксировать результат',
        trackId: inProgress.trackId,
        why: 'Почему это сейчас: после контакта нужно зафиксировать факт, прежде чем система предложит следующий шаг.',
        cta: 'Зафиксировать результат',
        href: trackUrl(inProgress.trackId) + '?systemAction=a3-008',
        kind: 'system_action',
        systemActionId: inProgress.pendingSystemActionId,
      };
    } else {
      next = {
        question: 'Что мне делать сейчас?',
        title: track?.title || inProgress.trackId,
        trackId: inProgress.trackId,
        why: 'Почему это сейчас: есть незавершённое прохождение. Сначала закройте его, затем система скорректирует маршрут.',
        cta: inProgress.instanceStatus === 'waiting' ? 'Вернуться с результатом' : 'Продолжить',
        href: trackUrl(inProgress.trackId),
        kind: 'continue',
      };
    }
  } else if (defaultTrack) {
    next = {
      question: 'Что мне делать сейчас?',
      title: defaultTrack.title,
      trackId: defaultTrack.trackId,
      why: 'Почему это сейчас: это установленный рабочий трек. После фиксации результата появится один следующий шаг.',
      cta: 'Начать',
      href: trackUrl(defaultTrack.trackId),
      kind: 'start',
    };
  } else {
    next = {
      question: 'Что мне делать сейчас?',
      title: 'Пока нет установленного трека',
      trackId: null,
      why: 'Почему это сейчас: рабочие пакеты ещё не установлены.',
      cta: 'Открыть библиотеку',
      href: '/library',
      kind: 'library',
    };
  }

  const decisions = access.userId ? store.listDecisions(access.userId) : [];
  const lastDecision = decisions[decisions.length - 1] || null;
  if (!inProgress && lastDecision?.destinationId && lastDecision.destinationType !== 'DONE') {
    const destInstalled = isBetaContentStatus(store.getContent(lastDecision.destinationId)?.contentStatus);
    next = {
      question: 'Что мне делать сейчас?',
      title: userTrackTitle(store, lastDecision.destinationId),
      trackId: lastDecision.destinationId,
      why: destInstalled
        ? 'Почему это сейчас: это следующий шаг по фактическому результату предыдущего трека.'
        : 'Почему это сейчас: следующий шаг определён, но пакет ещё не установлен.',
      cta: destInstalled ? 'Начать' : 'Готовится',
      href: destInstalled ? trackUrl(lastDecision.destinationId) : trackUrl(lastDecision.destinationId),
      kind: destInstalled ? 'start' : 'preparing',
      preparing: !destInstalled,
    };
  }

  const available = installed.map((row) => {
    const instance = instances.filter((item) => item.trackId === row.trackId).slice(-1)[0];
    return {
      trackId: row.trackId,
      title: row.title,
      status: instance ? instanceLabel(instance.instanceStatus, instance.waitUntil) : 'Не начат',
      lastStep: instance?.lastStepLabel || instance?.lastStepId || null,
      href: trackUrl(row.trackId),
    };
  });

  return {
    beta: isRegisteredBeta(access, flags),
    nextStep: next,
    inProgress: inProgress
      ? {
          trackId: inProgress.trackId,
          title: userTrackTitle(store, inProgress.trackId),
          lastStep: inProgress.lastStepLabel || inProgress.lastStepId || null,
          stopPoint: inProgress.instanceStatus === 'waiting' ? 'wait_until' : 'in_track',
          status: instanceLabel(inProgress.instanceStatus, inProgress.waitUntil),
          href: trackUrl(inProgress.trackId),
          cta: 'Продолжить',
        }
      : null,
    availableTracks: available,
  };
}

export function destinationCard(
  store: ArchitectureStore,
  destinationId: string | null,
  destinationType: string,
  sourceTrackId?: string | null,
): {
  status: 'ready' | 'preparing' | 'done' | 'system_action';
  title: string;
  href: string | null;
  systemActionId?: string;
  sourceTrackId?: string;
} {
  if (destinationType === 'DONE') return { status: 'done', title: 'Маршрут корректно завершён', href: '/my' };
  if (destinationType === 'WAIT_UNTIL') {
    return { status: 'ready', title: 'Ожидание до даты', href: '/my' };
  }
  if (destinationType === 'SYSTEM_ACTION' && destinationId) {
    const installed = isBetaContentStatus(store.getContent(destinationId)?.contentStatus);
    return {
      status: installed ? 'system_action' : 'preparing',
      title: installed ? 'Зафиксировать результат' : 'Готовится',
      href: null,
      systemActionId: destinationId,
      sourceTrackId: sourceTrackId || undefined,
    };
  }
  if (!destinationId) return { status: 'preparing', title: 'Готовится', href: null };
  const installed = isBetaContentStatus(store.getContent(destinationId)?.contentStatus);
  return {
    status: installed ? 'ready' : 'preparing',
    title: installed ? userTrackTitle(store, destinationId) : `${userTrackTitle(store, destinationId)} · Готовится`,
    href: trackUrl(destinationId),
  };
}

export function restartAllowed(_track: TrackDefinition | undefined): boolean {
  return true;
}
