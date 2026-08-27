import type {
  ArtifactRepository,
  EntitlementRepository,
  ProfileRepository,
  ProgressRepository,
  RepositoryBundle,
} from '@/domain/repositories';
import type {
  AccessDecision,
  Entitlement,
  ResultArtifact,
  TrackProgress,
  UserProfile,
} from '@/domain/types';
import { SECTION_IDS } from '@/domain/types';

/**
 * Local Storage — только для демо-профиля и демо-прогресса.
 * Никакой имитации серверной записи и никаких выдуманных результатов.
 */

const PROFILE_KEY = 'mlm-academy.profile.v1';
const PROGRESS_KEY = 'mlm-academy.progress.v1';

export const EMPTY_PROFILE: UserProfile = {
  selectedSectionId: null,
  currentGoal: '',
  savedTrackIds: [],
  role: 'member',
  updatedAt: '',
};

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage != null;
  } catch {
    return false;
  }
}

function readJson<T>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Приватный режим браузера или переполненное хранилище: демо-данные не критичны.
  }
}

function sanitizeProfile(raw: Partial<UserProfile> | null): UserProfile {
  if (!raw) return EMPTY_PROFILE;
  const selected = raw.selectedSectionId;
  return {
    selectedSectionId:
      selected != null && (SECTION_IDS as readonly string[]).includes(selected) ? selected : null,
    currentGoal: typeof raw.currentGoal === 'string' ? raw.currentGoal.slice(0, 240) : '',
    savedTrackIds: Array.isArray(raw.savedTrackIds)
      ? [...new Set(raw.savedTrackIds.filter((id): id is string => typeof id === 'string'))]
      : [],
    role: raw.role ?? 'member',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
  };
}

export class LocalProfileRepository implements ProfileRepository {
  async get(): Promise<UserProfile> {
    return sanitizeProfile(readJson<Partial<UserProfile> | null>(PROFILE_KEY, null));
  }

  async update(patch: Partial<UserProfile>): Promise<UserProfile> {
    const current = await this.get();
    const next = sanitizeProfile({ ...current, ...patch, updatedAt: new Date().toISOString() });
    writeJson(PROFILE_KEY, next);
    return next;
  }

  async toggleSavedTrack(trackId: string): Promise<UserProfile> {
    const current = await this.get();
    const savedTrackIds = current.savedTrackIds.includes(trackId)
      ? current.savedTrackIds.filter((id) => id !== trackId)
      : [...current.savedTrackIds, trackId];
    return this.update({ savedTrackIds });
  }

  async reset(): Promise<UserProfile> {
    if (hasStorage()) window.localStorage.removeItem(PROFILE_KEY);
    return EMPTY_PROFILE;
  }
}

export class LocalProgressRepository implements ProgressRepository {
  async list(): Promise<TrackProgress[]> {
    return readJson<TrackProgress[]>(PROGRESS_KEY, []);
  }

  async get(trackId: string): Promise<TrackProgress | null> {
    const all = await this.list();
    return all.find((item) => item.trackId === trackId) ?? null;
  }

  /**
   * Открытие оболочки трека фиксируется как «просмотрено», но это не прогресс:
   * `totalSteps: null` означает, что количество шагов ещё неизвестно.
   */
  async markSeen(trackId: string): Promise<TrackProgress> {
    const all = await this.list();
    const existing = all.find((item) => item.trackId === trackId);
    const next: TrackProgress = {
      trackId,
      status: existing?.status ?? 'not_started',
      contentVersion: null,
      startedAt: existing?.startedAt ?? null,
      updatedAt: new Date().toISOString(),
      completedStepIds: existing?.completedStepIds ?? [],
      totalSteps: null,
    };
    writeJson(PROGRESS_KEY, [...all.filter((item) => item.trackId !== trackId), next]);
    return next;
  }

  async clear(): Promise<void> {
    if (hasStorage()) window.localStorage.removeItem(PROGRESS_KEY);
  }
}

/**
 * Артефактов не может быть, пока у треков нет шагов и действий.
 * Репозиторий существует, чтобы экран результатов не переписывался позже.
 */
export class EmptyArtifactRepository implements ArtifactRepository {
  async list(): Promise<ResultArtifact[]> {
    return [];
  }

  async get(): Promise<ResultArtifact | null> {
    return null;
  }
}

export class MockEntitlementRepository implements EntitlementRepository {
  async get(): Promise<Entitlement> {
    return { plan: 'none', organizationId: null, validUntil: null };
  }

  async decide(track: { access: string }): Promise<AccessDecision> {
    switch (track.access) {
      case 'free':
        return { allowed: true, reason: 'granted' };
      case 'paid':
        return { allowed: false, reason: 'requires_purchase' };
      case 'invite':
        return { allowed: false, reason: 'requires_invite' };
      case 'organization':
        return { allowed: false, reason: 'requires_organization' };
      default:
        return { allowed: true, reason: 'undecided' };
    }
  }
}

export function createLocalRepositories(): RepositoryBundle {
  return {
    profile: new LocalProfileRepository(),
    progress: new LocalProgressRepository(),
    artifacts: new EmptyArtifactRepository(),
    entitlements: new MockEntitlementRepository(),
  };
}
