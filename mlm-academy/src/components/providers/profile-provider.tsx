'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { RepositoryBundle } from '@/domain/repositories';
import type { SectionId, UserProfile } from '@/domain/types';
import { createLocalRepositories, EMPTY_PROFILE } from '@/lib/repositories/local';

interface ProfileContextValue {
  profile: UserProfile;
  /** До окончания чтения из хранилища экраны показывают скелет, а не пустое состояние. */
  loaded: boolean;
  repositories: RepositoryBundle;
  selectSection: (sectionId: SectionId) => Promise<void>;
  setGoal: (goal: string) => Promise<void>;
  toggleSavedTrack: (trackId: string) => Promise<void>;
  reset: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void repositories.profile.get().then((value) => {
      if (!active) return;
      setProfile(value);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [repositories]);

  const selectSection = useCallback(
    async (sectionId: SectionId) => {
      setProfile(await repositories.profile.update({ selectedSectionId: sectionId }));
    },
    [repositories],
  );

  const setGoal = useCallback(
    async (goal: string) => {
      setProfile(await repositories.profile.update({ currentGoal: goal }));
    },
    [repositories],
  );

  const toggleSavedTrack = useCallback(
    async (trackId: string) => {
      setProfile(await repositories.profile.toggleSavedTrack(trackId));
    },
    [repositories],
  );

  const reset = useCallback(async () => {
    await repositories.progress.clear();
    setProfile(await repositories.profile.reset());
  }, [repositories]);

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, loaded, repositories, selectSection, setGoal, toggleSavedTrack, reset }),
    [profile, loaded, repositories, selectSection, setGoal, toggleSavedTrack, reset],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile должен вызываться внутри ProfileProvider');
  return context;
}
