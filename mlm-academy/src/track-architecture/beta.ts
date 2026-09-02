import type { AccessContext, ArchitectureFlags, ContentStatus, ContentVersionRecord } from './types';

export const BETA_CONTENT_STATUSES = ['REVIEW', 'READY', 'PUBLISHED'] as const;
export const BLOCKED_BETA_CONTENT_STATUSES = ['EMPTY', 'DRAFT', 'ARCHIVED'] as const;

export function isRegisteredBeta(access: AccessContext, flags: ArchitectureFlags): boolean {
  return (
    flags.REGISTERED_BETA_ACCESS_ENABLED === true &&
    flags.PAYMENTS_ENABLED !== true &&
    access.registered === true &&
    Boolean(access.userId)
  );
}

export function isBetaContentStatus(status: ContentStatus | string | undefined): boolean {
  const value = String(status || '');
  if ((BLOCKED_BETA_CONTENT_STATUSES as readonly string[]).includes(value)) return false;
  return (BETA_CONTENT_STATUSES as readonly string[]).includes(value);
}

export function installedPackageOpenForBeta(content: ContentVersionRecord | null | undefined): boolean {
  if (!content || !content.privateContentRef) return false;
  return isBetaContentStatus(content.contentStatus);
}

export function safeReturnTo(raw: unknown): string {
  const text = String(raw || '').trim();
  if (!text) return '/my';
  let path = text;
  try {
    if (/^https?:\/\//i.test(text)) {
      const url = new URL(text);
      if (!/mlmacademy\.ru$/i.test(url.hostname) && url.hostname !== 'localhost') return '/my';
      path = url.pathname + url.search;
    }
  } catch {
    return '/my';
  }
  if (!path.startsWith('/')) path = '/' + path.replace(/^\/*/, '');
  if (path.startsWith('//')) return '/my';
  if (/[\s<>'"\\]/.test(path)) return '/my';
  if (!/^\/(academy|start|library|track|my|profile|about|access)(\/|\?|$)/i.test(path)) return '/my';
  return path.slice(0, 180);
}
