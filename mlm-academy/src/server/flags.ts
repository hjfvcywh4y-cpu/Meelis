import 'server-only';

import type { AppMode } from '@/domain/types';

/**
 * Режимы включаются только серверными переменными окружения.
 * Публичный query-параметр не может открыть preview или админку.
 */

function readFlag(name: string): boolean {
  return process.env[name] === 'true';
}

export function isPreviewEnabled(): boolean {
  return readFlag('ENABLE_CATALOG_PREVIEW');
}

export function isAdminCatalogEnabled(): boolean {
  if (readFlag('ENABLE_ADMIN_CATALOG')) return true;
  if (isPreviewEnabled()) return true;
  return process.env.NODE_ENV !== 'production';
}

export function getAppMode(): AppMode {
  return {
    preview: isPreviewEnabled(),
    adminCatalog: isAdminCatalogEnabled(),
  };
}
