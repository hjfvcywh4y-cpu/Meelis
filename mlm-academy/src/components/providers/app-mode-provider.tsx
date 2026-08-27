'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { AppMode } from '@/domain/types';

const AppModeContext = createContext<AppMode>({ preview: false, adminCatalog: false });

/**
 * Режим приходит с сервера. Клиент только читает его,
 * поэтому preview нельзя включить из браузера.
 */
export function AppModeProvider({ mode, children }: { mode: AppMode; children: ReactNode }) {
  return <AppModeContext.Provider value={mode}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppMode {
  return useContext(AppModeContext);
}
